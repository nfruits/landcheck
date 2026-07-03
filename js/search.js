// Search affordance. Address-shaped queries (start with digit, contain
// whitespace) hit the US Census geocoder first — free, no key, far better
// for US street addresses than Nominatim. Empty Census result falls back to
// Nominatim. A `lat,lon` shortcut bypasses both. Recent searches persist to
// localStorage (max 5, de-duped); focusing the empty input shows the history.

import { map } from './map.js';
import { inspectPoint } from './lookups.js';
import {
  NOMINATIM_URL,
  CENSUS_GEOCODER_URL,
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_MAX
} from './config.js';
import { escapeHtml } from './escape.js';

const searchInput   = document.getElementById('search');
const searchResults = document.getElementById('search-results');
const searchToggle  = document.getElementById('search-toggle');
const locatePanel   = document.getElementById('locate-panel');
let searchTimer;

function expandLocate() {
  if (!locatePanel) return;
  locatePanel.classList.add('expanded');
  requestAnimationFrame(() => searchInput?.focus());
}

function collapseLocate() {
  if (!locatePanel) return;
  locatePanel.classList.remove('expanded');
  searchResults?.classList.remove('active');
  if (searchInput) searchInput.value = '';
}

if (searchToggle) searchToggle.addEventListener('click', expandLocate);

// ────── Recent searches ─────────────────────────────────────────────
function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.slice(0, RECENT_SEARCHES_MAX) : [];
  } catch { return []; }
}
function saveRecent(query) {
  try {
    const list = loadRecent().filter(q => q !== query);
    list.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, RECENT_SEARCHES_MAX)));
  } catch {}
}


function showRecent() {
  const list = loadRecent();
  if (list.length === 0) {
    searchResults.classList.remove('active');
    return;
  }
  searchResults.innerHTML = list.map(q =>
    `<div class="search-result search-result-recent" data-recent="${escapeHtml(q)}">↺ ${escapeHtml(q)}</div>`
  ).join('');
  searchResults.classList.add('active');
  searchResults.querySelectorAll('.search-result-recent').forEach(el => {
    el.addEventListener('click', () => {
      const q = el.dataset.recent;
      searchInput.value = q;
      doSearch(q);
    });
  });
}

// Show recents whenever the input is empty and focused.
if (searchInput) {
  searchInput.addEventListener('focus', () => {
    if (!searchInput.value.trim()) showRecent();
  });
}

// ────── Coordinate shortcut ─────────────────────────────────────────
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length === 0) {
    showRecent();
    return;
  }
  if (q.length < 3) {
    searchResults.classList.remove('active');
    return;
  }
  const coordMatch = q.match(/^(-?\d+\.?\d*)[\s,]+(-?\d+\.?\d*)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      searchResults.innerHTML = `<div class="search-result" data-lat="${lat}" data-lon="${lon}">→ Go to ${lat.toFixed(5)}, ${lon.toFixed(5)}</div>`;
      searchResults.classList.add('active');
      bindResultClicks();
      return;
    }
  }
  searchTimer = setTimeout(() => doSearch(q), 350);
});

// ────── Geocoder cascade: Census first, then Nominatim ──────────────
// Heuristic: a query "looks like" a US street address if it starts with a
// number AND has at least one space (to rule out bare ZIP codes).
function looksLikeUsStreetAddress(q) {
  return /^\s*\d/.test(q) && /\s/.test(q.trim());
}

async function geocodeWithCensus(query) {
  const url = `${CENSUS_GEOCODER_URL}?address=${encodeURIComponent(query)}&benchmark=Public_AR_Current&format=json`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  const matches = data?.result?.addressMatches || [];
  return matches.map(m => ({
    lat: m.coordinates?.y,
    lon: m.coordinates?.x,
    display_name: m.matchedAddress,
    source: 'census'
  })).filter(r => r.lat != null && r.lon != null);
}

async function geocodeWithNominatim(query) {
  const url = `${NOMINATIM_URL}?format=json&countrycodes=us&limit=6&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!r.ok) return [];
  const data = await r.json();
  return (Array.isArray(data) ? data : []).map(d => ({
    lat: parseFloat(d.lat), lon: parseFloat(d.lon),
    display_name: d.display_name, source: 'nominatim'
  }));
}

async function doSearch(query) {
  try {
    let results = [];
    if (looksLikeUsStreetAddress(query)) {
      results = await geocodeWithCensus(query).catch(() => []);
    }
    if (results.length === 0) {
      results = await geocodeWithNominatim(query).catch(() => []);
    }
    if (!results.length) {
      searchResults.innerHTML = '<div class="search-result" style="opacity:0.5;cursor:default;">no matches</div>';
      searchResults.classList.add('active');
      return;
    }
    searchResults.innerHTML = results.map(d => {
      const tag = d.source === 'census' ? '<span class="result-source">Census</span>' : '';
      return `<div class="search-result" data-lat="${d.lat}" data-lon="${d.lon}" data-q="${escapeHtml(query)}">${tag}${escapeHtml(d.display_name)}</div>`;
    }).join('');
    searchResults.classList.add('active');
    bindResultClicks();
  } catch (err) {
    console.error(err);
  }
}

function bindResultClicks() {
  searchResults.querySelectorAll('.search-result[data-lat]').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lon = parseFloat(el.dataset.lon);
      const q = el.dataset.q;
      if (q) saveRecent(q);
      map.setView([lat, lon], 18);
      collapseLocate();
      inspectPoint(lat, lon);
    });
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#locate-panel')) {
    searchResults?.classList.remove('active');
    locatePanel?.classList.remove('expanded');
  }
});

export const searchApi = {
  loadRecent,
  saveRecent,
  looksLikeUsStreetAddress
};
