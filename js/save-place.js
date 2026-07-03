// Inline "Save this place" form inside the fly-out. Tracks the currently-
// inspected location (set by lookups.inspectPoint or a parcel-click handler),
// pre-fills the label placeholder with the reverse-geocoded address, and on
// submit persists to saved-places. Re-opening an already-saved location
// flips the button to "Saved — Edit" with the form pre-populated.

import { savedPlaces } from './saved-places.js';

const btn        = document.getElementById('save-place');
const form       = document.getElementById('save-place-form');
const labelInput = document.getElementById('sp-label');
const notesInput = document.getElementById('sp-notes');
const saveBtn    = document.getElementById('sp-save');
const cancelBtn  = document.getElementById('sp-cancel');

let context = { lat: null, lng: null, parcelId: null, parcelMeta: null, nearestAddress: null };
let existing = null;

function nearbyEntry() {
  if (context.lat == null || context.lng == null) return null;
  return savedPlaces.findByCoords(context.lat, context.lng);
}

function refreshButton() {
  if (!btn) return;
  existing = nearbyEntry();
  btn.textContent = existing ? 'Saved — Edit' : '★ Save this place';
}

function showForm() {
  if (!form || !btn) return;
  form.hidden = false;
  btn.hidden = true;
  if (existing) {
    labelInput.value = existing.label || '';
    notesInput.value = existing.notes || '';
    labelInput.placeholder = existing.nearestAddress || 'Optional label, e.g. Aunt Mary\'s lot';
  } else {
    labelInput.value = '';
    notesInput.value = '';
    labelInput.placeholder = context.nearestAddress || "Optional label, e.g. Aunt Mary's lot";
  }
}

function hideForm() {
  if (form) form.hidden = true;
  if (btn) btn.hidden = false;
}

function save() {
  const payload = {
    lat: context.lat,
    lng: context.lng,
    label: labelInput.value.trim() || null,
    notes: notesInput.value.trim() || null,
    parcelId: context.parcelId,
    parcelMeta: context.parcelMeta,
    nearestAddress: context.nearestAddress
  };
  if (existing) {
    savedPlaces.update(existing.id, payload);
  } else {
    savedPlaces.add(payload);
  }
  hideForm();
  refreshButton();
}

if (btn) btn.addEventListener('click', showForm);
if (saveBtn) saveBtn.addEventListener('click', save);
if (cancelBtn) cancelBtn.addEventListener('click', hideForm);

savedPlaces.subscribe(() => refreshButton());

// Called by lookups.inspectPoint and parcels click handler so this module
// knows what location the user is currently inspecting.
export function setSaveContext(lat, lng, extras = {}) {
  context = { lat, lng, parcelId: null, parcelMeta: null, nearestAddress: null, ...extras };
  refreshButton();
  hideForm();
}

export function setNearestAddress(text) {
  context.nearestAddress = text;
  // Refresh placeholder if form is currently open
  if (form && !form.hidden && !existing) {
    labelInput.placeholder = text || "Optional label, e.g. Aunt Mary's lot";
  }
}

// Test hook
export const savePlaceApi = {
  setContext: setSaveContext,
  isFormOpen: () => form && !form.hidden,
  showForm,
  hideForm
};
