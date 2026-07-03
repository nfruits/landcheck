// Coverage affordance: a small modal listing parcel-data coverage in three
// sections — Verified, Coming soon, and a footer note on what else isn't
// planned yet. Localities within each section are grouped by region (Maryland,
// Northern Virginia, Richmond area, Charlottesville area) so a user can find
// their area at a glance.

import { map } from './map.js';
import { ACTIVE_PARCEL_COUNTIES, PARCEL_COUNTIES, COUNTY_VERIFIED_STORAGE_PREFIX } from './config.js';
import { escapeHtml } from './escape.js';

const btn = document.getElementById('coverage-btn');
const modal = document.getElementById('coverage-modal');
const list = document.getElementById('coverage-list');
const closeBtn = modal?.querySelector('.coverage-close');

// Display ordering for region groups. Anything not in this list falls into
// "Other" and renders last.
const REGION_ORDER = [
  // Statewide coverage leads (the headline), then the fine-grained MD/VA tiers.
  'us-northeast', 'us-south', 'us-midwest', 'us-west',
  // metro-county groups for no-statewide states
  'ca-counties', 'az-counties', 'or-counties', 'nm-counties',
  'il-counties', 'mi-counties', 'mo-counties', 'ia-counties', 'ks-counties', 'sd-counties',
  'ga-counties', 'sc-counties', 'ok-counties', 'al-counties', 'la-counties', 'ky-counties',
  'pa-counties',
  'maryland', 'northern-virginia', 'richmond', 'charlottesville',
  'hampton-roads', 'shenandoah', 'roanoke-lynchburg', 'southside',
  'eastern-shore', 'northern-neck', 'middle-peninsula', 'southwest-virginia',
  'central-virginia'
];
const REGION_LABELS = {
  'us-northeast':       'Northeast — statewide',
  'us-south':           'South — statewide',
  'us-midwest':         'Midwest — statewide',
  'us-west':            'West — statewide',
  'ca-counties': 'California — counties', 'az-counties': 'Arizona — counties',
  'or-counties': 'Oregon — counties', 'nm-counties': 'New Mexico — counties',
  'il-counties': 'Illinois — counties', 'mi-counties': 'Michigan — counties',
  'mo-counties': 'Missouri — counties', 'ia-counties': 'Iowa — counties',
  'ks-counties': 'Kansas — counties', 'sd-counties': 'South Dakota — counties',
  'ga-counties': 'Georgia — counties', 'sc-counties': 'South Carolina — counties',
  'ok-counties': 'Oklahoma — counties', 'al-counties': 'Alabama — counties',
  'la-counties': 'Louisiana — counties', 'ky-counties': 'Kentucky — counties',
  'pa-counties': 'Pennsylvania — counties (statewide gap-fills)',
  'maryland':           'Maryland',
  'northern-virginia':  'Northern Virginia',
  'richmond':           'Richmond area',
  'charlottesville':    'Charlottesville area',
  'hampton-roads':      'Hampton Roads',
  'shenandoah':         'Shenandoah Valley',
  'roanoke-lynchburg':  'Roanoke & Lynchburg',
  'southside':          'Southside',
  'eastern-shore':      'Eastern Shore',
  'northern-neck':      'Northern Neck',
  'middle-peninsula':   'Middle Peninsula',
  'southwest-virginia': 'Southwest Virginia',
  'central-virginia':   'Central Virginia'
};


function isVerified(key) {
  const cfg = PARCEL_COUNTIES[key];
  if (!cfg) return false;
  if (cfg.verified === true) return true;
  try { return localStorage.getItem(COUNTY_VERIFIED_STORAGE_PREFIX + key) === '1'; }
  catch { return false; }
}

// Build [{region, label, items: [{key, county, verified}]}] groups.
function groupByRegion(keys) {
  const byRegion = new Map();
  for (const key of keys) {
    const county = PARCEL_COUNTIES[key];
    if (!county) continue;
    const region = county.region || 'other';
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push({ key, county, verified: isVerified(key) });
  }
  const ordered = [];
  for (const r of REGION_ORDER) if (byRegion.has(r)) ordered.push({ region: r, label: REGION_LABELS[r], items: byRegion.get(r) });
  for (const [r, items] of byRegion) {
    if (!REGION_ORDER.includes(r)) ordered.push({ region: r, label: 'Other', items });
  }
  return ordered;
}

function renderSection(titleText, groups, { clickable, statusKind } = {}) {
  if (groups.length === 0) return '';
  const sectionItems = groups.map(g => {
    const rows = g.items.map(({ key, county, verified }) => {
      const status = statusKind === 'verified' && verified
        ? '<span class="coverage-item-status verified">Verified</span>'
        : statusKind === 'verified'
          ? '<span class="coverage-item-status untested">Untested</span>'
          : statusKind === 'comingSoon'
            ? '<span class="coverage-item-status coming-soon">Coming soon</span>'
            : '';
      const reason = county.skipReason ? `<div class="coverage-item-reason">${escapeHtml(county.skipReason)}</div>` : '';
      const clickClass = clickable ? ' clickable' : '';
      return `<li class="coverage-item${clickClass}" data-key="${escapeHtml(key)}">
        <div class="coverage-item-text">
          <span class="coverage-item-name">${escapeHtml(county.label)}</span>
          ${status}
        </div>
        <span class="coverage-item-state">${escapeHtml(county.state || '')}</span>
        ${reason}
      </li>`;
    }).join('');
    return `<div class="coverage-region"><h4 class="coverage-region-label">${escapeHtml(g.label)}</h4><ul class="coverage-region-list">${rows}</ul></div>`;
  }).join('');
  return `<section class="coverage-section"><h3 class="coverage-section-title">${escapeHtml(titleText)}</h3>${sectionItems}</section>`;
}

function renderList() {
  if (!list) return;
  const verifiedKeys = ACTIVE_PARCEL_COUNTIES.filter(k => PARCEL_COUNTIES[k] && !PARCEL_COUNTIES[k].comingSoon);
  const comingSoonKeys = Object.keys(PARCEL_COUNTIES).filter(k => PARCEL_COUNTIES[k].comingSoon === true);
  const verifiedGroups = groupByRegion(verifiedKeys);
  const comingSoonGroups = groupByRegion(comingSoonKeys);

  list.innerHTML =
    renderSection('Verified', verifiedGroups, { clickable: true, statusKind: 'verified' }) +
    renderSection('Coming soon', comingSoonGroups, { clickable: true, statusKind: 'comingSoon' });

  // Wire click → fitBounds for any locality that has a bbox (verified and
  // coming-soon both qualify; coming-soon entries fly the user to the area
  // so they can see the gap on the map).
  list.querySelectorAll('.coverage-item.clickable').forEach(li => {
    li.addEventListener('click', () => {
      flyToCounty(li.dataset.key);
      closeModal();
    });
  });
}

function flyToCounty(key) {
  const county = PARCEL_COUNTIES[key];
  if (!county || !county.bbox) return;
  const [minX, minY, maxX, maxY] = county.bbox;
  map.fitBounds([[minY, minX], [maxY, maxX]], { maxZoom: 12 });
}

function openModal() {
  if (!modal) return;
  renderList();
  modal.classList.add('open');
}

function closeModal() {
  if (modal) modal.classList.remove('open');
}

if (btn) btn.addEventListener('click', openModal);
if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

export const coverageApi = {
  open: openModal,
  close: closeModal,
  flyToCounty,
  list: () => ACTIVE_PARCEL_COUNTIES.slice()
};
