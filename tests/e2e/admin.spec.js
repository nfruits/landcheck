import { test, expect } from '@playwright/test';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

async function stubTiger(page) {
  // Boundary feature-query endpoints (Esri Living Atlas) + TIGERweb places:
  // return an empty GeoJSON FeatureCollection so layers materialise without
  // rendering anything (sufficient for state checks).
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    })
  );
  await page.route('**/USA_Counties_Generalized_Boundaries/FeatureServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    })
  );
  await page.route('**/tigerweb.geo.census.gov/**/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    })
  );
  // Tile-export endpoints: a 1x1 transparent PNG.
  await page.route('**/tigerweb.geo.census.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  );
}

async function bootAdmin(page) {
  await stubTiger(page);
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.admin);
  await page.evaluate(() => {
    localStorage.removeItem('admin.toggles');
    localStorage.removeItem('admin.minZoomOverrides');
  });
  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.admin);
}

test('admin toggles start inactive and expose test hook', async ({ page }) => {
  await bootAdmin(page);
  expect(await page.evaluate(() => window.__parcel.admin.isActive())).toBe(false);
  expect(await page.evaluate(() => window.__parcel.admin.activeLayers())).toEqual([]);
});

test('states toggle: zoom 5 inside range → states layer materialises', async ({ page }) => {
  await bootAdmin(page);
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await expect(page.locator('.admin-toggle[data-layer="admin-states"]')).toHaveClass(/active/);
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('states'));
});

test('counties toggle at zoom 5 shows hint, materialises after zooming in', async ({ page }) => {
  await bootAdmin(page);
  // Force zoom 5 — the app now boots at the MD/NoVA fallback at zoom 9
  // (which is already above the counties minZoom of 6), so we have to drop
  // back below the threshold to exercise the hint path. Use setView so the
  // moveend handler doesn't fire halfway through.
  await page.evaluate(() => window.__parcel.map.setView([38.85, -77.10], 5, { animate: false }));
  await page.click('.admin-toggle[data-layer="admin-counties"]');
  await expect(page.locator('#toast')).toContainText(/zoom 6\+/i);
  expect(await page.evaluate(() => window.__parcel.admin.activeLayers())).not.toContain('counties');

  await page.evaluate(() => window.__parcel.map.setView([38.85, -77.10], 8, { animate: false }));
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('counties'));
});

test('multiple toggles render independently', async ({ page }) => {
  await bootAdmin(page);
  await page.evaluate(() => window.__parcel.map.setZoom(12));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await page.click('.admin-toggle[data-layer="admin-counties"]');
  await page.click('.admin-toggle[data-layer="admin-places"]');
  await page.waitForFunction(() =>
    ['states', 'counties', 'places'].every(k => window.__parcel.admin.activeLayers().includes(k))
  );
  // Streets has minZoom 14, should still be off at zoom 12
  expect(await page.evaluate(() => window.__parcel.admin.activeLayers())).not.toContain('streets');
});

test('toggle state persists across reload', async ({ page }) => {
  await bootAdmin(page);
  await page.evaluate(() => window.__parcel.map.setZoom(8));
  await page.click('.admin-toggle[data-layer="admin-counties"]');
  await page.waitForFunction(() => window.__parcel.admin.wantedLayers().includes('counties'));

  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.admin);
  // The intent should survive
  expect(await page.evaluate(() => window.__parcel.admin.wantedLayers())).toContain('counties');
  await expect(page.locator('.admin-toggle[data-layer="admin-counties"]')).toHaveClass(/active/);
});

test('feature renderer: states query URL targets Esri Living Atlas generalised states', async ({ page }) => {
  await bootAdmin(page);
  const url = await page.evaluate(() => window.__parcel.admin.sampleTileUrl('states'));
  expect(url).toContain('/USA_States_Generalized_Boundaries/FeatureServer/0/query');
});

test('feature renderer: counties query URL targets Esri Living Atlas generalised counties', async ({ page }) => {
  await bootAdmin(page);
  const url = await page.evaluate(() => window.__parcel.admin.sampleTileUrl('counties'));
  expect(url).toContain('/USA_Counties_Generalized_Boundaries/FeatureServer/0/query');
});

test('tile renderer: streets export URL includes /Transportation/MapServer/export', async ({ page }) => {
  await bootAdmin(page);
  const url = await page.evaluate(() => window.__parcel.admin.sampleTileUrl('streets'));
  expect(url).toContain('/Transportation/MapServer/export');
});

