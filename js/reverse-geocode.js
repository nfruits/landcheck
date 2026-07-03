// Nominatim reverse-geocode with a 1-req/sec throttle and an in-memory cache
// keyed by coords rounded to 4 decimal places (~11m granularity). Failures
// resolve to null — callers should treat the address as optional.
//
// Note: Nominatim's usage policy asks for a custom User-Agent, but browsers
// forbid setting the UA header from fetch(). Best we can do client-side is
// keep volume modest via cache + throttle.

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const MIN_REQUEST_INTERVAL_MS = 1000;

const cache = new Map();
let lastRequestAt = 0;
let chain = Promise.resolve();

function cacheKey(lat, lng) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

// Classify a Nominatim response by approximate precision:
//   'high'  — specific address (a building, house number, or residential)
//   'low'   — locality (city, county, region) or unknown
function classifyConfidence(data) {
  if (!data) return 'low';
  if (data.address && data.address.house_number) return 'high';
  const t = String(data.type || '').toLowerCase();
  const c = String(data.class || '').toLowerCase();
  if (t === 'house' || t === 'residential' || t === 'address' ||
      t === 'building' || c === 'building') return 'high';
  return 'low';
}

export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null) return null;
  const key = cacheKey(lat, lng);
  if (cache.has(key)) return cache.get(key);

  // Serialise + throttle: every request waits for the previous to settle and
  // then enforces a minimum gap since the last network attempt.
  const next = chain.then(async () => {
    const gap = Date.now() - lastRequestAt;
    if (gap < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL_MS - gap));
    }
    lastRequestAt = Date.now();
    try {
      const url = `${NOMINATIM_REVERSE_URL}?lat=${lat}&lon=${lng}&format=json&zoom=18`;
      const r = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!r.ok) return null;
      const data = await r.json();
      if (!data || !data.display_name) {
        cache.set(key, null);
        return null;
      }
      const result = { address: data.display_name, confidence: classifyConfidence(data) };
      cache.set(key, result);
      return result;
    } catch {
      return null;
    }
  });
  chain = next.catch(() => null);
  return next;
}

// Test helper
export const __reverseGeocodeInternals = {
  clearCache: () => cache.clear(),
  cacheSize: () => cache.size
};
