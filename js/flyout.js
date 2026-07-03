// Sliding right-side detail panel. Opens whenever a map click produces data
// (elevation, flood, parcel, soil); subsequent clicks update its content
// in-place. Dismiss via the close button, the ESC key, or programmatically
// via closeFlyout().

import { savedPlaces } from './saved-places.js';
import { PARCEL_COUNTIES } from './config.js';

const flyoutEl = document.getElementById('flyout');
const titleEl = document.getElementById('flyout-title');
const subtitleEl = document.getElementById('flyout-nearest');
const closeBtn = document.getElementById('flyout-close');

let isOpen = false;
// Latest context for the open fly-out so async reverse-geocode arrivals can
// re-apply the header hierarchy without losing previously-set parcel data.
let lastContext = {};

export function openFlyout(title) {
  if (!flyoutEl) return;
  if (title && titleEl) titleEl.textContent = title;
  flyoutEl.classList.add('open');
  flyoutEl.setAttribute('aria-hidden', 'false');
  isOpen = true;
  // Mobile: the fly-out is full-screen above the bottom sheet — drop the
  // sheet to its peek state so closing the fly-out reveals the map, not a
  // stale expanded panel.
  if (window.matchMedia('(max-width: 820px)').matches) {
    const aside = document.querySelector('aside');
    if (aside) aside.dataset.sheet = 'peek';
  }
}

export function closeFlyout() {
  if (!flyoutEl) return;
  flyoutEl.classList.remove('open');
  flyoutEl.setAttribute('aria-hidden', 'true');
  isOpen = false;
}

// Legacy setter used by callers that just want a raw string. Prefer
// applyFlyoutHeader for full context-driven priority handling.
export function setFlyoutTitle(title) {
  if (titleEl) titleEl.textContent = title || '— click the map';
}

export function isFlyoutOpen() { return isOpen; }

function pickField(props, candidates) {
  if (!props) return null;
  for (const k of candidates || []) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') return props[k];
  }
  return null;
}

function coordStr(lat, lng) {
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

// Apply the priority hierarchy:
//   1. Saved-place custom label
//   2. Parcel #ID — Owner Name (when owner present)
//   3. Parcel #ID (when parcel without owner)
//   4. Near [address]                  (high-confidence)
//      Near ~ [address]                (low-confidence, muted)
//   5. Coordinates
// Coordinates always appear as the small subtitle line below the title.
// Title text is visually clamped to 2 lines (CSS -webkit-line-clamp), so
// mirror the full string into the title attribute — long geocoded addresses
// stay recoverable on hover.
function setTitle(text) {
  titleEl.textContent = text;
  titleEl.title = text;
}

export function applyFlyoutHeader(context = {}) {
  if (!titleEl) return;
  lastContext = { ...lastContext, ...context };
  const { lat, lng, parcelId, parcelMeta, geocode } = lastContext;
  const hasCoords = lat != null && lng != null;

  // Reset any prior approximate-confidence styling
  if (subtitleEl) {
    subtitleEl.classList.remove('approximate');
    subtitleEl.textContent = '';
  }
  titleEl.classList.remove('flyout-title-approximate');

  // 1. Saved label
  if (hasCoords) {
    const saved = savedPlaces.findByCoords(lat, lng);
    if (saved && saved.label) {
      setTitle(saved.label);
      if (subtitleEl) subtitleEl.textContent = coordStr(lat, lng);
      return;
    }
  }

  // 2 + 3. Parcel-based labels
  if (parcelId) {
    let owner = null;
    if (parcelMeta && parcelMeta.county) {
      const cfg = PARCEL_COUNTIES[parcelMeta.county];
      owner = pickField(parcelMeta, cfg?.fieldMap?.owner);
    }
    setTitle(owner ? `Parcel ${parcelId} — ${owner}` : `Parcel ${parcelId}`);
    if (subtitleEl && hasCoords) subtitleEl.textContent = coordStr(lat, lng);
    return;
  }

  // 4. Reverse-geocoded address
  if (geocode && geocode.address) {
    const approximate = geocode.confidence !== 'high';
    setTitle(approximate ? `Near ~ ${geocode.address}` : `Near ${geocode.address}`);
    if (approximate) titleEl.classList.add('flyout-title-approximate');
    if (subtitleEl && hasCoords) subtitleEl.textContent = coordStr(lat, lng);
    return;
  }

  // 5. Coords fallback
  setTitle(hasCoords ? coordStr(lat, lng) : '— click the map');
  if (subtitleEl) subtitleEl.textContent = '';
}

// Reset internal state so the next click starts fresh.
export function resetFlyoutContext() {
  lastContext = {};
}

// Read-only view of the last context — used by the PDF report so its title
// can apply the same priority hierarchy as the fly-out itself.
export function getFlyoutContext() {
  return { ...lastContext };
}

if (closeBtn) closeBtn.addEventListener('click', closeFlyout);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isOpen) closeFlyout();
});