test('per-tier boundary colors are distinct and saturated', async ({ page }) => {
  await bootAdmin(page);
  const colors = await page.evaluate(() => ({
    states:   window.__parcel.admin.tierColor('states'),
    counties: window.__parcel.admin.tierColor('counties'),
    places:   window.__parcel.admin.tierColor('places'),
    streets:  window.__parcel.admin.tierColor('streets')
  }));
  expect(colors.states).toMatch(/^#d6/i);   // saturated red
  expect(colors.counties).toMatch(/^#e8/i); // orange
  expect(colors.places).toMatch(/^#7b/i);   // purple
  // streets is tile-rendered; color comes from the server, not the client
  expect(colors.streets).toBeFalsy();
  // All three feature-rendered colors are distinct
  expect(new Set([colors.states, colors.counties, colors.places]).size).toBe(3);
});

test('boundary gear: opens edit mode and reveals number inputs', async ({ page }) => {
  await bootAdmin(page);
  await expect(page.locator('.boundary-zoom-input').first()).toBeHidden();
  await page.click('#boundary-gear');
  await expect(page.locator('#admin-panel')).toHaveClass(/edit-mode/);
  await expect(page.locator('.boundary-zoom-input').first()).toBeVisible();
  // Default values surfaced
  expect(await page.locator('[data-zoom-for="states"]').inputValue()).toBe('3');
  expect(await page.locator('[data-zoom-for="counties"]').inputValue()).toBe('6');
});

test('boundary gear: setting an override persists to localStorage and re-syncs', async ({ page }) => {
  await bootAdmin(page);
  await page.click('#boundary-gear');
  // Bump states minZoom to 8
  await page.locator('[data-zoom-for="states"]').fill('8');
  await page.locator('[data-zoom-for="states"]').dispatchEvent('change');
  // Persisted
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('admin.minZoomOverrides') || '{}')
  );
  expect(stored.states).toBe(8);
  // effectiveMinZoom reflects the override
  expect(await page.evaluate(() => window.__parcel.admin.effectiveMinZoom('states'))).toBe(8);

  // Exit edit mode so the row click toggles the layer normally.
  await page.click('#boundary-gear');
  await expect(page.locator('#admin-panel')).not.toHaveClass(/edit-mode/);

  // At zoom 5 (below override of 8) states should not materialise even when on.
  await page.evaluate(() => window.__parcel.map.setZoom(5));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  expect(await page.evaluate(() => window.__parcel.admin.wantedLayers())).toContain('states');
  expect(await page.evaluate(() => window.__parcel.admin.activeLayers())).not.toContain('states');
});

test('boundary gear: input is clamped to [0,20]', async ({ page }) => {
  await bootAdmin(page);
  await page.evaluate(() => window.__parcel.admin.setMinZoomOverride('counties', 42));
  expect(await page.evaluate(() => window.__parcel.admin.effectiveMinZoom('counties'))).toBe(20);
  await page.evaluate(() => window.__parcel.admin.setMinZoomOverride('counties', -5));
  expect(await page.evaluate(() => window.__parcel.admin.effectiveMinZoom('counties'))).toBe(0);
});

test('state-line rendering: activating States at z=4 produces visible geometry within 3s', async ({ page }) => {
  await bootAdmin(page);
  // Stub AFTER bootAdmin so this specific route shadows bootAdmin's wildcard.
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { NAME: 'Test State' },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-80, 35], [-75, 35], [-75, 40], [-80, 40], [-80, 35]
            ]]
          }
        }]
      })
    })
  );
  await page.evaluate(() => localStorage.removeItem('admin.cache.states'));
  await page.evaluate(() => window.__parcel.map.setZoom(4));
  await page.click('.admin-toggle[data-layer="admin-states"]');

  // Within 3s, the states featureGroup should render. With Canvas renderer
  // polygons live on a single canvas; with SVG they'd live as individual paths.
  // Accept either.
  await page.waitForFunction(
    () => document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').length > 0,
    null,
    { timeout: 3000 }
  );
  const elCount = await page.locator('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').count();
  expect(elCount).toBeGreaterThan(0);
});

