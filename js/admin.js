// Admin-boundary overlays — States, Counties, Cities/Places, Streets. Four
// independent toggles, each gated by a per-tier minZoom (user-overridable via
// the gear icon). Feature-rendered tiers (States/Counties/Places) fetch the
// whole-country GeoJSON once, cache to localStorage with a 7-day TTL +
// ADMIN_CACHE_VERSION key, and render with Leaflet's Canvas renderer so
// pan/zoom is fully local after first activation. Streets is tile-rendered
// (server-default styling). Cache migration runs at module load.
import { map } from './map.js';
import {
  ADMIN_BOUNDARIES,
  ADMIN_ATTRIBUTION,
  ADMIN_TOGGLES_STORAGE_KEY,
  ADMIN_MINZOOM_OVERRIDES_STORAGE_KEY,
  ADMIN_CACHE_VERSION,
  ADMIN_CACHE_VERSION_STORAGE_KEY
} from './config.js';
import { showToast } from './overlays.js';

const LAYER_KEYS = Object.keys(ADMIN_BOUNDARIES);

// User-supplied minZoom overrides; falls back to ADMIN_BOUNDARIES default when
// absent. Persisted as { states: 5, counties: 7, ... }.
const minZoomOverride = {};

function loadOverrides() {
  try {
    const raw = localStorage.getItem(ADMIN_MINZOOM_OVERRIDES_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of LAYER_KEYS) {
      if (Number.isFinite(saved[k])) minZoomOverride[k] = saved[k];
    }
  } catch {}
}

function saveOverrides() {
  try { localStorage.setItem(ADMIN_MINZOOM_OVERRIDES_STORAGE_KEY, JSON.stringify(minZoomOverride)); } catch {}
}

function effectiveMinZoom(key) {
  const o = minZoomOverride[key];
  return Number.isFinite(o) ? o : ADMIN_BOUNDARIES[key].minZoom;
}

function makeTileLayer(cfg) {
  const layerIds = cfg.layerIds;
  const ExportLayer = L.GridLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('img');
      const size = this.getTileSize();
      const nwPoint = coords.scaleBy(size);
      const sePoint = nwPoint.add(size);
      const nw = this._map.options.crs.project(this._map.unproject(nwPoint, coords.z));
      const se = this._map.options.crs.project(this._map.unproject(sePoint, coords.z));
      const bbox = `${nw.x},${se.y},${se.x},${nw.y}`;
      const layerParam = layerIds ? `&layers=show:${layerIds.join(',')}` : '';
      const url = `${cfg.restUrl}/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${size.x},${size.y}&format=png32&transparent=true&f=image${layerParam}`;
      tile.onload = () => done(null, tile);
      tile.onerror = () => done(new Error('tile failed'), tile);
      tile.src = url;
      tile.style.opacity = cfg.opacity;
      return tile;
    }
  });
  return new ExportLayer({ opacity: cfg.opacity, attribution: ADMIN_ATTRIBUTION });
}

function makeFeatureLayer(key, cfg) {
  const group = L.featureGroup();
  group._fetchToken = 0;
  group._key = key;
  return group;
}

// Cache layer: states and counties are small enough (states ~50 features at
// low LOD, counties ~3000) to fetch once and stash in localStorage. Pan/zoom
// then re-renders from cache with no network and no bbox refetch — which was
// the source of the visible lag on the dark dragging feel.
const FEATURE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKeyFor(key) { return `admin.cache.${key}`; }

// Version migration: if ADMIN_CACHE_VERSION bumps, evict every admin.cache.*
// entry on first boot so prior-shape GeoJSON doesn't render with the new
// styling assumptions. Runs synchronously before any layer loads its cache.
function maybeMigrateCache() {
  let stored;
  try { stored = Number(localStorage.getItem(ADMIN_CACHE_VERSION_STORAGE_KEY)); } catch { return; }
  if (stored === ADMIN_CACHE_VERSION) return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('admin.cache.')) localStorage.removeItem(key);
    }
    localStorage.setItem(ADMIN_CACHE_VERSION_STORAGE_KEY, String(ADMIN_CACHE_VERSION));
  } catch {}
}
maybeMigrateCache();

