// Singleton Leaflet map + basemap switching + the dedicated `labels` pane
// (zIndex 650) used to overlay CARTO labels on satellite/terrain basemaps.
// Initial view follows a priority cascade — saved last view → Maryland
// fallback at zoom 9 (centered on the most-populated wired-parcel region).
// Basemap choice persists to localStorage on switch.

import { MAP_INIT, BASEMAPS, DEFAULT_BASEMAP, LABEL_LAYER } from './config.js';

const LAST_VIEW_KEY = 'parcel.lastView';
const BASEMAP_KEY = 'parcel.basemap';

// Priority cascade for the initial view:
//   1. localStorage.parcel.lastView — restored synchronously
//   2. Hard fallback to MD/NoVA bbox center at zoom 9 — the most populated
//      area with wired parcel coverage. (Removed: IP geolocation via
//      ipapi.co — the service blocks browser CORS for plain origins and
//      surfaces as a console error. The nice-to-have isn't worth the
//      fragility.)
function readLastView() {
  try {
    const raw = localStorage.getItem(LAST_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v.lat === 'number' && typeof v.lng === 'number' && typeof v.zoom === 'number') return v;
  } catch {}
  return null;
}
function readPreferredBasemap() {
  try { return localStorage.getItem(BASEMAP_KEY); }
  catch { return null; }
}

const initialView = readLastView();
const initialBasemap = readPreferredBasemap() && BASEMAPS[readPreferredBasemap()]
  ? readPreferredBasemap() : DEFAULT_BASEMAP;

// MD/NoVA fallback used when there is no persisted view — passed directly
// to L.map() rather than a post-construction setView so subsequent setView
// calls (test setup, search results, etc.) aren't suppressed by Leaflet's
// "view set during init" guard.
const FALLBACK_CENTER = [38.85, -77.10];
const FALLBACK_ZOOM = 9;

export const map = L.map('map', {
  center: initialView ? [initialView.lat, initialView.lng] : FALLBACK_CENTER,
  zoom:   initialView ? initialView.zoom : FALLBACK_ZOOM,
  zoomControl: true,
  attributionControl: true
});

map.createPane('labels');
map.getPane('labels').style.zIndex = 650;
map.getPane('labels').style.pointerEvents = 'none';

// Scale bar — a land tool without a scale reference makes users guess parcel
// sizes. Imperial only (US audience, acreage-centric app); themed in styles.css.
L.control.scale({ position: 'bottomleft', metric: false, maxWidth: 140 }).addTo(map);

const basemapLayers = Object.fromEntries(
  Object.entries(BASEMAPS).map(([key, { url, options }]) => [key, L.tileLayer(url, options)])
);

const labelLayer = L.tileLayer(LABEL_LAYER.url, LABEL_LAYER.options);

let currentBasemap = basemapLayers[initialBasemap].addTo(map);
if (BASEMAPS[initialBasemap].labels) labelLayer.addTo(map);

// Reflect persisted basemap choice in the sidebar buttons' .active class.
queueMicrotask(() => {
  document.querySelectorAll('.basemap-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.basemap === initialBasemap);
  });
});

document.querySelectorAll('.basemap-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.basemap;
    document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (!BASEMAPS[key]) return;
    map.removeLayer(currentBasemap);
    currentBasemap = basemapLayers[key].addTo(map);
    if (BASEMAPS[key].labels) {
      if (!map.hasLayer(labelLayer)) labelLayer.addTo(map);
    } else if (map.hasLayer(labelLayer)) {
      map.removeLayer(labelLayer);
    }
    try { localStorage.setItem(BASEMAP_KEY, key); } catch {}
  });
});

// Persist view on every settled move/zoom so reload restores precisely.
let saveTimer = null;
function persistView() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const c = map.getCenter();
    try {
      localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({
        lat: c.lat, lng: c.lng, zoom: map.getZoom()
      }));
    } catch {}
  }, 250);
}
map.on('moveend zoomend', persistView);


export function resetView() {
  try {
    localStorage.removeItem(LAST_VIEW_KEY);
    localStorage.removeItem(BASEMAP_KEY);
  } catch {}
  // Reload — simpler than re-running the cascade with a live map.
  location.reload();
}

// Temporarily swap the active basemap to a CORS-cooperative one (CARTO street),
// run the provided work, then restore. Used by the PDF screenshot path. Returns
// whatever `work` resolves to.
export async function withCorsCompatibleBasemap(work) {
  const corsLayer = basemapLayers.street;
  const wasCurrent = currentBasemap;
  const hadLabels = map.hasLayer(labelLayer);
  const switched = wasCurrent !== corsLayer;
  if (switched) {
    map.removeLayer(wasCurrent);
    corsLayer.addTo(map);
    if (hadLabels) map.removeLayer(labelLayer);
    // Give the new tiles a chance to load before snapshot.
    await new Promise(r => setTimeout(r, 600));
  }
  try {
    return await work();
  } finally {
    if (switched) {
      map.removeLayer(corsLayer);
      wasCurrent.addTo(map);
      if (hadLabels) labelLayer.addTo(map);
    }
  }
}
