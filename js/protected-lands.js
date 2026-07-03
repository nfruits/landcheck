// PAD-US protected-areas overlay. Bbox-filtered query against the USGS
// Manager_Type_PADUS FeatureServer (services.arcgis.com/v01gqwM5QqNysAAi).
// Forest-green translucent fill; click a polygon for manager/designation.
//
// Why bbox-filtered (parcels-style) rather than whole-country cache
// (admin.js-style): PAD-US is ~1M+ polygons nationwide — far too much to
// fetch and cache client-side. The bbox pattern keeps responses bounded.

import { map } from './map.js';
import { PROTECTED_LANDS_URL, PROTECTED_LANDS_MIN_ZOOM } from './config.js';
import { showToast } from './overlays.js';
import { escapeHtml } from './escape.js';

const layerGroup = L.featureGroup();
let active = false;
let lastFetchToken = 0;

const STYLE = { color: '#3d5a2a', weight: 1, fill: true, fillColor: '#4a6b35', fillOpacity: 0.22, opacity: 0.7 };

function buildQueryUrl(bbox) {
  const params = new URLSearchParams({
    where: '1=1',
    geometry: `${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    // Limit outFields to the ones used in the click popup — keeps response
    // smaller for dense areas like the Sierras / Yellowstone.
    outFields: 'Unit_Nm,Mang_Name,Mang_Type,Des_Tp,Own_Name',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '1000'
  });
  return `${PROTECTED_LANDS_URL}/query?${params.toString()}`;
}

async function refresh() {
  if (!active) return;
  if (map.getZoom() < PROTECTED_LANDS_MIN_ZOOM) {
    layerGroup.clearLayers();
    return;
  }
  const b = map.getBounds();
  const bbox = { minX: b.getWest(), minY: b.getSouth(), maxX: b.getEast(), maxY: b.getNorth() };
  const token = ++lastFetchToken;
  let data;
  try {
    const r = await fetch(buildQueryUrl(bbox));
    data = await r.json();
  } catch { return; }
  if (token !== lastFetchToken) return;
  if (!data || data.error || !data.features) return;
  layerGroup.clearLayers();
  for (const f of data.features) {
    const layer = L.geoJSON(f, { style: STYLE }).getLayers()[0];
    if (!layer) continue;
    layer.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const p = f.properties || {};
      const name = p.Unit_Nm || 'Protected area';
      const mgr = p.Mang_Name || p.Own_Name || 'Unknown manager';
      const des = p.Des_Tp || 'Protected land';
      // Escape: these are external PAD-US fields going into a popup HTML sink.
      layer.bindPopup(`<strong>${escapeHtml(name)}</strong><br>${escapeHtml(des)}<br><em>${escapeHtml(mgr)}</em>`).openPopup(e.latlng);
    });
    layerGroup.addLayer(layer);
  }
}

function activate() {
  active = true;
  layerGroup.addTo(map);
  if (map.getZoom() < PROTECTED_LANDS_MIN_ZOOM) {
    showToast(`Zoom to ${PROTECTED_LANDS_MIN_ZOOM}+ to load protected lands`);
  } else {
    refresh();
  }
}

function deactivate() {
  active = false;
  map.removeLayer(layerGroup);
  layerGroup.clearLayers();
}

map.on('moveend', refresh);
map.on('zoomend', () => {
  if (!active) return;
  if (map.getZoom() < PROTECTED_LANDS_MIN_ZOOM) {
    layerGroup.clearLayers();
  } else {
    refresh();
  }
});

const toggleEl = document.querySelector('.layer[data-layer="protected-lands"]');
if (toggleEl) {
  toggleEl.addEventListener('click', () => {
    if (toggleEl.classList.contains('active')) {
      deactivate();
      toggleEl.classList.remove('active');
    } else {
      activate();
      toggleEl.classList.add('active');
    }
  });
}

export const protectedLands = {
  isActive: () => active,
  countLoaded: () => layerGroup.getLayers().length
};
