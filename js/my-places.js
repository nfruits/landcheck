// My Places sidebar section. Lists every entry in saved-places with inline
// edit/delete affordances; selecting 2+ entries via checkboxes enables a
// "Compare N Selected" button that fires a CustomEvent picked up by
// parcels.js, which absorbs them into the existing compare modal.

import { map } from './map.js';
import { savedPlaces } from './saved-places.js';
import { inspectPoint } from './lookups.js';
import { setupInfoIcons } from './info-icon.js';
import { escapeHtml } from './escape.js';

const listEl  = document.getElementById('my-places-list');
const emptyEl = document.getElementById('my-places-empty');
const compareBtn = document.getElementById('compare-selected');

const selected = new Set();
let editingId = null;
let confirmingDeleteId = null;


function entryDisplayLabel(e) {
  if (e.label) return { text: e.label, fallback: false };
  if (e.nearestAddress) return { text: e.nearestAddress, fallback: false };
  if (e.lat != null && e.lng != null) {
    return { text: `${e.lat.toFixed(5)}, ${e.lng.toFixed(5)}`, fallback: true };
  }
  if (e.parcelId) return { text: `Parcel ${e.parcelId}`, fallback: true };
  return { text: '(unlabeled)', fallback: true };
}

function notesPreview(e) {
  if (!e.notes) return '';
  return e.notes.length > 40 ? e.notes.slice(0, 40) + '…' : e.notes;
}

function syncCompareBtn() {
  if (!compareBtn) return;
  const n = selected.size;
  const enabled = n >= 2 && n <= 3;
  compareBtn.disabled = !enabled;
  compareBtn.hidden = n === 0;
  compareBtn.textContent = enabled
    ? `Compare ${n} Selected`
    : (n === 1 ? 'Select one more to compare' : 'Compare Selected');
}

function render() {
  if (!listEl || !emptyEl) return;
  const items = savedPlaces.list();
  emptyEl.hidden = items.length > 0;
  listEl.innerHTML = '';
  for (const e of items) {
    const row = document.createElement('div');
    row.className = 'mp-row';
    row.dataset.id = e.id;

    if (confirmingDeleteId === e.id) {
      const confirm = document.createElement('div');
      confirm.className = 'mp-confirm';
      confirm.innerHTML = `
        <span class="mp-confirm-text">Delete this saved place?</span>
        <button type="button" class="danger" data-action="confirm-delete">Confirm</button>
        <button type="button" data-action="cancel-delete">Cancel</button>
      `;
      row.classList.add('confirming-delete');
      row.appendChild(confirm);
    } else if (editingId === e.id) {
      const edit = document.createElement('div');
      edit.className = 'mp-edit';
      edit.innerHTML = `
        <input type="text" class="sp-input" data-edit="label" value="${escapeHtml(e.label || '')}" placeholder="Label" />
        <textarea class="sp-textarea" data-edit="notes" rows="2" placeholder="Notes">${escapeHtml(e.notes || '')}</textarea>
        <div class="mp-edit-actions">
          <button type="button" class="tool-btn" data-action="save-edit">Save</button>
          <button type="button" class="tool-btn" data-action="cancel-edit">Cancel</button>
        </div>
      `;
      row.classList.add('editing');
      row.appendChild(edit);
    } else {
      const isChecked = selected.has(e.id);
      const { text, fallback } = entryDisplayLabel(e);
      row.innerHTML = `
        <input type="checkbox" class="mp-check" ${isChecked ? 'checked' : ''} aria-label="Select for compare" />
        <div class="mp-text">
          <div class="mp-label ${fallback ? 'fallback' : ''}">${escapeHtml(text)}</div>
          ${e.notes ? `<div class="mp-notes">${escapeHtml(notesPreview(e))}</div>` : ''}
        </div>
        <button type="button" class="mp-icon-btn" data-action="edit" aria-label="Edit">✎</button>
        <button type="button" class="mp-icon-btn delete" data-action="delete" aria-label="Delete">×</button>
      `;
    }
    listEl.appendChild(row);
  }
  syncCompareBtn();
  setupInfoIcons();
}

function flyToEntry(e) {
  if (e.lat == null || e.lng == null) return;
  map.setView([e.lat, e.lng], 18);
  inspectPoint(e.lat, e.lng);
}

function handleClick(ev) {
  const row = ev.target.closest('.mp-row');
  if (!row) return;
  const id = row.dataset.id;
  const action = ev.target.dataset.action;

  if (action === 'edit') {
    editingId = id;
    confirmingDeleteId = null;
    render();
    return;
  }
  if (action === 'delete') {
    confirmingDeleteId = id;
    editingId = null;
    render();
    return;
  }
  if (action === 'confirm-delete') {
    confirmingDeleteId = null;
    selected.delete(id);
    savedPlaces.remove(id);
    return;
  }
  if (action === 'cancel-delete') {
    confirmingDeleteId = null;
    render();
    return;
  }
  if (action === 'save-edit') {
    const labelEl = row.querySelector('[data-edit="label"]');
    const notesEl = row.querySelector('[data-edit="notes"]');
    // Clear editing state BEFORE update so the subscribe-triggered render
    // shows the saved row, not the still-open form.
    editingId = null;
    savedPlaces.update(id, {
      label: labelEl.value.trim() || null,
      notes: notesEl.value.trim() || null
    });
    return;
  }
  if (action === 'cancel-edit') {
    editingId = null;
    render();
    return;
  }
  if (ev.target.matches('.mp-check')) {
    if (ev.target.checked) selected.add(id);
    else selected.delete(id);
    syncCompareBtn();
    return;
  }
  // Plain row click → fly to location
  const entry = savedPlaces.get(id);
  if (entry) flyToEntry(entry);
}

if (listEl) listEl.addEventListener('click', handleClick);

// Compare-selected button: opens the compare modal sourced from selected places.
if (compareBtn) {
  compareBtn.addEventListener('click', () => {
    const ids = Array.from(selected);
    window.dispatchEvent(new CustomEvent('parcel:compareSavedPlaces', { detail: { ids } }));
  });
}

savedPlaces.subscribe(render);
render();

export const myPlaces = {
  selected: () => Array.from(selected),
  select: (id) => { selected.add(id); syncCompareBtn(); render(); },
  clearSelection: () => { selected.clear(); syncCompareBtn(); render(); },
  __render: render
};
