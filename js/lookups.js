// Map-click pipeline. Every click drops a pin and fans out to elevation
// (USGS EPQS), flood zone (FEMA NFHL /28/query), and — only when the soil
// overlay is active — SSURGO detail. Results populate the fly-out and the
// sidebar readouts. The `inspectPoint(lat, lng)` entrypoint is exported so
// tests and search-result clicks can replay a click programmatically without
// synthesizing a DOM event.

import { map } from './map.js';
import { USGS_EPQS_URL, FEMA_FLOOD_QUERY_URL, HAZARD_FLOOD_ZONES } from './config.js';
import { getSoilDetail, clearSoilPanel } from './soil.js';
import { openFlyout, applyFlyoutHeader, resetFlyoutContext } from './flyout.js';
import { setSaveContext, setNearestAddress } from './save-place.js';
import { reverseGeocode } from './reverse-geocode.js';
import { setDemographicsContext } from './demographics.js';

const rElev = document.getElementById('r-elev');
const rFlood = document.getElementById('r-flood');
const rFloodDesc = document.getElementById('r-flood-desc');

const FLOOD_ZONE_LANGUAGE = {
  A:   'High-risk flood zone (no base elevation determined).',
  AE:  'High-risk flood zone with base flood elevations established.',
  AH:  'Shallow flooding, 1-3 ft, ponding common.',
  AO:  'Shallow flooding, 1-3 ft, sheet flow.',
  AR:  'Temporarily-suspended high-risk zone behind restored levees.',
  A99: 'High-risk zone protected by a federal flood-control system under construction.',
  V:   'Coastal high-hazard area subject to wave action.',
  VE:  'Coastal high-hazard area with base flood elevations established.',
  X:   'Minimal flood hazard (outside 0.2% annual chance).',
  D:   'Undetermined flood hazard.'
};

let pinMarker = null;

// One in-flight lookup fan-out at a time: each new click aborts the previous
// elevation/flood/soil fetches so a slow earlier response can't overwrite the
// readouts describing the CURRENT pin. (Flagged in the original 2026-05-11
// code review — "whichever resolves last wins" — implemented 2026-07-01.)
let lookupAbort = null;

export function inspectPoint(lat, lng) {
  if (lookupAbort) lookupAbort.abort();
  lookupAbort = new AbortController();
  const signal = lookupAbort.signal;
  if (pinMarker) map.removeLayer(pinMarker);
  // Teal probe with a dark ring — the click pin IS live data, per the
  // two-tone accent system (teal = data, copper = brand/controls).
  pinMarker = L.circleMarker([lat, lng], {
    radius: 6,
    color: '#0c0f14',
    weight: 2,
    fillColor: '#2dd4bf',
    fillOpacity: 0.9
  }).addTo(map);
  pinMarker.bindPopup(`<strong>${lat.toFixed(5)}, ${lng.toFixed(5)}</strong>`, {
    closeButton: false, offset: [0, -4], className: 'coord-popup', autoPan: false
  }).openPopup();
  resetFlyoutContext();
  applyFlyoutHeader({ lat, lng });
  setSaveContext(lat, lng);
  setDemographicsContext(lat, lng);
  openFlyout();
  populateNearestAddress(lat, lng);
  getElevation(lat, lng, signal);
  getFloodZone(lat, lng, signal);
  if (document.querySelector('.layer[data-layer="soil"].active')) {
    getSoilDetail(lat, lng, signal);
  } else {
    clearSoilPanel();
  }
}

async function getElevation(lat, lon, signal) {
  rElev.innerHTML = '<span class="loading"></span>';
  rElev.classList.remove('empty');
  try {
    const url = `${USGS_EPQS_URL}?x=${lon}&y=${lat}&wkid=4326&units=Feet&includeDate=false`;
    const r = await fetch(url, { signal });
    const data = await r.json();
    const elev = data.value;
    if (elev === null || elev === undefined || elev === -1000000) {
      rElev.textContent = 'n/a';
      rElev.classList.add('empty');
    } else {
      rElev.textContent = parseFloat(elev).toFixed(1) + ' ft';
      rElev.classList.remove('empty');
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded by a newer click
    rElev.textContent = 'error';
    rElev.classList.add('empty');
  }
}

async function getFloodZone(lat, lon, signal) {
  rFlood.innerHTML = '<span class="loading"></span>';
  rFlood.className = 'readout-value';
  try {
    const url = `${FEMA_FLOOD_QUERY_URL}?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`;
    const r = await fetch(url, { signal });
    const data = await r.json();
    if (data.features && data.features.length > 0) {
      const zone = data.features[0].attributes.FLD_ZONE;
      const subtype = data.features[0].attributes.ZONE_SUBTY;
      const display = subtype ? `${zone} · ${subtype}` : zone;
      rFlood.textContent = display;
      if (rFloodDesc) rFloodDesc.textContent = FLOOD_ZONE_LANGUAGE[zone] || '';
      if (HAZARD_FLOOD_ZONES.includes(zone)) {
        rFlood.classList.add('hazard');
      } else if (zone === 'X' && subtype && subtype.includes('0.2')) {
        rFlood.classList.add('amber');
      } else {
        rFlood.classList.add('amber');
      }
    } else {
      rFlood.textContent = 'no data';
      rFlood.classList.add('empty');
      if (rFloodDesc) rFloodDesc.textContent = '';
    }
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded by a newer click
    rFlood.textContent = 'error';
    rFlood.classList.add('empty');
  }
}

async function populateNearestAddress(lat, lng) {
  const result = await reverseGeocode(lat, lng);
  if (!result || !result.address) return;
  // Feed the geocode into the header hierarchy so the title upgrades from
  // raw coordinates to "Near [address]" (or "Near ~" for approximate).
  applyFlyoutHeader({ geocode: result });
  setNearestAddress(result.address);
}

map.on('click', (e) => {
  inspectPoint(e.latlng.lat, e.latlng.lng);
});
