// Parcels layer. Multi-county runtime — on every refresh, intersects the
// current view bbox against each ACTIVE_PARCEL_COUNTIES bbox and queries the
// matching county endpoints in parallel. Each fetched feature remembers its
// source county (so the readout/compare modal looks up the right fieldMap),
// and the ID-derivation logic supports both direct fields (fieldMap
// candidates) and per-county derive() hooks for synthesized values
// (e.g. Fairfax acres from Shape__Area). Truncated responses trigger
// recursive quadtree subdivision capped at depth 4 (max 341 calls). Pinned
// parcels persist to localStorage for the compare modal.

import { map } from './map.js';
import { PARCEL_COUNTIES, ACTIVE_PARCEL_COUNTIES, PARCELS_MIN_ZOOM, COUNTY_VERIFIED_STORAGE_PREFIX } from './config.js';
import { showToast } from './overlays.js';
import { openFlyout, applyFlyoutHeader, resetFlyoutContext } from './flyout.js';
import { setSaveContext, setNearestAddress } from './save-place.js';
import { reverseGeocode } from './reverse-geocode.js';
import { escapeHtml } from './escape.js';

const layerGroup = L.featureGroup();
let active = false;
let highlighted = null;
let lastFetchToken = 0;

// Two-tone on the map: copper outline at rest (brand), teal fill when selected
// (interactive highlight) — matches the UI accent system.
// fill:true with a near-invisible fillOpacity is load-bearing: fill:false
// renders SVG fill="none", which makes only the 1.2px stroke hit-testable —
// clicks INSIDE a parcel fell through to the map and dropped a coordinate pin
// instead of selecting the parcel (2026-07-01 design-audit finding). The 0.04
// fill is visually imperceptible over satellite imagery but makes the whole
// polygon clickable and hoverable.
const STYLE_DEFAULT = { color: '#e0a23c', weight: 1.2, opacity: 0.9, fill: true, fillColor: '#e0a23c', fillOpacity: 0.04 };
// Hover: brightened copper (stays in the copper=brand lane; teal is reserved
// for the selected state).
const STYLE_HOVER = { color: '#f0b95e', weight: 2.2, opacity: 1, fill: true, fillColor: '#e0a23c', fillOpacity: 0.12 };
const STYLE_HIGHLIGHT = { color: '#2dd4bf', weight: 2.5, fill: true, fillColor: '#2dd4bf', fillOpacity: 0.16, opacity: 1 };

const panel = {
  id:     document.getElementById('p-id'),
  acres:  document.getElementById('p-acres'),
  owner:  document.getElementById('p-owner'),
  value:  document.getElementById('p-value'),
  county: document.getElementById('p-county')
};

const STORAGE_KEY = 'parcel.pinned';
const MAX_PINS = 3;
let currentSelection = null; // { countyKey, props } for the currently-clicked parcel
let pinned = loadPinned();
const pinBtn = document.getElementById('pin-parcel');
const compareBtn = document.getElementById('compare-parcels');
const pinList = document.getElementById('pin-list');
const compareModal = document.getElementById('compare-modal');

function activeCounties() {
  return ACTIVE_PARCEL_COUNTIES.map(k => [k, PARCEL_COUNTIES[k]]);
}

function coverageLabels() {
  return activeCounties().map(([, c]) => c.label).join(', ');
}

// Concise coverage summary for the out-of-coverage toast. The active list is
// now 60+ entries across 32 states, so listing every label would overflow the
// toast — summarise by distinct state count instead.
function coverageSummary() {
  const states = new Set(activeCounties().map(([, c]) => c.state)).size;
  return `${states} states`;
}

function bboxesIntersectsView(bbox) {
  if (!bbox) return true;
  const b = map.getBounds();
  const [minX, minY, maxX, maxY] = bbox;
  return !(b.getEast() < minX || b.getWest() > maxX ||
           b.getNorth() < minY || b.getSouth() > maxY);
}

function viewInsideAnyCoverage() {
  return activeCounties().some(([, c]) => bboxesIntersectsView(c.bbox));
}

function countiesInView() {
  return activeCounties().filter(([, c]) => bboxesIntersectsView(c.bbox));
}

function loadPinned() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePinned() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned)); } catch {}
  renderPinList();
  syncPinButton();
}

