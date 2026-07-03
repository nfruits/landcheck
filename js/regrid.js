// Regrid adapter — INTERFACE ONLY (not yet implemented).
//
// Regrid offers a paid nationwide parcels API (~$200/mo at time of writing for
// the smallest plan). When subscribed, this module would become the fallback
// for any geography not covered by the free county/state entries in
// `js/config.js → PARCEL_COUNTIES`. It would also unlock owner-name and sales-
// history lookups that are not exposed by most free county REST endpoints.
//
// The runtime contract this module promises to fulfil:
//
//   1. Same shape as a county entry from PARCEL_COUNTIES, so parcels.js can
//      treat Regrid as just another source. Specifically, it must expose:
//        - `kind: 'regrid'`
//        - `bbox: null` (Regrid is nationwide — never short-circuit on bbox)
//        - `fieldMap` keyed by the same logical fields (id/acres/owner/value)
//
//   2. A `fetchInBbox({ minX, minY, maxX, maxY })` function that returns a
//      GeoJSON FeatureCollection in EPSG:4326 with `properties` carrying the
//      raw Regrid attribute names. parcels.js will then read attributes via
//      `pickField(props, fieldMap.<kind>)` exactly as it does today.
//
//   3. A token loaded from `localStorage.regrid_token` (or window.REGRID_TOKEN
//      injected by the host page). Never committed.
//
// Future surface (sketch only — un-comment and implement once the user has
// purchased a plan):
//
// import { REGRID_TOKEN_STORAGE_KEY } from './config.js';
//
// const REGRID_BASE = 'https://app.regrid.com/api/v2';
//
// function getToken() {
//   return window.REGRID_TOKEN || localStorage.getItem(REGRID_TOKEN_STORAGE_KEY) || null;
// }
//
// export async function fetchInBbox(bbox) {
//   const token = getToken();
//   if (!token) return { type: 'FeatureCollection', features: [] };
//   const url = `${REGRID_BASE}/parcels.geojson?token=${encodeURIComponent(token)}`
//     + `&sw_lat=${bbox.minY}&sw_lon=${bbox.minX}`
//     + `&ne_lat=${bbox.maxY}&ne_lon=${bbox.maxX}`
//     + `&limit=500`;
//   const r = await fetch(url);
//   if (!r.ok) throw new Error(`Regrid ${r.status}`);
//   return await r.json(); // already GeoJSON
// }
//
// export const REGRID_SOURCE = {
//   label: 'Nationwide (Regrid)',
//   kind: 'regrid',
//   bbox: null,
//   fetchInBbox,
//   fieldMap: {
//     id:    ['parcelnumb', 'parcel_id', 'apn'],
//     acres: ['ll_gisacre', 'gisacre', 'acres'],
//     owner: ['owner', 'ownername'],
//     value: ['parval', 'total_value', 'mkt_val']
//   }
// };

export const regrid = {
  available: () => false,
  // Throw if anything calls these prematurely so the missing implementation
  // is loud rather than silent. parcels.js currently only consults
  // PARCEL_COUNTIES, so importing this module is safe.
  fetchInBbox: () => { throw new Error('Regrid adapter not implemented'); }
};