test('state-line perf: render under 1.5s on first load, pan under 500ms, cache populated', async ({ page }) => {
  // Realistic-ish payload: 50 state polygons with ~6-point geometry each.
  const features = [];
  for (let i = 0; i < 50; i++) {
    const lng = -100 + (i % 10) * 5;
    const lat = 30 + Math.floor(i / 10) * 4;
    features.push({
      type: 'Feature',
      properties: { NAME: `State ${i}` },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng, lat], [lng + 4, lat], [lng + 4, lat + 3],
          [lng + 2, lat + 4], [lng, lat + 3], [lng, lat]
        ]]
      }
    });
  }
  await bootAdmin(page);
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features })
    })
  );
  await page.evaluate(() => localStorage.removeItem('admin.cache.states'));
  await page.evaluate(() => window.__parcel.map.setZoom(4));

  // Measure render time end-to-end (click → SVG path in DOM).
  const renderTime = await page.evaluate(async () => {
    const toggle = document.querySelector('.admin-toggle[data-layer="admin-states"]');
    const t0 = performance.now();
    toggle.click();
    while (document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').length === 0) {
      await new Promise(r => setTimeout(r, 16));
      if (performance.now() - t0 > 5000) break;
    }
    return performance.now() - t0;
  });
  expect(renderTime).toBeLessThan(1500);

  // Cache populated
  const cached = await page.evaluate(() => localStorage.getItem('admin.cache.states'));
  expect(cached).toBeTruthy();
  const parsed = JSON.parse(cached);
  expect(parsed.d.features.length).toBeGreaterThan(0);

  // Pan time: moveend → < 500ms after panBy
  const panTime = await page.evaluate(() => new Promise(resolve => {
    const m = window.__parcel.map;
    const t0 = performance.now();
    m.once('moveend', () => resolve(performance.now() - t0));
    m.panBy([240, 120]);
  }));
  expect(panTime).toBeLessThan(500);
});

test('state-line perf: counties (3000 features) pan under 600ms', async ({ page }) => {
  // 3000 small county polygons — close to the real TIGERweb layer 13 size.
  const features = [];
  for (let i = 0; i < 3000; i++) {
    const lng = -100 + (i % 60) * 0.6;
    const lat = 30 + Math.floor(i / 60) * 0.6;
    features.push({
      type: 'Feature',
      properties: { NAME: `County ${i}` },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [lng, lat], [lng + 0.5, lat], [lng + 0.5, lat + 0.5],
          [lng, lat + 0.5], [lng, lat]
        ]]
      }
    });
  }
  await bootAdmin(page);
  await page.route('**/USA_Counties_Generalized_Boundaries/FeatureServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features })
    })
  );
  await page.evaluate(() => localStorage.removeItem('admin.cache.counties'));
  await page.evaluate(() => window.__parcel.map.setZoom(8));
  await page.click('.admin-toggle[data-layer="admin-counties"]');
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').length > 0);

  const panTime = await page.evaluate(() => new Promise(resolve => {
    const m = window.__parcel.map;
    const t0 = performance.now();
    m.once('moveend', () => resolve(performance.now() - t0));
    m.panBy([200, 100]);
  }));
  expect(panTime).toBeLessThan(600);
});

test('feature cache: states fetch fires once on activate, panning produces no further /query', async ({ page }) => {
  await bootAdmin(page);
  // Register the counter route AFTER bootAdmin so it takes precedence over
  // stubTiger's wildcard for /query URLs (Playwright LIFOs route order).
  let queryCount = 0;
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route => {
    queryCount++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    });
  });
  await page.evaluate(() => localStorage.removeItem('admin.cache.states'));
  await page.evaluate(() => window.__parcel.map.setZoom(5));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('states'));
  await page.waitForTimeout(300);
  const initialCount = queryCount;
  expect(initialCount).toBe(1);

  // Pan + zoom around — no additional /query should fire.
  await page.evaluate(() => window.__parcel.map.panBy([200, 100]));
  await page.evaluate(() => window.__parcel.map.setZoom(7));
  await page.waitForTimeout(400);
  expect(queryCount).toBe(initialCount);
});

test('feature cache: second activation reads from localStorage, no network call', async ({ page }) => {
  await bootAdmin(page);
  let queryCount = 0;
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route => {
    queryCount++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    });
  });
  await page.evaluate(() => {
    localStorage.setItem('admin.cache.states', JSON.stringify({
      t: Date.now(),
      d: { type: 'FeatureCollection', features: [] }
    }));
  });
  await page.evaluate(() => window.__parcel.map.setZoom(5));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('states'));
  await page.waitForTimeout(300);
  expect(queryCount).toBe(0);
});