function pinCurrent() {
  if (!currentSelection) return;
  if (pinned.length >= MAX_PINS) {
    showToast(`Already at ${MAX_PINS} pinned parcels — unpin one first`);
    return;
  }
  const id = lookupField(currentSelection.countyKey, 'id', currentSelection.props);
  if (pinned.some(p => p.id === id && p.county === currentSelection.countyKey)) {
    showToast('Parcel already pinned');
    return;
  }
  pinned.push({ id, county: currentSelection.countyKey, props: currentSelection.props });
  savePinned();
}

function unpin(idx) {
  pinned.splice(idx, 1);
  savePinned();
}

function renderPinList() {
  if (pinList) {
    pinList.innerHTML = '';
    for (let i = 0; i < pinned.length; i++) {
      const p = pinned[i];
      const chip = document.createElement('span');
      chip.className = 'pin-chip';
      chip.textContent = p.id || '?';
      const x = document.createElement('button');
      x.className = 'pin-chip-x';
      x.textContent = '×';
      x.title = 'Unpin';
      x.addEventListener('click', (e) => { e.stopPropagation(); unpin(i); });
      chip.appendChild(x);
      pinList.appendChild(chip);
    }
  }
  if (compareBtn) {
    compareBtn.disabled = pinned.length === 0;
    // Empty-state hint: only when nothing's pinned, surface what the pill does.
    if (pinned.length === 0) {
      compareBtn.setAttribute('title', 'Pin parcels to compare them side-by-side. Click a parcel → Pin to compare.');
    } else {
      compareBtn.removeAttribute('title');
    }
  }
  const countEl = document.getElementById('pin-count');
  if (countEl) countEl.textContent = String(pinned.length);
}

function syncPinButton() {
  if (!pinBtn) return;
  pinBtn.disabled = !currentSelection || pinned.length >= MAX_PINS;
}

function valueFor(p, kind) {
  return lookupField(p.county, kind, p.props);
}

function openCompareModal() {
  if (!compareModal || pinned.length === 0) return;
  const rows = [
    ['County',   p => PARCEL_COUNTIES[p.county]?.label || p.county],
    ['Owner',    p => valueFor(p, 'owner')],
    ['Acreage',  p => { const v = valueFor(p, 'acres'); return v == null ? '—' : fmtAcres(v); }],
    ['Assessed Value', p => { const v = valueFor(p, 'value'); return v == null ? '—' : fmtUSD(v); }]
  ];
  const head = `<tr><th></th>${pinned.map(p => `<th>${escapeHtml(p.id || '—')}</th>`).join('')}</tr>`;
  const body = rows.map(([label, get]) =>
    `<tr><td class="row-label">${label}</td>${pinned.map(p => `<td>${escapeHtml(String(get(p) ?? '—'))}</td>`).join('')}</tr>`
  ).join('');
  compareModal.querySelector('.compare-table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  compareModal.classList.add('open');
}

// Saved-places-sourced compare: My Places fires a CustomEvent with selected
// entry IDs; we resolve them to entries, build a column per entry, and reuse
// the same modal shell.
function openCompareSavedPlaces(ids) {
  if (!compareModal || !Array.isArray(ids) || ids.length === 0) return;
  // Lazy-import to avoid a top-level cycle.
  import('./saved-places.js').then(({ savedPlaces }) => {
    const entries = ids.map(id => savedPlaces.get(id)).filter(Boolean);
    if (entries.length === 0) return;
    const headerFor = (e) => e.label || e.parcelId || (e.lat != null ? `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` : '—');
    const get = (e, kind) => {
      if (!e.parcelMeta) return null;
      const county = e.parcelMeta.county;
      return county ? lookupField(county, kind, e.parcelMeta) : null;
    };
    const rows = [
      ['Label', e => e.label || '—'],
      ['Notes', e => e.notes || '—'],
      ['County', e => e.parcelMeta?.county ? (PARCEL_COUNTIES[e.parcelMeta.county]?.label || e.parcelMeta.county) : '—'],
      ['Owner', e => get(e, 'owner') ?? '—'],
      ['Acreage', e => { const v = get(e, 'acres'); return v == null ? '—' : fmtAcres(v); }],
      ['Assessed Value', e => { const v = get(e, 'value'); return v == null ? '—' : fmtUSD(v); }]
    ];
    const head = `<tr><th></th>${entries.map(e => `<th>${escapeHtml(headerFor(e))}</th>`).join('')}</tr>`;
    const body = rows.map(([label, fn]) =>
      `<tr><td class="row-label">${label}</td>${entries.map(e => `<td>${escapeHtml(String(fn(e) ?? '—'))}</td>`).join('')}</tr>`
    ).join('');
    compareModal.querySelector('.compare-table').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
    compareModal.classList.add('open');
  });
}

window.addEventListener('parcel:compareSavedPlaces', (e) => {
  openCompareSavedPlaces(e.detail?.ids || []);
});

function closeCompareModal() {
  if (compareModal) compareModal.classList.remove('open');
}


if (pinBtn) pinBtn.addEventListener('click', pinCurrent);
if (compareBtn) compareBtn.addEventListener('click', openCompareModal);
if (compareModal) {
  compareModal.querySelector('.compare-close')?.addEventListener('click', closeCompareModal);
  compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) closeCompareModal();
  });
}

