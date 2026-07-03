// Toggleable data layers (flood, wetlands, contours, SSURGO soil). Two
// renderer types: `xyz` (plain tile layer) and `esri-export` (custom
// L.GridLayer that builds per-tile bbox `?bbox=…&f=image` requests against
// an ArcGIS MapServer). Also home to the global `showToast` helper used by
// every other module + the tile-error auto-disable safety net: 5 consecutive
// tile errors on a layer removes it from the map and surfaces a toast.

import { map } from './map.js';
import { OVERLAYS, ZOOM_HINTS, TILE_FAILURE_THRESHOLD, OVERLAY_LABELS } from './config.js';
import { clearSoilPanel } from './soil.js';
import { activateSoilColoring, deactivateSoilColoring } from './soil-coloring.js';

function makeEsriExportTileLayer(restUrl, layerIds, opacity, attribution) {
  const ExportLayer = L.GridLayer.extend({
    createTile: function(coords, done) {
      const tile = document.createElement('img');
      const size = this.getTileSize();
      const nwPoint = coords.scaleBy(size);
      const sePoint = nwPoint.add(size);
      const nw = this._map.options.crs.project(this._map.unproject(nwPoint, coords.z));
      const se = this._map.options.crs.project(this._map.unproject(sePoint, coords.z));
      const bbox = `${nw.x},${se.y},${se.x},${nw.y}`;
      const layerParam = layerIds ? `&layers=show:${layerIds.join(',')}` : '';
      const url = `${restUrl}/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=${size.x},${size.y}&format=png32&transparent=true&f=image${layerParam}`;
      tile.onload = () => done(null, tile);
      tile.onerror = () => done(new Error('tile failed'), tile);
      tile.src = url;
      tile.style.opacity = opacity;
      return tile;
    }
  });
  return new ExportLayer({ opacity, attribution });
}

function buildOverlay(cfg) {
  if (cfg.type === 'xyz') return L.tileLayer(cfg.url, cfg.options);
  return makeEsriExportTileLayer(cfg.restUrl, cfg.layerIds, cfg.opacity, cfg.attribution);
}

const overlayLayers = Object.fromEntries(
  Object.entries(OVERLAYS).map(([key, cfg]) => [key, buildOverlay(cfg)])
);
overlayLayers.parcels = null;

// Per-overlay consecutive tile-error counter. Resets on first successful tile.
const tileErrorCount = Object.fromEntries(Object.keys(overlayLayers).map(k => [k, 0]));

for (const [key, layer] of Object.entries(overlayLayers)) {
  if (!layer) continue;
  layer.on('tileerror', () => {
    tileErrorCount[key] += 1;
    if (tileErrorCount[key] >= TILE_FAILURE_THRESHOLD) {
      autoDisableLayer(key);
    }
  });
  layer.on('tileload', () => { tileErrorCount[key] = 0; });
}

function autoDisableLayer(key) {
  const layer = overlayLayers[key];
  const layerEl = document.querySelector(`.layer[data-layer="${key}"]`);
  if (layer && map.hasLayer(layer)) map.removeLayer(layer);
  if (layerEl) layerEl.classList.remove('active');
  if (key === 'soil') clearSoilPanel();
  tileErrorCount[key] = 0;
  const label = OVERLAY_LABELS[key] || key;
  showToast(`${label} data temporarily unavailable`);
}

// Toast styling lives in css/styles.css (#toast). Two load-bearing details
// from the 2026-07-01 design audit: (1) the CSS sets pointer-events:none —
// the old inline-styled element kept intercepting map clicks at top-center
// FOREVER after fading to opacity:0 (an invisible click shield); (2) the
// element is still created lazily because export.spec.js and
// reverse-geocode.spec.js assert #toast has count 0 before the first toast.
export function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  // Double-rAF so the entrance transition plays even on the creation frame.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  }));
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.style.opacity = '';
    toast.style.transform = '';
  }, 3500);
}

function checkLayerZoomHint(layerKey) {
  const z = map.getZoom();
  const h = ZOOM_HINTS[layerKey];
  if (h && z < h.min) {
    showToast(h.msg);
  }
}

document.querySelectorAll('.layer').forEach(layerEl => {
  layerEl.addEventListener('click', () => {
    const key = layerEl.dataset.layer;
    if (!(key in overlayLayers) || key === 'parcels') return; // admin/parcels panels manage themselves
    const layer = overlayLayers[key];
    if (layerEl.classList.contains('active')) {
      if (layer) map.removeLayer(layer);
      layerEl.classList.remove('active');
      if (key === 'soil') {
        clearSoilPanel();
        deactivateSoilColoring();
      }
    } else {
      if (!layer) return;
      tileErrorCount[key] = 0;
      layer.addTo(map);
      layerEl.classList.add('active');
      checkLayerZoomHint(key);
      if (key === 'soil') activateSoilColoring();
    }
  });
});

map.on('zoomend', () => {
  document.querySelectorAll('.layer.active').forEach(el => {
    checkLayerZoomHint(el.dataset.layer);
  });
});