// Regression for the 2026-05-16 TIGERweb CORS bug: any /query for state or
// county geometry must go to the CORS-friendly Living Atlas endpoint, not
// TIGERweb. Counts state geometry requests, asserts: (a) toggling States on
// at z=4 renders within 1s, (b) no console CORS errors, (c) panning fires
// zero additional state-geometry network requests.
test('CORS regression: states toggle at z=4 renders in <1s, no CORS errors, no refetch on pan', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await bootAdmin(page);
  let stateQueries = 0;
  let tigerwebStateQueries = 0;
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route => {
    stateQueries++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { NAME: 'CORS Test State' },
          geometry: { type: 'Polygon', coordinates: [[
            [-80, 35], [-75, 35], [-75, 40], [-80, 40], [-80, 35]
          ]]}
        }]
      })
    });
  });
  // Any request to the OLD TIGERweb host is a regression and gets counted.
  page.on('request', r => {
    if (r.url().includes('tigerweb.geo.census.gov') && r.url().includes('State_County') && r.url().includes('query')) {
      tigerwebStateQueries++;
    }
  });
  await page.evaluate(() => localStorage.removeItem('admin.cache.states'));
  await page.evaluate(() => window.__parcel.map.setZoom(4));

  const renderTime = await page.evaluate(async () => {
    const toggle = document.querySelector('.admin-toggle[data-layer="admin-states"]');
    const t0 = performance.now();
    toggle.click();
    while (document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').length === 0) {
      await new Promise(r => setTimeout(r, 16));
      if (performance.now() - t0 > 2000) break;
    }
    return performance.now() - t0;
  });
  expect(renderTime).toBeLessThan(1000);
  expect(stateQueries).toBe(1);
  expect(tigerwebStateQueries).toBe(0);

  // Subsequent panning must not refetch state geometry.
  const before = stateQueries;
  await page.evaluate(() => window.__parcel.map.panBy([200, 100]));
  await page.evaluate(() => window.__parcel.map.panBy([-100, 50]));
  await page.waitForTimeout(300);
  expect(stateQueries).toBe(before);

  // Filter to actual CORS errors — ignore unrelated console noise (favicon
  // 404s during the test run, etc.). The CORS message string is stable across
  // browser versions.
  const corsErrors = [...consoleErrors, ...pageErrors].filter(m =>
    /CORS|Cross-Origin|Access-Control-Allow-Origin/i.test(m)
  );
  expect(corsErrors).toEqual([]);
});

// Regression for the 2026-05-16 Phase-0 state-line bug: states layer hit
// HTTP 200 + JSON error 400 (outFields=NAME against a layer with STATE_NAME),
// silently rendered nothing. Also confirms zero tigerweb.geo.census.gov
// requests for state geometry (the user's reported CORS error from cached
// JS — code path no longer touches tigerweb for states/counties).
test('state-line regression: outFields matches schema, zero tigerweb requests, geometry renders', async ({ page }) => {
  const requestedUrls = [];
  page.on('request', r => {
    if (r.url().includes('USA_States_Generalized_Boundaries') || r.url().includes('tigerweb.geo.census.gov')) {
      requestedUrls.push(r.url());
    }
  });
  await bootAdmin(page);
  // Don't pre-stub — we want to see the actual outFields the app sends.
  // Substitute a permissive route AFTER bootAdmin so we capture URLs but
  // still return a usable payload.
  let livingAtlasHits = 0;
  await page.route('**/USA_States_Generalized_Boundaries/FeatureServer/0/query**', route => {
    livingAtlasHits++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { STATE_NAME: 'Virginia', STATE_ABBR: 'VA' },
          geometry: { type: 'Polygon', coordinates: [[
            [-83, 36], [-75, 36], [-75, 40], [-83, 40], [-83, 36]
          ]]}
        }]
      })
    });
  });
  await page.evaluate(() => localStorage.removeItem('admin.cache.states'));
  await page.evaluate(() => window.__parcel.map.setZoom(4));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('states'));
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-overlay-pane canvas, .leaflet-overlay-pane svg path').length > 0, null, { timeout: 3000 });

  // The Living Atlas endpoint was called.
  expect(livingAtlasHits).toBeGreaterThan(0);
  // The outFields param matches the schema (STATE_NAME present, not bare NAME).
  const laReq = requestedUrls.find(u => u.includes('USA_States_Generalized_Boundaries'));
  expect(laReq).toBeTruthy();
  const params = new URLSearchParams(laReq.split('?')[1]);
  expect(params.get('outFields')).toContain('STATE_NAME');
  // Zero requests to tigerweb.geo.census.gov for State_County geometry.
  const tigerStateReqs = requestedUrls.filter(u =>
    u.includes('tigerweb.geo.census.gov') && u.includes('State_County')
  );
  expect(tigerStateReqs).toEqual([]);
});

