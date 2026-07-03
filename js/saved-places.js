// Saved Places: per-user collection of map locations with optional labels
// and notes. Replaces the older 3-pin parcel.pinned model. Persisted under
// `parcel.savedPlaces` in localStorage.

const STORAGE_KEY = 'parcel.savedPlaces';
const OLD_PINNED_KEY = 'parcel.pinned';
const MIGRATION_FLAG = 'parcel.migrationDone';

let entries = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  for (const fn of listeners) fn(entries.slice());
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function migrateFromPinned() {
  if (localStorage.getItem(MIGRATION_FLAG) === '1') return;
  let migrated = 0;
  try {
    const raw = localStorage.getItem(OLD_PINNED_KEY);
    if (raw) {
      const old = JSON.parse(raw);
      if (Array.isArray(old)) {
        for (const p of old) {
          // The old shape was { id, county, props }. lat/lng weren't stored.
          // Carry the parcel data forward so users don't silently lose it.
          entries.push({
            id: newId(),
            label: null,
            notes: null,
            lat: null,
            lng: null,
            parcelId: p?.id ?? null,
            parcelMeta: p?.props ? { county: p.county, ...p.props } : null,
            nearestAddress: null,
            createdAt: new Date().toISOString()
          });
          migrated += 1;
        }
      }
    }
    if (migrated > 0) persist();
    localStorage.removeItem(OLD_PINNED_KEY);
  } catch {}
  localStorage.setItem(MIGRATION_FLAG, '1');
  return migrated;
}

migrateFromPinned();

export const savedPlaces = {
  list: () => entries.slice(),
  count: () => entries.length,
  get: (id) => entries.find(e => e.id === id) || null,
  add: (entry) => {
    const e = {
      id: newId(),
      label: null,
      notes: null,
      lat: null,
      lng: null,
      parcelId: null,
      parcelMeta: null,
      nearestAddress: null,
      createdAt: new Date().toISOString(),
      ...entry
    };
    entries.push(e);
    persist();
    return e;
  },
  update: (id, patch) => {
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    entries[idx] = { ...entries[idx], ...patch };
    persist();
    return entries[idx];
  },
  remove: (id) => {
    const idx = entries.findIndex(e => e.id === id);
    if (idx === -1) return false;
    entries.splice(idx, 1);
    persist();
    return true;
  },
  // For locating a place by coords (used to detect "already saved" in the fly-out).
  findByCoords: (lat, lng, epsilon = 1e-4) => {
    return entries.find(e =>
      e.lat != null && e.lng != null &&
      Math.abs(e.lat - lat) < epsilon && Math.abs(e.lng - lng) < epsilon
    ) || null;
  },
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  // Test helpers
  __reset: () => { entries = []; persist(); }
};
