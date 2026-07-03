// Lazy-loaded Census ACS 5-year demographics for the clicked point. Two-step
// lookup: TIGERweb tract → ACS variables. The fly-out's Demographics section
// is collapsed by default so no network call fires until the user expands it.
// Results are cached per-session by GEOID (no localStorage — ACS responses
// are bulky and tract-level, not worth persisting across reloads).

import { TIGERWEB_TRACTS_URL, CENSUS_ACS_BASE, CENSUS_ACS_KEY } from './config.js';

const ACS_VARS = [
  'B01003_001E', // total population
  'B19013_001E', // median household income
  'B01002_001E', // median age
  'B15003_001E', // education denominator (population 25+)
  'B15003_022E', // bachelor's
  'B15003_023E', // master's
  'B15003_024E', // professional
  'B15003_025E', // doctorate
  'B23025_002E', // labor force
  'B23025_004E', // employed
  'B25003_001E', // occupied housing units (denominator)
  'B25003_002E'  // owner-occupied
];

const FIELDS = ['d-population', 'd-income', 'd-age', 'd-education', 'd-employment', 'd-housing'];

const cache = new Map();
let currentLat = null;
let currentLng = null;
let currentRequest = null;

function fmtCount(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n).toLocaleString('en-US');
}
function fmtMoney(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
function fmtAge(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(1)} yr`;
}
function fmtPct(num, denom) {
  if (!Number.isFinite(num) || !Number.isFinite(denom) || denom <= 0) return null;
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function setRow(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value === null || value === undefined || value === '') {
    el.textContent = '—';
    el.classList.add('empty');
  } else {
    el.textContent = value;
    el.classList.remove('empty');
  }
}

function setLoading() {
  for (const id of FIELDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.innerHTML = '<span class="loading"></span>';
    el.classList.remove('empty');
  }
  const note = document.getElementById('demographics-note');
  if (note) { note.textContent = 'Loading demographics…'; note.classList.remove('empty'); }
}

function setUnavailable() {
  for (const id of FIELDS) setRow(id, null);
  const note = document.getElementById('demographics-note');
  if (note) { note.textContent = 'Demographics not available for this location.'; note.classList.remove('empty'); }
}

function render(data) {
  setRow('d-population', fmtCount(data.population));
  setRow('d-income',     fmtMoney(data.income));
  setRow('d-age',        fmtAge(data.age));
  setRow('d-education',  fmtPct(data.bachelorsOrHigher, data.educationDenom));
  setRow('d-employment', fmtPct(data.employed, data.laborForce));
  setRow('d-housing',    fmtPct(data.ownerOccupied, data.housingDenom));
  const note = document.getElementById('demographics-note');
  if (note) {
    note.textContent = `US Census ACS 5-year · tract ${data.geoid}`;
    note.classList.remove('empty');
  }
}

async function lookupTract(lat, lng) {
  const url = `${TIGERWEB_TRACTS_URL}/query`
    + `?geometry=${encodeURIComponent(lng + ',' + lat)}`
    + `&geometryType=esriGeometryPoint&inSR=4326`
    + `&spatialRel=esriSpatialRelIntersects`
    + `&outFields=GEOID,STATE,COUNTY,TRACT`
    + `&returnGeometry=false&f=json`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.error || !data.features || data.features.length === 0) return null;
  const attrs = data.features[0].attributes;
  let geoid = attrs.GEOID || attrs.GEOID20 || null;
  let state = attrs.STATE || (geoid && geoid.slice(0, 2));
  let county = attrs.COUNTY || (geoid && geoid.slice(2, 5));
  let tract = attrs.TRACT || (geoid && geoid.slice(5));
  if (!state || !county || !tract) return null;
  if (!geoid) geoid = `${state}${county}${tract}`;
  return { geoid, state, county, tract };
}

async function lookupAcs(tract) {
  // 2026-06: api.census.gov 302-redirects keyless requests to an HTML
  // "Missing Key" page. fetch() follows the redirect, lands on HTTP 200 HTML,
  // and r.json() throws (caught upstream → "not available"). Detect the
  // redirect explicitly so the failure mode is deliberate, not incidental.
  // state/county/tract come from the TIGERweb ArcGIS response, i.e. external
  // data — encode them so a malformed value can't inject extra query params
  // into the Census fetch URL (2026-07-01 security sweep).
  const url = `${CENSUS_ACS_BASE}?get=${ACS_VARS.join(',')}`
    + `&for=tract:${encodeURIComponent(tract.tract)}`
    + `&in=state:${encodeURIComponent(tract.state)}+county:${encodeURIComponent(tract.county)}`
    + (CENSUS_ACS_KEY ? `&key=${encodeURIComponent(CENSUS_ACS_KEY)}` : '');
  const r = await fetch(url);
  if (!r.ok || r.redirected) return null;
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const header = rows[0];
  const row = rows[1];
  const at = (name) => {
    const i = header.indexOf(name);
    if (i < 0) return NaN;
    const v = Number(row[i]);
    return Number.isFinite(v) ? v : NaN;
  };
  return {
    geoid: tract.geoid,
    population: at('B01003_001E'),
    income: at('B19013_001E'),
    age: at('B01002_001E'),
    educationDenom: at('B15003_001E'),
    bachelorsOrHigher: at('B15003_022E') + at('B15003_023E') + at('B15003_024E') + at('B15003_025E'),
    laborForce: at('B23025_002E'),
    employed: at('B23025_004E'),
    housingDenom: at('B25003_001E'),
    ownerOccupied: at('B25003_002E')
  };
}

async function loadFor(lat, lng) {
  setLoading();
  const tract = await lookupTract(lat, lng);
  if (!tract) { setUnavailable(); return; }
  if (cache.has(tract.geoid)) { render(cache.get(tract.geoid)); return; }
  const data = await lookupAcs(tract);
  if (!data || !Number.isFinite(data.population)) { setUnavailable(); return; }
  cache.set(tract.geoid, data);
  render(data);
}

// Called by lookups.js on every map click so the section knows which point it
// would fetch for if expanded. Also collapses the section + clears any
// previously-rendered data so the user doesn't see stale info from a prior
// click after expanding for a new point.
export function setDemographicsContext(lat, lng) {
  currentLat = lat;
  currentLng = lng;
  currentRequest = null;
  for (const id of FIELDS) setRow(id, null);
  const note = document.getElementById('demographics-note');
  if (note) { note.textContent = ''; note.classList.add('empty'); }
  const body = document.getElementById('demographics-body');
  const toggle = document.getElementById('demographics-toggle');
  if (body) body.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function onToggleClick() {
  const body = document.getElementById('demographics-body');
  const toggle = document.getElementById('demographics-toggle');
  if (!body || !toggle) return;
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    body.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    return;
  }
  body.hidden = false;
  toggle.setAttribute('aria-expanded', 'true');
  if (currentLat == null || currentLng == null) { setUnavailable(); return; }
  const requestId = Symbol('demographics-request');
  currentRequest = requestId;
  loadFor(currentLat, currentLng).catch(() => {
    if (currentRequest === requestId) setUnavailable();
  });
}

const toggleEl = document.getElementById('demographics-toggle');
if (toggleEl) toggleEl.addEventListener('click', onToggleClick);

export const demographicsApi = { setContext: setDemographicsContext, _cache: cache };