renderPinList();
syncPinButton();

function clearPanel() {
  if (!panel.id) return;
  for (const el of Object.values(panel)) {
    el.textContent = '—';
    el.classList.add('empty');
  }
  panel.id.textContent = '— click a parcel';
  const zoningRow = document.getElementById('p-zoning-row');
  const zoningLink = document.getElementById('p-zoning');
  if (zoningRow) zoningRow.hidden = true;
  if (zoningLink) {
    zoningLink.removeAttribute('href');
    zoningLink.removeAttribute('data-resolved');
  }
}

function pickField(props, candidates) {
  for (const k of candidates) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') return props[k];
  }
  return null;
}

// Geometry-derived acreage (spherical excess — same math as draw.js
// polygonAreaSqMeters, but over GeoJSON [lng,lat] rings). Several sources
// expose no usable area field (TX/IN/UT/AK/CT statewide, some VA/PA
// localities), yet the polygon geometry is always in hand: refresh() injects
// the computed value as props.__geomAcres and lookupField('acres') uses it
// as the last-resort fallback after fieldMap and derive.
const SQM_PER_ACRE = 4046.8564224;

function ringAreaSqM(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  const R = 6378137;
  const toRad = d => d * Math.PI / 180;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs(area * R * R / 2);
}

function geomAcres(geometry) {
  if (!geometry) return null;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  let sqm = 0;
  for (const rings of polys) {
    if (!Array.isArray(rings) || !rings.length) continue;
    sqm += ringAreaSqM(rings[0]);
    for (let i = 1; i < rings.length; i++) sqm -= ringAreaSqM(rings[i]); // holes
  }
  const acres = sqm / SQM_PER_ACRE;
  // Degenerate/zero geometry (< ~4 sqm) produces no estimate rather than a
  // misleading "0.000 ac".
  return acres > 0.001 ? acres : null;
}

// Look up a logical field for a parcel from its source county. Field-map
// lookup runs first; then the county's `derive` hook; for acreage only, the
// geometry-derived estimate injected by refresh() is the final fallback.
// Returns null when no path produces a value.
function lookupField(countyKey, kind, props) {
  const county = PARCEL_COUNTIES[countyKey];
  if (!county) return null;
  const candidates = county.fieldMap?.[kind] || [];
  const fromFields = pickField(props, candidates);
  if (fromFields !== null) return fromFields;
  const derive = county.derive?.[kind];
  if (typeof derive === 'function') {
    const v = derive(props);
    if (v !== undefined && v !== null) return v;
  }
  if (kind === 'acres' && Number.isFinite(props?.__geomAcres) && props.__geomAcres > 0) {
    return props.__geomAcres;
  }
  return null;
}

function setRow(el, value, formatter) {
  if (value === null || value === undefined || value === '') {
    el.textContent = '—';
    el.classList.add('empty');
  } else {
    el.textContent = formatter ? formatter(value) : String(value);
    el.classList.remove('empty');
  }
}