function readFeatureCache(key) {
  try {
    const raw = localStorage.getItem(cacheKeyFor(key));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.t || !obj.d) return null;
    if (Date.now() - obj.t > FEATURE_CACHE_TTL_MS) return null;
    return obj.d;
  } catch { return null; }
}

function writeFeatureCache(key, data) {
  try {
    localStorage.setItem(cacheKeyFor(key), JSON.stringify({ t: Date.now(), d: data }));
    return true;
  } catch {
    // Quota exceeded — silently fall through; the layer still works this
    // session, it just refetches on the next page load.
    return false;
  }
}

// Paginated /query: walks resultOffset until either a page is non-truncated
// (exceededTransferLimit absent/false) or features.length < requested. Used
// for counties (3144 features, 2000 maxRecordCount). For non-paginated layers
// the first page returns everything in one call.
async function fetchAllFeatures(cfg) {
  const PAGE = 2000;
  const PAGE_CAP = 10; // sanity stop — 10 * 2000 = 20k features, plenty
  let offset = 0;
  let all = null;
  for (let i = 0; i < PAGE_CAP; i++) {
    const params = new URLSearchParams({
      where: '1=1',
      // Per-layer outFields — Living Atlas states has STATE_NAME, counties
      // has NAME; hardcoding 'NAME' caused HTTP 200 + error 400 (silently
      // rendered nothing) for states. Fall back to '*' if unspecified.
      outFields: cfg.outFields || '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE)
    });
    const url = `${cfg.restUrl}/${cfg.featureLayer}/query?${params}`;
    let data;
    try {
      const r = await fetch(url);
      data = await r.json();
    } catch { return all; }
    // Server-side error responses come back as HTTP 200 with { error: {...} }
    // and no .features. Bail explicitly so a bad query doesn't get cached.
    if (!data || data.error || !data.features) break;
    if (!all) all = { type: 'FeatureCollection', features: [] };
    all.features.push(...data.features);
    // exceededTransferLimit lives at the top level for f=json but under
    // `properties` for f=geojson. We request f=geojson, so the top-level
    // check alone always read undefined → terminated pagination after page 1
    // → silently dropped MD/VA/WV/TX (alphabetical-order page 2). Bug 6 /
    // 2026-05-17. Check both locations to stay shape-agnostic.
    const truncated = data.exceededTransferLimit === true
      || data.properties?.exceededTransferLimit === true;
    if (!cfg.paginated || !truncated || data.features.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function loadFeatureLayer(key) {
  const cfg = ADMIN_BOUNDARIES[key];
  const group = layers[key];
  if (!group || !map.hasLayer(group)) return;
  if (group._loaded) return; // already populated
  let data = readFeatureCache(key);
  if (!data) {
    data = await fetchAllFeatures(cfg);
    if (data && data.features) writeFeatureCache(key, data);
  }
  if (!group._loaded && data && data.features) {
    const style = { color: cfg.color, weight: cfg.weight, fill: false, opacity: cfg.opacity };
    // Canvas renderer is significantly faster than SVG for thousands of
    // polygons (counties layer has ~3000); for small layers it's still
    // a wash, so use it uniformly across all feature tiers.
    const canvasRenderer = L.canvas({ padding: 0.5 });
    L.geoJSON(data, { style, renderer: canvasRenderer }).eachLayer(l => group.addLayer(l));
    group._loaded = true;
  }
}

const layers = Object.fromEntries(
  LAYER_KEYS.map(key => {
    const cfg = ADMIN_BOUNDARIES[key];
    return [key, cfg.renderer === 'feature' ? makeFeatureLayer(key, cfg) : makeTileLayer(cfg)];
  })
);

// User-intent: which layers the user has toggled on.
const wantOn = Object.fromEntries(LAYER_KEYS.map(k => [k, false]));

function loadIntent() {
  try {
    const raw = localStorage.getItem(ADMIN_TOGGLES_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of LAYER_KEYS) {
      if (saved[k] === true) wantOn[k] = true;
    }
  } catch {}
}

function saveIntent() {
  try { localStorage.setItem(ADMIN_TOGGLES_STORAGE_KEY, JSON.stringify(wantOn)); } catch {}
}

function isMaterialised(key) {
  return map.hasLayer(layers[key]);
}

function syncOne(key) {
  const cfg = ADMIN_BOUNDARIES[key];
  const layer = layers[key];
  const inRange = map.getZoom() >= effectiveMinZoom(key);
  if (wantOn[key] && inRange) {
    if (!isMaterialised(key)) {
      layer.addTo(map);
      if (cfg.renderer === 'feature') loadFeatureLayer(key);
    }
  } else {
    if (isMaterialised(key)) {
      map.removeLayer(layer);
      // Keep the featureGroup's children — toggling back on shouldn't refetch.
    }
  }
  syncToggleClass(key);
}

function syncAll() {
  for (const key of LAYER_KEYS) syncOne(key);
}

function syncToggleClass(key) {
  const el = document.querySelector(`.admin-toggle[data-layer="admin-${key}"]`);
  if (!el) return;
  el.classList.toggle('active', wantOn[key]);
}

function toggleLayer(key) {
  wantOn[key] = !wantOn[key];
  saveIntent();
  syncOne(key);
  const threshold = effectiveMinZoom(key);
  if (wantOn[key] && map.getZoom() < threshold) {
    const cfg = ADMIN_BOUNDARIES[key];
    showToast(`${cfg.label} render at zoom ${threshold}+ — zoom in.`);
  }
}

function setMinZoomOverride(key, value) {
  if (!LAYER_KEYS.includes(key)) return;
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(0, Math.min(20, Math.round(n)));
  minZoomOverride[key] = clamped;
  saveOverrides();
  syncOne(key);
}

function bindEditMode() {
  const panel = document.getElementById('admin-panel');
  const gear = document.getElementById('boundary-gear');
  if (!panel || !gear) return;
  gear.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('edit-mode');
    // When entering edit mode, populate inputs with current effective values.
    if (panel.classList.contains('edit-mode')) {
      panel.querySelectorAll('.boundary-zoom-input').forEach(input => {
        const key = input.dataset.zoomFor;
        if (key) input.value = effectiveMinZoom(key);
      });
    }
  });
  panel.querySelectorAll('.boundary-zoom-input').forEach(input => {
    // Stop clicks on the input from bubbling up to the parent .admin-toggle
    // (otherwise typing toggles the layer).
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('change', () => {
      setMinZoomOverride(input.dataset.zoomFor, input.value);
    });
  });
}

document.querySelectorAll('.admin-toggle').forEach(el => {
  const dataKey = el.dataset.layer;
  if (!dataKey || !dataKey.startsWith('admin-')) return;
  const key = dataKey.slice('admin-'.length);
  if (!LAYER_KEYS.includes(key)) return;
  el.addEventListener('click', () => {
    // In edit mode, the row is inert — only the inline number input is active.
    if (document.getElementById('admin-panel')?.classList.contains('edit-mode')) return;
    toggleLayer(key);
  });
});

map.on('zoomend', syncAll);
// No moveend refetch: feature layers are loaded once (whole-country GeoJSON)
// and rendered client-side. Pan/zoom is fully local.

loadIntent();
loadOverrides();
bindEditMode();
syncAll();

function sampleTileUrl(key) {
  const cfg = ADMIN_BOUNDARIES[key];
  if (!cfg) return null;
  if (cfg.renderer === 'tile') {
    const layerParam = cfg.layerIds ? `&layers=show:${cfg.layerIds.join(',')}` : '';
    return `${cfg.restUrl}/export?bbox=0,0,1,1&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image${layerParam}`;
  }
  return `${cfg.restUrl}/${cfg.featureLayer}/query?where=1%3D1&outFields=NAME&f=geojson`;
}

function tierColor(key) {
  return ADMIN_BOUNDARIES[key]?.color || null;
}

export const admin = {
  isActive: () => LAYER_KEYS.some(k => wantOn[k]),
  activeTier: () => {
    const live = LAYER_KEYS.filter(k => isMaterialised(k));
    return live.length === 0 ? null : live[live.length - 1];
  },
  activeLayers: () => LAYER_KEYS.filter(k => isMaterialised(k)),
  wantedLayers: () => LAYER_KEYS.filter(k => wantOn[k]),
  sampleTileUrl,
  tierColor,
  effectiveMinZoom,
  setMinZoomOverride,
  toggle: toggleLayer
};