// Defensive: the cache-version migration must clear stale admin.cache.* entries
// from a prior shape so a returning user doesn't render with old geometry.
test('cache-version migration evicts stale admin.cache.* on version bump', async ({ page }) => {
  await bootAdmin(page);
  // Plant a stale cache with the wrong version stamp.
  await page.evaluate(() => {
    localStorage.setItem('admin.cache.states', JSON.stringify({ t: Date.now(), d: { type: 'FeatureCollection', features: [{}] } }));
    localStorage.setItem('admin.cache.counties', JSON.stringify({ t: Date.now(), d: { type: 'FeatureCollection', features: [{}] } }));
    localStorage.setItem('admin.cache.version', '0'); // simulate pre-bump
  });
  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.admin);
  const left = await page.evaluate(() => ({
    states: localStorage.getItem('admin.cache.states'),
    counties: localStorage.getItem('admin.cache.counties'),
    version: localStorage.getItem('admin.cache.version')
  }));
  expect(left.states).toBeNull();
  expect(left.counties).toBeNull();
  // Version updated to current.
  expect(Number(left.version)).toBeGreaterThanOrEqual(2);
});

test('toggling off removes the layer from the map', async ({ page }) => {
  await bootAdmin(page);
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('states'));
  await page.click('.admin-toggle[data-layer="admin-states"]');
  await expect(page.locator('.admin-toggle[data-layer="admin-states"]')).not.toHaveClass(/active/);
  expect(await page.evaluate(() => window.__parcel.admin.activeLayers())).not.toContain('states');
});

