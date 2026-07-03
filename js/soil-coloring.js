// Soil quality stoplight overlay. When the Soil layer is active, query the
// USDA SDA Tabular service for SSURGO map-unit polygons in the current view,
// compute a quality score per polygon from three fields, and render them as
// translucent Canvas polygons over the existing tile overlay.
//
// Scoring (combined → translucent fill colour):
//   drainagecl: well-drained = +1, moderate = 0, poor/very poor = -1
//   hydricrating: 'no' → 0 (neutral for buildability); 'yes' → -1; 'partial' → -0.5
//   farmlndcl: prime → +1, statewide importance → +0.5, other → 0
// Sum > 0.7 → green; -0.7..0.7 → yellow; < -0.7 → red.
// "Red" doesn't mean bad — it means poorly drained, hydric, non-prime farmland.
// Suitable for wetlands and wildlife; less suitable for building or farming.

import { map } from './map.js';
import { SDA_URL } from './config.js';

const MIN_ZOOM = 12;       // Below this, polygon counts get unmanageable
const MAX_POLYGONS = 200;  // Cap response size; SDA POSTs are heavy
const FILL_OPACITY = 0.28;

const group = L.featureGroup();
const renderer = L.canvas({ padding: 0.5 });
let active = false;
let fetchToken = 0;
let lastBboxKey = null;

function scoreDrainage(v) {
  if (!v) return 0;
  const s = String(v).toLowerCase();
  // Check 'moderate' BEFORE 'well' so 'Moderately well drained' doesn't
  // get the full positive credit reserved for unqualified 'well drained'.
  if (s.includes('moderate')) return 0;
  if (s.includes('poor')) return -1;
  if (s.includes('well')) return 1;
  return 0;
}

function scoreHydric(v) {
  if (!v) return 0;
  const s = String(v).toLowerCase();
  if (s.startsWith('no')) return 0;
  if (s.startsWith('yes') || s.startsWith('all')) return -1;
  if (s.startsWith('partial')) return -0.5;
  return 0;
}

function scoreFarmland(v) {
  if (!v) return 0;
  const s = String(v).toLowerCase();
  // 'Not prime farmland' must not match the prime check.
  if (s.startsWith('not ') || s.includes('not prime')) return 0;
  if (s.includes('prime farmland')) return s.includes('if') ? 0.5 : 1;
  if (s.includes('statewide')) return 0.5;
  return 0;
}

function tintFor(score) {
  if (score >= 0.7) return '#3a8a3a';   // green
  if (score <= -0.7) return '#b04525';  // red (= hazard tone)
  return '#c89a2a';                     // yellow
}

// Minimal WKT parser for POLYGON and MULTIPOLYGON. Returns an array of rings,
// each ring an array of [lat, lng] points (Leaflet convention).
function parseWkt(wkt) {
  if (!wkt) return null;
  // Reject anything other than POLYGON/MULTIPOLYGON
  const isMulti = wkt.startsWith('MULTIPOLYGON');
  const isPoly  = wkt.startsWith('POLYGON');
  if (!isMulti && !isPoly) return null;
  // Pull out every (( … )) ring group
  const groups = [...wkt.matchAll(/\(\(([^()]+)\)\)/g)].map(m => m[1]);
  if (groups.length === 0) return null;
  return groups.map(g => g.split(',').map(p => {
    const [x, y] = p.trim().split(/\s+/).map(Number);
    return [y, x]; // SDA returns lon lat; Leaflet wants [lat, lng]
  }));
}

function buildAreaQuery(b) {
  const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
  const ring = `POLYGON((${w} ${s}, ${e} ${s}, ${e} ${n}, ${w} ${n}, ${w} ${s}))`;
  return `SELECT TOP ${MAX_POLYGONS}
    mu.mukey, mu.muname, mu.farmlndcl,
    (SELECT TOP 1 drainagecl FROM component WHERE component.mukey = mu.mukey ORDER BY comppct_r DESC) AS drainagecl,
    (SELECT TOP 1 hydricrating FROM component WHERE component.mukey = mu.mukey ORDER BY comppct_r DESC) AS hydricrating,
    mp.mupolygongeo.STAsText() AS wkt
  FROM mupolygon mp
  JOIN mapunit mu ON mp.mukey = mu.mukey
  WHERE mp.mupolygongeo.STIntersects(geometry::STGeomFromText('${ring}', 4326)) = 1`;
}

function bboxKey(b) {
  return `${b.getWest().toFixed(3)},${b.getSouth().toFixed(3)},${b.getEast().toFixed(3)},${b.getNorth().toFixed(3)}`;
}

async function refresh() {
  if (!active) return;
  if (map.getZoom() < MIN_ZOOM) {
    group.clearLayers();
    return;
  }
  const b = map.getBounds();
  const key = bboxKey(b);
  if (key === lastBboxKey) return; // panned within the same coarse bbox
  lastBboxKey = key;
  const token = ++fetchToken;
  try {
    const r = await fetch(SDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildAreaQuery(b), format: 'JSON+COLUMNNAME' })
    });
    if (token !== fetchToken) return; // a newer fetch is in flight
    const data = await r.json();
    if (!data.Table || data.Table.length < 2) return;
    const cols = data.Table[0];
    const colIdx = Object.fromEntries(cols.map((c, i) => [c, i]));
    group.clearLayers();
    for (let i = 1; i < data.Table.length; i++) {
      const row = data.Table[i];
      const wkt = row[colIdx.wkt];
      const rings = parseWkt(wkt);
      if (!rings) continue;
      const score = scoreDrainage(row[colIdx.drainagecl])
                  + scoreHydric(row[colIdx.hydricrating])
                  + scoreFarmland(row[colIdx.farmlndcl]);
      const color = tintFor(score);
      const poly = L.polygon(rings, {
        renderer,
        color,
        weight: 0.6,
        fillColor: color,
        fillOpacity: FILL_OPACITY,
        opacity: 0.7
      });
      // Attach raw data for hover/inspect by other modules if needed
      poly._soilQuality = {
        mukey: row[colIdx.mukey],
        muname: row[colIdx.muname],
        score
      };
      group.addLayer(poly);
    }
  } catch {
    // Silent — soil-coloring is supplementary; the tile overlay still works.
  }
}

export function activateSoilColoring() {
  active = true;
  if (!map.hasLayer(group)) group.addTo(map);
  lastBboxKey = null;
  refresh();
  showLegend();
}

export function deactivateSoilColoring() {
  active = false;
  if (map.hasLayer(group)) map.removeLayer(group);
  group.clearLayers();
  lastBboxKey = null;
  hideLegend();
}

function showLegend() {
  const el = document.getElementById('soil-legend');
  if (el) el.hidden = false;
}
function hideLegend() {
  const el = document.getElementById('soil-legend');
  if (el) el.hidden = true;
}

map.on('moveend zoomend', refresh);

export const soilColoringApi = {
  isActive: () => active,
  layerCount: () => group.getLayers().length,
  tintFor,
  scoreParts: (drain, hydric, farm) => ({
    drainage: scoreDrainage(drain),
    hydric: scoreHydric(hydric),
    farmland: scoreFarmland(farm)
  })
};
