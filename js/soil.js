// SSURGO point-click detail. POSTs a SQL query to USDA Soil Data Access
// joining mapunit → component → copmgrp and using
// SDA_Get_Mukey_from_intersection_with_WktWgs84 to look up the soil unit
// at the clicked lat/lng. Renders into the fly-out's Soil section.

import { SDA_URL } from './config.js';

const FIELDS = [
  ['s-name', 'muname'],
  ['s-drain', 'drainagecl'],
  ['s-hydric', 'hydricrating'],
  ['s-farm', 'farmlndcl'],
  ['s-slope', null],
  ['s-parent', 'pmgroupname']
];

function setRow(id, value) {
  const el = document.getElementById(id);
  if (value === null || value === undefined || value === '') {
    el.textContent = '—';
    el.classList.add('empty');
  } else {
    el.textContent = value;
    el.classList.remove('empty');
  }
}

function setLoading() {
  for (const [id] of FIELDS) {
    const el = document.getElementById(id);
    el.innerHTML = '<span class="loading"></span>';
    el.classList.remove('empty');
  }
}

export function clearSoilPanel() {
  for (const [id] of FIELDS) setRow(id, null);
  document.getElementById('s-name').textContent = '— click map with Soil active';
}

function setNoCoverage() {
  document.getElementById('s-name').textContent = 'No soil data at this location';
  document.getElementById('s-name').classList.add('empty');
  for (const [id] of FIELDS.slice(1)) setRow(id, null);
}

function setError() {
  document.getElementById('s-name').textContent = 'soil lookup error';
  document.getElementById('s-name').classList.add('empty');
  for (const [id] of FIELDS.slice(1)) setRow(id, null);
}

function buildQuery(lat, lng) {
  return `SELECT TOP 1
    mu.muname, mu.farmlndcl,
    c.drainagecl, c.hydricrating, c.slope_l, c.slope_h,
    copm.pmgroupname
  FROM mapunit mu
  LEFT JOIN component c ON mu.mukey = c.mukey
  LEFT JOIN copmgrp copm ON c.cokey = copm.cokey
  WHERE mu.mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${lng} ${lat})'))
  ORDER BY c.comppct_r DESC`;
}

export async function getSoilDetail(lat, lng, signal) {
  setLoading();
  try {
    const r = await fetch(SDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: buildQuery(lat, lng), format: 'JSON+COLUMNNAME' }),
      signal
    });
    const data = await r.json();
    if (!data.Table || data.Table.length < 2) {
      setNoCoverage();
      return;
    }
    const cols = data.Table[0];
    const row = data.Table[1];
    const obj = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
    setRow('s-name', obj.muname);
    setRow('s-drain', obj.drainagecl);
    setRow('s-hydric', obj.hydricrating);
    setRow('s-farm', obj.farmlndcl);
    const slopeLow = obj.slope_l;
    const slopeHigh = obj.slope_h;
    const slope = (slopeLow != null && slopeHigh != null)
      ? `${slopeLow}%–${slopeHigh}%`
      : null;
    setRow('s-slope', slope);
    setRow('s-parent', obj.pmgroupname);
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded by a newer click
    setError();
  }
}