function fmtAcres(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(3)} ac` : String(v);
}

function fmtUSD(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function populatePanel(countyKey, props) {
  if (!panel.id) return;
  const id = lookupField(countyKey, 'id', props);
  setRow(panel.id, id);

  // Zoning cross-link: render only if the county defines a zoningUrl
  // template. {PARCEL_ID} is substituted with the clicked parcel's ID.
  // Belt-and-suspenders: the HTML link has NO default href (so a click
  // before populatePanel ever runs is a no-op rather than navigating the
  // current page to '#' in a new tab, which is what the prior `href="#"`
  // placeholder did when the user reported Bug 2 on 2026-05-17).
  const zoningRow = document.getElementById('p-zoning-row');
  const zoningLink = document.getElementById('p-zoning');
  const tpl = PARCEL_COUNTIES[countyKey]?.zoningUrl;
  // Only accept http(s) zoning URLs — guards against a javascript:/data: URL
  // sneaking in via a compromised county config template (2026-07-01 sweep).
  const resolved = tpl && id ? tpl.replace('{PARCEL_ID}', encodeURIComponent(id)) : null;
  if (zoningRow && zoningLink && resolved && /^https?:\/\//i.test(resolved)) {
    zoningLink.href = resolved;
    zoningLink.setAttribute('data-resolved', '1');
    zoningRow.hidden = false;
  } else if (zoningRow) {
    if (zoningLink) {
      zoningLink.removeAttribute('href');
      zoningLink.removeAttribute('data-resolved');
    }
    zoningRow.hidden = true;
  }
  // Acreage is the most important parcel field — surface 'not reported'
  // explicitly rather than the generic em-dash when the county doesn't
  // expose it. The row stays prominent regardless of data availability.
  const acres = lookupField(countyKey, 'acres', props);
  if (acres == null || acres === '') {
    panel.acres.textContent = 'not reported';
    panel.acres.classList.add('empty');
  } else {
    panel.acres.textContent = fmtAcres(acres);
    panel.acres.classList.remove('empty');
  }
  setRow(panel.owner, lookupField(countyKey, 'owner', props));
  setRow(panel.value, lookupField(countyKey, 'value', props), fmtUSD);
  if (panel.county) setRow(panel.county, PARCEL_COUNTIES[countyKey]?.label);
}

function highlight(layer) {
  if (highlighted) highlighted.setStyle(STYLE_DEFAULT);
  layer.setStyle(STYLE_HIGHLIGHT);
  highlighted = layer;
}

function buildQueryUrl(county, bbox) {
  // No resultRecordCount: older ArcGIS Server endpoints (e.g. Charlottesville
  // City's MapServer/72) return HTTP 200 with a `{error: {code: 400}}` body
  // when `resultRecordCount=1000` is combined with `f=geojson` for any
  // bbox that would actually return ≥500 features. Our fetchInBbox parses
  // the error body, sees no features key, and silently renders nothing —
  // the Bug 4 / 2026-05-17 "Charlottesville parcels missing" repro. Without
  // resultRecordCount, the server returns up to its maxRecordCount default,
  // and our quadtree subdivides via `exceededTransferLimit` / the 950
  // length-based heuristic in `looksTruncated`.
  // NOTE: no `outSR`. GeoJSON output is WGS84 by spec (RFC 7946 §4), so ArcGIS
  // returns 4326 coordinates for f=geojson regardless of outSR — the param is
  // redundant. Worse, on some servers (notably NY ITS NYS_Tax_Parcels_Public)
  // the f=geojson + outSR=4326 combination triggers a pathologically slow
  // reprojection path that times out (>40s), while f=geojson alone returns the
  // same WGS84 geometry in <0.5s. Dropping outSR fixes those endpoints and is
  // a no-op for every other one (verified live across all 31 statewide + MD/VA
  // services on 2026-06-13). Diagnosed when wiring the nationwide expansion.
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson'
  });
  return `${county.url}/query?${params.toString()}`;
}

// Quadtree subdivision: if a /query response hits the server's maxRecordCount
// (typically 1000–2000), features get silently truncated. Detect either via
// the exceededTransferLimit field (ESRI-native shape) or a feature count at
// or above THRESHOLD as a proxy. Subdivide the bbox into 4 quadrants and
// recurse; dedupe by feature ID at the merge step. Depth cap prevents runaway
// fetches: max 1 + 4 + 16 + 64 + 256 = 341 queries before we just accept the
// truncated result.
const TRANSFER_LIMIT_THRESHOLD = 950;
const MAX_QUADTREE_DEPTH = 4;

function looksTruncated(data) {
  if (!data) return false;
  if (data.exceededTransferLimit === true) return true;
  if (data.properties?.exceededTransferLimit === true) return true;
  return Array.isArray(data.features) && data.features.length >= TRANSFER_LIMIT_THRESHOLD;
}

function subdivide(bbox) {
  const midX = (bbox.minX + bbox.maxX) / 2;
  const midY = (bbox.minY + bbox.maxY) / 2;
  return [
    { minX: bbox.minX, minY: bbox.minY, maxX: midX,        maxY: midY },
    { minX: midX,      minY: bbox.minY, maxX: bbox.maxX,   maxY: midY },
    { minX: bbox.minX, minY: midY,      maxX: midX,        maxY: bbox.maxY },
    { minX: midX,      minY: midY,      maxX: bbox.maxX,   maxY: bbox.maxY }
  ];
}

// Per-request timeout. fetch() has no default timeout, so a single hanging
// county endpoint would block the whole Promise.all in refresh() forever and
// blank the entire parcels layer (one slow server hides everyone's parcels).
// With 60+ wired endpoints the odds of one being slow/down are real, so bound
// each request: on timeout it rejects, refresh()'s catch records it in the
// "unreachable" toast, and every other county still renders. (Surfaced when
// PWC's server hung during the 2026-06-12 nationwide expansion.)
const FETCH_TIMEOUT_MS = 15000;

async function fetchInBbox(county, bbox, depth = 0) {
  const r = await fetch(buildQueryUrl(county, bbox), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const data = await r.json();
  if (!data || !data.features) return [];
  if (looksTruncated(data) && depth < MAX_QUADTREE_DEPTH) {
    const quads = subdivide(bbox);
    const subResults = await Promise.all(
      quads.map(q => fetchInBbox(county, q, depth + 1).catch(() => []))
    );
    return subResults.flat();
  }
  return data.features;
}

function dedupeByCountyId(countyKey, features) {
  const county = PARCEL_COUNTIES[countyKey];
  const idCandidates = county?.fieldMap?.id || ['OBJECTID'];
  const seen = new Map();
  for (const f of features) {
    let id = null;
    for (const k of idCandidates) {
      if (f.properties?.[k] != null) { id = f.properties[k]; break; }
    }
    if (id == null) id = JSON.stringify(f.geometry);
    if (!seen.has(id)) seen.set(id, f);
  }
  return Array.from(seen.values());
}

// Loading pill: parcel fetches take seconds over slow county servers; without
// visible feedback users assume the toggle is broken and re-click (2026-07-01
// design-audit finding). Teal = live-data semantic.
const statusEl = document.getElementById('parcel-status');
function setLoading(on) {
  if (statusEl) statusEl.hidden = !on;
}

async function refresh() {
  if (!active) return;
  if (map.getZoom() < PARCELS_MIN_ZOOM) {
    layerGroup.clearLayers();
    setLoading(false);
    return;
  }
  const inView = countiesInView();
  if (inView.length === 0) {
    layerGroup.clearLayers();
    setLoading(false);
    return;
  }
  const b = map.getBounds();
  const bbox = { minX: b.getWest(), minY: b.getSouth(), maxX: b.getEast(), maxY: b.getNorth() };
  const token = ++lastFetchToken;
  setLoading(true);
  const failures = [];
  const results = await Promise.all(inView.map(async ([key, county]) => {
    try {
      const features = await fetchInBbox(county, bbox);
      // Auto-verify: if an "Untested" county returns real features, flip
      // its status in localStorage so the Coverage modal shows it verified.
      if (county.verified === false && features.length > 0) {
        try { localStorage.setItem(COUNTY_VERIFIED_STORAGE_PREFIX + key, '1'); } catch {}
      }
      return [key, { features: dedupeByCountyId(key, features) }];
    } catch {
      failures.push(county.label);
      return [key, null];
    }
  }));
  if (token !== lastFetchToken) return; // a newer fetch is in flight
  setLoading(false);
  layerGroup.clearLayers();
  // The refresh rebuilds every layer, which would silently drop the teal
  // selection on pan/zoom — re-apply it to the rebuilt layer for the selected
  // parcel (matched by county + id).
  const selectedId = currentSelection
    ? lookupField(currentSelection.countyKey, 'id', currentSelection.props) : null;
  for (const [key, data] of results) {
    if (!data || !data.features) continue;
    for (const f of data.features) {
      // Inject the geometry-derived acreage before the layer is built so it
      // rides along with every props copy (fly-out, compare pins, saved
      // places) without those call sites needing the geometry.
      const props = f.properties || (f.properties = {});
      if (props.__geomAcres === undefined) props.__geomAcres = geomAcres(f.geometry);
      const layer = L.geoJSON(f, { style: STYLE_DEFAULT }).getLayers()[0];
      if (!layer) continue;
      if (selectedId != null && currentSelection.countyKey === key &&
          lookupField(key, 'id', f.properties || {}) === selectedId) {
        layer.setStyle(STYLE_HIGHLIGHT);
        highlighted = layer;
      }
      // Hover affordance (desktop): brightened copper glide via the CSS
      // transition on path.leaflet-interactive. Selected parcel keeps teal.
      layer.on('mouseover', () => {
        if (layer !== highlighted) { layer.setStyle(STYLE_HOVER); layer.bringToFront(); }
      });
      layer.on('mouseout', () => {
        if (layer !== highlighted) layer.setStyle(STYLE_DEFAULT);
      });
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        highlight(layer);
        const props = f.properties || {};
        populatePanel(key, props);
        currentSelection = { countyKey: key, props };
        syncPinButton();
        const id = lookupField(key, 'id', props);
        const ll = e.latlng || layer.getBounds().getCenter();
        const parcelMeta = { county: key, ...props };
        resetFlyoutContext();
        applyFlyoutHeader({ lat: ll.lat, lng: ll.lng, parcelId: id, parcelMeta });
        setSaveContext(ll.lat, ll.lng, { parcelId: id, parcelMeta });
        openFlyout();
        // Fire reverse-geocode for the parcel-center; Save form placeholder
        // gets the address; the header stays "Parcel … — Owner" since parcel
        // outranks address in the hierarchy.
        reverseGeocode(ll.lat, ll.lng).then(result => {
          if (!result) return;
          setNearestAddress(result.address);
        });
      });
      layerGroup.addLayer(layer);
    }
  }
  if (failures.length) showToast(`Parcels: ${failures.join(', ')} unreachable`);
}

function activate() {
  active = true;
  layerGroup.addTo(map);
  if (map.getZoom() < PARCELS_MIN_ZOOM) {
    showToast(`Zoom to ${PARCELS_MIN_ZOOM}+ to load parcels`);
  } else if (!viewInsideAnyCoverage()) {
    showToast(`No parcel coverage at this location. ${coverageSummary()} are wired — search for an address in a covered area, or open Coverage for the full list.`);
  } else {
    refresh();
  }
}

function deactivate() {
  active = false;
  setLoading(false);
  map.removeLayer(layerGroup);
  layerGroup.clearLayers();
  highlighted = null;
  currentSelection = null;
  clearPanel();
  syncPinButton();
}

map.on('moveend', refresh);
map.on('zoomend', () => {
  if (!active) return;
  if (map.getZoom() < PARCELS_MIN_ZOOM) {
    layerGroup.clearLayers();
  } else {
    refresh();
  }
});

const parcelEl = document.querySelector('.layer[data-layer="parcels"]');
if (parcelEl) {
  // Set a concise coverage tooltip. The active list is now 60+ entries, so
  // summarise (states wired statewide vs. per-locality) rather than dumping
  // every label. The Coverage modal has the full breakdown.
  const labelEl = parcelEl.querySelector('.layer-label');
  if (labelEl) {
    const active = activeCounties();
    const stateCount = new Set(active.map(([, c]) => c.state)).size;
    labelEl.title = `Coverage: ${stateCount} states (incl. statewide MD + 32 others, plus 30 Virginia localities). Toggle on at zoom 14+ to load parcels. Click Coverage for the full list.`;
  }
  parcelEl.addEventListener('click', () => {
    if (parcelEl.classList.contains('active')) {
      deactivate();
      parcelEl.classList.remove('active');
    } else {
      activate();
      parcelEl.classList.add('active');
    }
  });
}

clearPanel();

export const parcels = {
  isActive: () => active,
  activeCounties: () => ACTIVE_PARCEL_COUNTIES.slice(),
  countLoaded: () => layerGroup.getLayers().length,
  highlightedProps: () => highlighted ? highlighted.feature?.properties : null,
  pinned: () => pinned.slice(),
  pinCurrent,
  reloadPinnedFromStorage: () => { pinned = loadPinned(); renderPinList(); syncPinButton(); }
};