// Bug 6 regression (2026-05-17): the Living Atlas counties endpoint puts the
// `exceededTransferLimit` flag at `data.properties.exceededTransferLimit` when
// `f=geojson`, NOT at the top level (the top level is where `f=json` puts it).
// The pagination loop in admin.js was checking `data.exceededTransferLimit`
// only, so it always saw `undefined` → falsy → terminated after page 1. Page 1
// of the 3144-feature counties layer happens to contain the first 35 states
// alphabetically (Alabama through ~Iowa); MD/VA/WV/TX are all on page 2 and
// were silently never fetched. Users saw counties render in the western US but
// not in the mid-Atlantic — the bug they reported but the prior session
// misdiagnosed as a stale-cache issue.
//
// The mock here mirrors the real endpoint shape exactly:
//   - Page 1 (resultOffset=0): 2000 features, NO MD/VA/WV/TX, with
//     `properties.exceededTransferLimit: true` (geojson convention).
//   - Page 2 (resultOffset=2000): 1144 features INCLUDING MD/VA/WV/TX, no
//     exceededTransferLimit flag.
// A test that mocks both pages identically (the pre-fix shape) would have
// silently passed on the buggy code — that's why the original Bug 5 6-feature
// fixture failed to catch this.
test('Bug 6 regression: f=geojson pagination follows properties.exceededTransferLimit', async ({ page }) => {
  // Build a realistic page 1: 50 features per "filler" state (none of which
  // are MD/VA/WV/TX), times 40 states = 2000. Polygons are tiny throwaways.
  const FILLER_STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas',
    'Kentucky','Louisiana','Maine','Massachusetts','Michigan','Minnesota',
    'Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota',
    'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
    'South Dakota','Tennessee'
  ];
  const page1Features = [];
  for (let s = 0; s < FILLER_STATES.length; s++) {
    for (let c = 0; c < 50; c++) {
      const lng = -100 + (s % 10) * 0.05;
      const lat = 40 + (c % 5) * 0.05;
      page1Features.push({
        type: 'Feature',
        properties: { NAME: `${FILLER_STATES[s]} County ${c}`, STATE_NAME: FILLER_STATES[s] },
        geometry: { type: 'Polygon', coordinates: [[
          [lng, lat], [lng + 0.04, lat], [lng + 0.04, lat + 0.04], [lng, lat + 0.04], [lng, lat]
        ]]}
      });
    }
  }
  // Page 2: target states (MD, VA, WV, TX) live here — plus a sprinkling of
  // other states to mimic the real distribution.
  const TARGET_FEATURES = [
    { state: 'Maryland', name: 'Montgomery',     poly: [[-77.5, 39.0], [-76.9, 39.0], [-76.9, 39.3], [-77.5, 39.3], [-77.5, 39.0]] },
    { state: 'Maryland', name: 'Prince Georges', poly: [[-77.0, 38.7], [-76.6, 38.7], [-76.6, 39.0], [-77.0, 39.0], [-77.0, 38.7]] },
    { state: 'Virginia', name: 'Fairfax',        poly: [[-77.5, 38.6], [-77.0, 38.6], [-77.0, 39.0], [-77.5, 39.0], [-77.5, 38.6]] },
    { state: 'Virginia', name: 'Loudoun',        poly: [[-77.9, 38.9], [-77.4, 38.9], [-77.4, 39.3], [-77.9, 39.3], [-77.9, 38.9]] },
    { state: 'West Virginia', name: 'Jefferson', poly: [[-78.0, 39.1], [-77.6, 39.1], [-77.6, 39.5], [-78.0, 39.5], [-78.0, 39.1]] },
    { state: 'West Virginia', name: 'Berkeley',  poly: [[-78.2, 39.3], [-77.8, 39.3], [-77.8, 39.6], [-78.2, 39.6], [-78.2, 39.3]] },
    { state: 'Texas',    name: 'Travis',         poly: [[-97.9, 30.2], [-97.5, 30.2], [-97.5, 30.5], [-97.9, 30.5], [-97.9, 30.2]] },
    { state: 'Texas',    name: 'Harris',         poly: [[-95.6, 29.6], [-95.1, 29.6], [-95.1, 30.1], [-95.6, 30.1], [-95.6, 29.6]] }
  ];
  const page2Features = TARGET_FEATURES.map(f => ({
    type: 'Feature',
    properties: { NAME: `${f.name} County`, STATE_NAME: f.state },
    geometry: { type: 'Polygon', coordinates: [f.poly] }
  }));
  // Pad page 2 out to a realistic-ish size so it doesn't look like an empty
  // page that should terminate fetch.
  for (let i = 0; i < 1136; i++) {
    page2Features.push({
      type: 'Feature',
      properties: { NAME: `Filler ${i}`, STATE_NAME: 'Wisconsin' },
      geometry: { type: 'Polygon', coordinates: [[
        [-90, 44 + i * 0.001], [-89.95, 44 + i * 0.001],
        [-89.95, 44.05 + i * 0.001], [-90, 44.05 + i * 0.001], [-90, 44 + i * 0.001]
      ]]}
    });
  }

  let page1Hits = 0;
  let page2Hits = 0;
  await bootAdmin(page);
  // Route AFTER bootAdmin so this takes precedence over the wildcard stub.
  await page.route('**/USA_Counties_Generalized_Boundaries/FeatureServer/0/query**', route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('resultOffset') || 0);
    if (offset === 0) {
      page1Hits++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          // Real geojson responses from Living Atlas put this flag here, not
          // at the top level. If admin.js only checks top-level, page 2 is
          // never requested and MD/VA/WV/TX silently never load.
          properties: { exceededTransferLimit: true },
          features: page1Features
        })
      });
    }
    if (offset === 2000) {
      page2Hits++;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          type: 'FeatureCollection',
          features: page2Features
        })
      });
    }
    // Any later page is empty — terminates pagination.
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ type: 'FeatureCollection', features: [] })
    });
  });
  await page.evaluate(() => localStorage.removeItem('admin.cache.counties'));
  await page.evaluate(() => window.__parcel.map.setView([39.0, -77.5], 8));
  await page.click('.admin-toggle[data-layer="admin-counties"]');
  await page.waitForFunction(() => window.__parcel.admin.activeLayers().includes('counties'));
  // Cache must end up with MD/VA/WV/TX features. Pre-fix this hangs forever
  // because the cache only has the 2000 filler features (no target states).
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('admin.cache.counties');
    if (!raw) return false;
    const obj = JSON.parse(raw);
    const states = new Set(obj.d?.features?.map(f => f.properties.STATE_NAME) || []);
    return ['Maryland', 'Virginia', 'West Virginia', 'Texas'].every(s => states.has(s));
  }, null, { timeout: 5000 });

  // Both pages should have been fetched exactly once.
  expect(page1Hits).toBe(1);
  expect(page2Hits).toBe(1);

  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('admin.cache.counties')));
  expect(cached.d.features.length).toBe(2000 + page2Features.length);
  const states = new Set(cached.d.features.map(f => f.properties.STATE_NAME));
  for (const s of ['Maryland', 'Virginia', 'West Virginia', 'Texas']) {
    expect(states.has(s)).toBe(true);
  }
});
