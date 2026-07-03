// scripts/health.mjs — production-origin health audit for every external
// endpoint the app talks to.
//
//   npm run health -- --origin https://landcheck.info
//   npm run health -- --origin https://<username>.github.io
//
// For each endpoint in config.js (ACTIVE_PARCEL_COUNTIES, ADMIN_BOUNDARIES,
// OVERLAYS, basemaps, point-lookup services) this script:
//   (a) asserts the URL scheme is https — GitHub Pages serves over HTTPS and
//       browsers hard-block mixed-content fetches to http:// endpoints;
//   (b) fires a minimal live query (returnCountOnly / count-style — NEVER
//       resultRecordCount, which 400s on older ArcGIS servers when combined
//       with f=geojson; see the project notes "Query-URL quirks");
//   (c) for fetch()-based endpoints, sends `Origin: <--origin>` and verifies
//       Access-Control-Allow-Origin echoes it or is `*`. Tile/image endpoints
//       (basemaps, esri-export overlays, soil XYZ, streets tiles) load via
//       <img> in the app, so CORS is not required there — they are checked
//       for reachability only.
//
// Exit code is nonzero if any required check fails, so this can run in CI.
//
// >>> This is also the future MONTHLY MAINTENANCE TOOL. County GIS endpoints
// >>> drift (Travis County ad73e7b, Fairfax 9bac2cf, Henrico 502s) — run this
// >>> monthly against the production origin and demote failing counties to
// >>> comingSoon with a dated skipReason.
//
// Quirks honoured (full detail in the project notes "Endpoint hygiene"):
//   - ArcGIS servers return HTTP 200 + {error:{...}} — body is checked, not
//     just status.
//   - TIGERweb's WAF rejects returnGeometry=true — point query sends
//     returnGeometry=false.
//   - 401/"Token Required" bodies are surfaced explicitly (the Travis County
//     failure mode).
//   - Nominatim requires a descriptive User-Agent.

import {
  BASEMAPS, LABEL_LAYER, OVERLAYS, ADMIN_BOUNDARIES,
  PARCEL_COUNTIES, ACTIVE_PARCEL_COUNTIES,
  FEMA_FLOOD_QUERY_URL, USGS_EPQS_URL, NOMINATIM_URL, CENSUS_GEOCODER_URL,
  SDA_URL, TIGERWEB_TRACTS_URL, CENSUS_ACS_BASE, PROTECTED_LANDS_URL
} from '../js/config.js';

const args = process.argv.slice(2);
const originIdx = args.indexOf('--origin');
const ORIGIN = originIdx >= 0 ? args[originIdx + 1] : null;
if (!ORIGIN || !/^https:\/\//.test(ORIGIN)) {
  console.error('Usage: npm run health -- --origin https://<production-host>');
  process.exit(2);
}

const TIMEOUT_MS = 20_000;
const UA = 'LandCheck-health-audit/1.0 (https://landcheck.info)';
// Hosts that fail Node's strict TLS chain check but are verified working in the
// browser (browsers fetch the missing intermediate cert via AIA). TLS errors
// from these are reported as WARN, not FAIL. (eweb.jeffparish.net was here until
// 2026-07-02, when Jefferson Parish LA was demoted for an unrelated server-side
// SDE fault — kept as the documented pattern for the next such endpoint.)
const NODE_TLS_BROWSER_OK = [];

// A reference point inside every layer's coverage (Annapolis, MD).
const PT = { lon: -76.4922, lat: 38.9784 };

// Slippy tile over the MD/NoVA default view (z10) for tile-reachability checks.
const TILE = { z: 10, x: 292, y: 391 };

const sub = (url) => url.replace('{s}', 'a').replace('{r}', '');
const tileUrl = (tpl) =>
  sub(tpl).replace('{z}', TILE.z).replace('{x}', TILE.x).replace('{y}', TILE.y);

