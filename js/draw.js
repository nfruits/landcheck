// Polygon / polyline drawing via vendored leaflet-draw. After a polygon is
// completed, computes area via spherical-excess (avoids depending on
// L.GeometryUtil) and renders a Measure-panel readout. Polygons additionally
// fan out elevation samples at perimeter vertices through USGS EPQS to
// derive terrain-range, surfaced as the "Terrain change" row.

import { map } from './map.js';
import { USGS_EPQS_URL } from './config.js';

const drawnItems = new L.FeatureGroup().addTo(map);
const rArea = document.getElementById('r-area');
const rPerim = document.getElementById('r-perim');
const rDist = document.getElementById('r-dist');
const rTerrain = document.getElementById('r-terrain-change');

const MAX_SLOPE_SAMPLES = 8;

function polygonAreaSqMeters(latlngs) {
  if (latlngs.length < 3) return 0;
  let area = 0;
  const R = 6378137;
  const toRad = d => d * Math.PI / 180;
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[(i + 1) % latlngs.length];
    area += toRad(p2.lng - p1.lng) * (2 + Math.sin(toRad(p1.lat)) + Math.sin(toRad(p2.lat)));
  }
  return Math.abs(area * R * R / 2);
}

function polylineLengthMeters(latlngs) {
  let total = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    total += latlngs[i].distanceTo(latlngs[i + 1]);
  }
  return total;
}

let activeDrawer = null;

document.getElementById('draw-polygon').addEventListener('click', () => {
  if (activeDrawer) activeDrawer.disable();
  // Copper = user controls/tools per the two-tone accent system.
  activeDrawer = new L.Draw.Polygon(map, {
    shapeOptions: { color: '#e0a23c', weight: 2, fillColor: '#e0a23c', fillOpacity: 0.12 }
  });
  activeDrawer.enable();
});

document.getElementById('draw-line').addEventListener('click', () => {
  if (activeDrawer) activeDrawer.disable();
  // Dashed copper distinguishes a measurement from parcel boundaries.
  activeDrawer = new L.Draw.Polyline(map, {
    shapeOptions: { color: '#e0a23c', weight: 2, dashArray: '6 4' }
  });
  activeDrawer.enable();
});

document.getElementById('clear-draw').addEventListener('click', () => {
  drawnItems.clearLayers();
  rArea.textContent = '— ac'; rArea.classList.add('empty');
  rPerim.textContent = '— ft'; rPerim.classList.add('empty');
  rDist.textContent = '— ft'; rDist.classList.add('empty');
  if (rTerrain) { rTerrain.textContent = '—'; rTerrain.classList.add('empty'); }
});

// Subsample polygon vertices to at most N evenly-spaced points around the
// perimeter. If the polygon has ≤ N vertices, return them all.
function subsampleVertices(latlngs, n) {
  if (latlngs.length <= n) return latlngs.slice();
  const step = latlngs.length / n;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(latlngs[Math.floor(i * step)]);
  }
  return out;
}

async function fetchElevationFt(lat, lng) {
  const url = `${USGS_EPQS_URL}?x=${lng}&y=${lat}&wkid=4326&units=Feet&includeDate=false`;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const v = data?.value;
    if (v == null || v === -1000000) return null;
    return Number(v);
  } catch {
    return null;
  }
}

async function analyzeSlope(latlngs) {
  if (!rTerrain) return;
  const samples = subsampleVertices(latlngs, MAX_SLOPE_SAMPLES);
  rTerrain.textContent = `sampling ${samples.length}…`;
  rTerrain.classList.remove('empty');
  const results = await Promise.allSettled(samples.map(p => fetchElevationFt(p.lat, p.lng)));
  const elevations = results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(v => v != null);
  if (elevations.length < 2) {
    rTerrain.textContent = '(insufficient samples)';
    rTerrain.classList.add('empty');
    return;
  }
  const min = Math.min(...elevations);
  const max = Math.max(...elevations);
  const range = max - min;
  const partial = elevations.length < samples.length
    ? ` (based on ${elevations.length} of ${samples.length} samples)`
    : '';
  rTerrain.textContent = `${range.toFixed(0)} ft (${min.toFixed(0)}–${max.toFixed(0)} ft)${partial}`;
  rTerrain.classList.remove('empty');
}

map.on(L.Draw.Event.CREATED, (e) => {
  const layer = e.layer;
  drawnItems.addLayer(layer);
  if (e.layerType === 'polygon') {
    const latlngs = layer.getLatLngs()[0];
    const sqm = polygonAreaSqMeters(latlngs);
    const acres = sqm / 4046.8564224;
    const perimM = polylineLengthMeters([...latlngs, latlngs[0]]);
    const perimFt = perimM * 3.28084;
    rArea.textContent = acres.toFixed(3) + ' ac';
    rArea.classList.remove('empty');
    rPerim.textContent = perimFt.toFixed(0) + ' ft';
    rPerim.classList.remove('empty');
    layer.bindPopup(`<strong>${acres.toFixed(3)} ac</strong><br>${(sqm).toFixed(0)} m² · ${(sqm * 10.7639).toFixed(0)} ft²<br>Perimeter: ${perimFt.toFixed(0)} ft`).openPopup();
    analyzeSlope(latlngs);
  } else if (e.layerType === 'polyline') {
    const latlngs = layer.getLatLngs();
    const m = polylineLengthMeters(latlngs);
    const ft = m * 3.28084;
    const mi = ft / 5280;
    rDist.textContent = ft > 5280 ? mi.toFixed(3) + ' mi' : ft.toFixed(0) + ' ft';
    rDist.classList.remove('empty');
    layer.bindPopup(`<strong>${ft.toFixed(0)} ft</strong> · ${m.toFixed(0)} m · ${mi.toFixed(3)} mi`).openPopup();
  }
});