async function probe({ name, kind, url, corsRequired, method = 'GET', body, headers = {}, expect = 'json', warnOnly, warnReason }) {
  const r = { name, kind, url, corsRequired, warnOnly, warnReason, ok: false, detail: '' };
  if (!/^https:\/\//.test(url)) {
    r.detail = `NOT HTTPS (${url.split(':')[0]}://) — mixed-content blocked in production`;
    return r;
  }
  let res;
  try {
    res = await fetch(url, {
      method, body,
      headers: { 'User-Agent': UA, Origin: ORIGIN, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'follow'
    });
  } catch (e) {
    const code = e.cause?.code || e.name;
    // Node is stricter than browsers about TLS chains: it won't fetch missing
    // intermediate certs (AIA), so some county servers fail here but work fine
    // in the actual browser app (verified in chromium). Downgrade those to WARN
    // so a Node-only TLS quirk doesn't read as a real outage.
    if (code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' && NODE_TLS_BROWSER_OK.some(h => url.includes(h))) {
      r.warnOnly = true;
      r.warnReason = 'Node TLS chain incomplete, but browser-verified working (browsers fetch the missing intermediate via AIA)';
      r.detail = `Node TLS: ${code}`;
      return r;
    }
    r.detail = `unreachable: ${code}`;
    r.netError = true;
    return r;
  }
  const acao = res.headers.get('access-control-allow-origin');
  const corsOk = acao === '*' || acao === ORIGIN;
  if (!res.ok) {
    r.detail = `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) r.detail += ' (token/WAF?)';
    return r;
  }
  if (expect === 'image') {
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) { r.detail = `expected image, got ${ct}`; return r; }
  } else {
    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch {
      r.detail = /Token Required/i.test(text) ? 'Token Required'
        : /Request Rejected/i.test(text) ? 'WAF rejected (HTML page)'
        : `non-JSON body (${(res.headers.get('content-type') || '?').split(';')[0]})`;
      return r;
    }
    // ArcGIS-style HTTP 200 + {error:{...}} — treat as failure.
    if (data && data.error) {
      r.detail = `200 + error ${data.error.code ?? ''}: ${String(data.error.message ?? '').slice(0, 60)}`;
      return r;
    }
  }
  if (corsRequired && !corsOk) {
    r.detail = `CORS: ACAO=${acao ?? 'absent'} (origin ${ORIGIN} not allowed)`;
    return r;
  }
  r.ok = true;
  r.detail = corsRequired ? `ACAO=${acao}` : 'reachable (img — CORS n/a)';
  return r;
}

const checks = [];

// --- Parcel counties (fetch-based: CORS required) -------------------------
for (const key of ACTIVE_PARCEL_COUNTIES) {
  const c = PARCEL_COUNTIES[key];
  checks.push({
    name: `${c.label} [${key}]`,
    kind: 'parcels',
    url: `${c.url}/query?where=1%3D1&returnCountOnly=true&f=json`,
    corsRequired: true
  });
}

// --- Admin boundaries ------------------------------------------------------
for (const [key, b] of Object.entries(ADMIN_BOUNDARIES)) {
  if (b.renderer === 'feature') {
    checks.push({
      name: `Admin: ${b.label}`,
      kind: 'admin',
      url: `${b.restUrl}/${b.featureLayer}/query?where=1%3D1&returnCountOnly=true&f=json`,
      corsRequired: true
    });
  } else {
    // Tile renderer (streets) — server-rendered /export images; CORS n/a.
    checks.push({
      name: `Admin: ${b.label} (service root)`,
      kind: 'admin',
      url: `${b.restUrl}?f=json`,
      corsRequired: false
    });
  }
}

// --- Overlays (esri-export + soil XYZ are <img>-loaded: CORS n/a) ----------
for (const [key, o] of Object.entries(OVERLAYS)) {
  if (o.type === 'esri-export') {
    checks.push({ name: `Overlay: ${key} (service root)`, kind: 'overlay', url: `${o.restUrl}?f=json`, corsRequired: false });
  } else {
    checks.push({
      name: `Overlay: ${key} (sample tile)`,
      kind: 'overlay',
      url: sub(o.url).replace('{x} {y} {z}', `${TILE.x} ${TILE.y} ${TILE.z}`)
                     .replace(`{x}+{y}+{z}`, `${TILE.x}+${TILE.y}+${TILE.z}`),
      corsRequired: false,
      expect: 'image'
    });
  }
}

// --- Basemaps + label overlay (<img>-loaded: CORS n/a) ---------------------
for (const [key, b] of Object.entries(BASEMAPS)) {
  checks.push({ name: `Basemap: ${key} (sample tile)`, kind: 'basemap', url: tileUrl(b.url), corsRequired: false, expect: 'image' });
}
checks.push({ name: 'Basemap: CARTO labels (sample tile)', kind: 'basemap', url: tileUrl(LABEL_LAYER.url), corsRequired: false, expect: 'image' });

// --- Point-lookup + search services (fetch-based: CORS required) -----------
checks.push({
  name: 'FEMA NFHL flood query',
  kind: 'lookup',
  url: `${FEMA_FLOOD_QUERY_URL}?geometry=${PT.lon},${PT.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE&returnGeometry=false&f=json`,
  corsRequired: true
});
checks.push({
  name: 'USGS EPQS elevation',
  kind: 'lookup',
  url: `${USGS_EPQS_URL}?x=${PT.lon}&y=${PT.lat}&units=Feet&wkid=4326&includeDate=false`,
  corsRequired: true
});
checks.push({
  name: 'Nominatim geocoder',
  kind: 'search',
  url: `${NOMINATIM_URL}?q=Annapolis%20MD&format=json&limit=1`,
  corsRequired: true
});
checks.push({
  // 2026-06-12 audit: geocoding.geo.census.gov sends NO ACAO header, so the
  // browser blocks this fetch from any web origin. search.js already catches
  // the failure and falls back to Nominatim, so address search still works —
  // WARN rather than FAIL. If a future audit shows ACAO present, Census
  // results (street-level precision) silently come back. No action needed.
  name: 'Census geocoder',
  kind: 'search',
  url: `${CENSUS_GEOCODER_URL}?address=1%20Main%20St%2C%20Annapolis%2C%20MD&benchmark=Public_AR_Current&format=json`,
  corsRequired: true,
  warnOnly: true,
  warnReason: 'no CORS from any web origin — search.js falls back to Nominatim'
});
checks.push({
  name: 'USDA Soil Data Access (SDA)',
  kind: 'lookup',
  url: SDA_URL,
  method: 'POST',
  body: JSON.stringify({ query: 'SELECT TOP 1 mukey FROM mapunit', format: 'JSON' }),
  headers: { 'Content-Type': 'application/json' },
  corsRequired: true
});
checks.push({
  // returnGeometry=false is load-bearing: TIGERweb's WAF rejects =true.
  // Query shape mirrors js/demographics.js lookupTract() exactly.
  name: 'TIGERweb census tracts (demographics step 1)',
  kind: 'lookup',
  url: `${TIGERWEB_TRACTS_URL}/query?geometry=${PT.lon}%2C${PT.lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=GEOID,STATE,COUNTY,TRACT&returnGeometry=false&f=json`,
  corsRequired: true
});
checks.push({
  // 2026-06-12: api.census.gov 302-redirects keyless requests to a "Missing
  // Key" HTML page. Until the user pastes a free key into CENSUS_ACS_KEY
  // (config.js), this check WARNs instead of failing — the app degrades to
  // "Demographics not available", it does not break.
  name: 'Census ACS 5-year (demographics step 2)',
  kind: 'lookup',
  url: `${CENSUS_ACS_BASE}?get=NAME,B01003_001E&for=tract:706103&in=state:24%20county:003`,
  corsRequired: true,
  warnOnly: true,
  warnReason: 'needs free API key in CENSUS_ACS_KEY (blocked on user) — app degrades gracefully'
});
checks.push({
  name: 'PAD-US protected lands',
  kind: 'overlay',
  url: `${PROTECTED_LANDS_URL}/query?where=1%3D1&returnCountOnly=true&f=json`,
  corsRequired: true
});

// --- Run -------------------------------------------------------------------
console.log(`\nLandCheck endpoint health audit`);
console.log(`Origin under test: ${ORIGIN}`);
console.log(`Checks: ${checks.length}\n`);

const results = [];
const POOL = 6;
let i = 0;
await Promise.all(Array.from({ length: POOL }, async () => {
  while (i < checks.length) {
    const c = checks[i++];
    results[checks.indexOf(c)] = await probe(c);
  }
}));

const pad = (s, n) => String(s).padEnd(n);
let failures = 0, warnings = 0, netErrors = 0;
for (const r of results) {
  let tag = ' PASS ';
  if (!r.ok) {
    if (r.warnOnly) { warnings++; tag = ' WARN '; r.detail += ` — ${r.warnReason}`; }
    else { failures++; tag = ' FAIL '; }
  }
  if (r.netError) netErrors++;
  console.log(`${tag}| ${pad(r.kind, 8)}| ${pad(r.name, 52)}| ${r.detail}`);
}

console.log(`\n${results.length - failures - warnings}/${results.length} passed, ${warnings} warnings (known degradations), ${failures} failures.`);
if (netErrors === results.length) {
  console.log('ALL checks unreachable — this environment likely blocks outbound network.');
  console.log('Re-run from an unrestricted terminal before demoting any county.');
}
process.exit(failures ? 1 : 0);
