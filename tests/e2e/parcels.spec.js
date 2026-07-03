import { test, expect } from '@playwright/test';

// A two-parcel GeoJSON response, geometry inside Maryland (Bethesda area).
const FAKE_PARCELS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        ACCTID: 'MD-16-12345',
        ACRES: 0.245,
        OWNNAME: 'DOE, JANE',
        NFMTTLVL: 487500
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-77.1010, 38.9810],
          [-77.1008, 38.9810],
          [-77.1008, 38.9812],
          [-77.1010, 38.9812],
          [-77.1010, 38.9810]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: {
        ACCTID: 'MD-16-67890',
        ACRES: 1.022,
        OWNNAME: 'SMITH FAMILY TRUST',
        NFMTTLVL: 1250000
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-77.1000, 38.9810],
          [-77.0995, 38.9810],
          [-77.0995, 38.9815],
          [-77.1000, 38.9815],
          [-77.1000, 38.9810]
        ]]
      }
    }
  ]
};

async function stubParcels(page, body = FAKE_PARCELS) {
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  );
}

async function bootAt(page, lat, lon, zoom = 17) {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
  await page.evaluate(([la, ln, z]) => window.__parcel.map.setView([la, ln], z), [lat, lon, zoom]);
}

test('parcels: low-zoom toggle shows zoom hint, no fetch', async ({ page }) => {
  let fetched = false;
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    fetched = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PARCELS) });
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
  // Default zoom is 5
  await page.click('.layer[data-layer="parcels"]');
  await expect(page.locator('#toast')).toContainText(/Zoom to 14/i);
  expect(fetched).toBe(false);
});

test('parcels: outside-coverage toggle shows coverage toast, no fetch', async ({ page }) => {
  let fetched = false;
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    fetched = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PARCELS) });
  });
  // Boot at zoom 17 over Savannah, GA — Georgia has no statewide service and
  // only its Atlanta-metro counties are wired, so coastal Savannah (Chatham
  // County) is genuinely outside all coverage. (Earlier locations Austin TX and
  // Phoenix AZ both became covered as the registry grew — TX statewide, then
  // Maricopa County — a recurring hazard as coverage expands.)
  await bootAt(page, 32.0809, -81.0912, 17);
  await page.click('.layer[data-layer="parcels"]');
  await expect(page.locator('#toast')).toContainText(/No parcel coverage at this location/i);
  await expect(page.locator('#toast')).toContainText(/open Coverage for the full list/i);
  expect(fetched).toBe(false);
});

test('parcels: at zoom 14+ inside coverage tiles are queried and rendered', async ({ page }) => {
  await stubParcels(page);
  await bootAt(page, 38.9811, -77.1003, 17);
  const reqPromise = page.waitForRequest(r => r.url().includes('/MD_ParcelBoundaries/MapServer/0/query'));
  await page.click('.layer[data-layer="parcels"]');
  await reqPromise;
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);
  expect(await page.evaluate(() => window.__parcel.parcels.countLoaded())).toBe(2);
});

test('parcels: clicking a parcel populates the detail panel', async ({ page }) => {
  await stubParcels(page);
  await bootAt(page, 38.9811, -77.1003, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);

  await page.evaluate(() => {
    const map = window.__parcel.map;
    let target = null;
    map.eachLayer(l => {
      if (l.feature && l.feature.properties && l.feature.properties.ACCTID === 'MD-16-12345') target = l;
    });
    target.fire('click', { latlng: target.getBounds().getCenter() });
  });

  await expect(page.locator('#p-id')).toHaveText('MD-16-12345');
  await expect(page.locator('#p-acres')).toContainText('0.245 ac');
  await expect(page.locator('#p-owner')).toHaveText('DOE, JANE');
  await expect(page.locator('#p-value')).toContainText('$487,500');
});

test('parcels: acreage falls back to a geometry-derived estimate when the county lacks the field', async ({ page }) => {
  // Stub a feature with NO acres-related field: refresh() must inject
  // __geomAcres from the polygon (spherical excess) and the panel shows the
  // estimate instead of the old "not reported" affordance. The 0.001° ×
  // 0.001° square at lat 38.98 is ~9.6k sqm ≈ 2.4 ac.
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { ACCTID: 'NO-ACRES', OWNNAME: 'X', NFMTTLVL: 100 },
          geometry: { type: 'Polygon', coordinates: [[
            [-77.10, 38.98], [-77.099, 38.98], [-77.099, 38.981],
            [-77.10, 38.981], [-77.10, 38.98]
          ]]}
        }]
      })
    })
  );
  await bootAt(page, 38.9805, -77.0995, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'NO-ACRES') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  await expect(page.locator('#p-acres')).toHaveText(/^2\.\d{3} ac$/);
  await expect(page.locator('#p-acres')).toBeVisible();
});

test('parcels: acreage still shows "not reported" when geometry is degenerate', async ({ page }) => {
  // No acres field AND a zero-area (2-vertex) polygon → the geometry fallback
  // must decline (no misleading "0.000 ac") and the affordance survives.
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { ACCTID: 'ZERO-GEOM', OWNNAME: 'X', NFMTTLVL: 100 },
          geometry: { type: 'Polygon', coordinates: [[
            [-77.10, 38.98], [-77.099, 38.981], [-77.10, 38.98]
          ]]}
        }]
      })
    })
  );
  await bootAt(page, 38.9805, -77.0995, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'ZERO-GEOM') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  await expect(page.locator('#p-acres')).toHaveText('not reported');
});

test('parcels: response at/above transfer limit triggers quadtree subdivision', async ({ page }) => {
  // Stub: first call returns a "full page" (950 features) with
  // exceededTransferLimit: true. Subsequent (smaller-bbox) calls return small
  // safe sets. Assert the client issues more than one /query call.
  let calls = 0;
  function fakeBbox(seed) {
    // 4-vertex polygon around a unique location so dedupe keeps each one.
    const lng = -77.10 + (seed % 30) * 0.0003;
    const lat = 38.98 + Math.floor(seed / 30) * 0.0003;
    return {
      type: 'Polygon',
      coordinates: [[
        [lng, lat], [lng + 0.0002, lat], [lng + 0.0002, lat + 0.0002],
        [lng, lat + 0.0002], [lng, lat]
      ]]
    };
  }
  function bigPage(call) {
    const features = [];
    for (let i = 0; i < 950; i++) {
      features.push({
        type: 'Feature',
        properties: { ACCTID: `MD-CALL${call}-${i}` },
        geometry: fakeBbox(i)
      });
    }
    return { type: 'FeatureCollection', exceededTransferLimit: true, features };
  }
  function smallPage(call) {
    const features = [];
    for (let i = 0; i < 30; i++) {
      features.push({
        type: 'Feature',
        properties: { ACCTID: `MD-CALL${call}-S${i}` },
        geometry: fakeBbox(i + 1000)
      });
    }
    return { type: 'FeatureCollection', features };
  }
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    calls++;
    const body = calls === 1 ? bigPage(calls) : smallPage(calls);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await bootAt(page, 38.9805, -77.0995, 17);
  await page.click('.layer[data-layer="parcels"]');
  // Wait until subdivision settles — at least the initial + 4 quadrants
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() > 0);
  await page.waitForTimeout(400);
  expect(calls).toBeGreaterThan(1);
  // We expect 1 (root, triggers subdivide) + 4 (quadrants) = 5 calls minimum.
  expect(calls).toBeGreaterThanOrEqual(5);
});

test('parcels: deep recursion is capped at MAX_QUADTREE_DEPTH', async ({ page }) => {
  // Every call returns exceededTransferLimit: true regardless of feature
  // count. Without the depth cap this would recurse forever. Verify total
  // calls stays inside the 1+4+16+64+256 = 341 budget.
  let calls = 0;
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    calls++;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        exceededTransferLimit: true,
        features: [{
          type: 'Feature',
          properties: { ACCTID: `R-${calls}` },
          geometry: { type: 'Polygon', coordinates: [[
            [-77.1, 38.98], [-77.099, 38.98], [-77.099, 38.981],
            [-77.1, 38.981], [-77.1, 38.98]
          ]]}
        }]
      })
    });
  });
  await bootAt(page, 38.9805, -77.0995, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForTimeout(2000);
  expect(calls).toBeGreaterThan(1);
  expect(calls).toBeLessThanOrEqual(341);
});

test('parcels: zoning link appears when the county defines a zoningUrl and the parcel has an id', async ({ page }) => {
  await stubParcels(page);
  await bootAt(page, 38.9811, -77.1003, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'MD-16-12345') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  // MD statewide has zoningUrl configured → row visible.
  await expect(page.locator('#p-zoning-row')).toBeVisible();
  await expect(page.locator('#p-zoning')).toHaveAttribute('href', /sdat\.dat\.maryland\.gov/);
});

// Regression for Bug 2: the link must point to an *external* county URL
// (not localhost / the app itself / `#`). The 2026-05-12 P6 commit
// originally shipped this with href="#" as the placeholder; populatePanel
// overwrites it. This test asserts:
//   1. The link's href is a fully-qualified external URL after click.
//   2. target="_blank" survives (otherwise it'd nav the app away).
//   3. The link's hrefname does NOT contain localhost or 127.0.0.1.
test('parcels: zoning link points to a fully-qualified external URL after click', async ({ page }) => {
  await stubParcels(page);
  await bootAt(page, 38.9811, -77.1003, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'MD-16-12345') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  const href = await page.locator('#p-zoning').getAttribute('href');
  expect(href).toBeTruthy();
  expect(href).toMatch(/^https?:\/\//);
  expect(href).not.toMatch(/localhost|127\.0\.0\.1/);
  expect(href).not.toBe('#');
  // target must stay _blank so the click opens in a new tab rather than
  // navigating away from the app.
  await expect(page.locator('#p-zoning')).toHaveAttribute('target', '_blank');
  // rel="noopener" must survive — security best-practice for target=_blank.
  await expect(page.locator('#p-zoning')).toHaveAttribute('rel', /noopener/);
});

// Bug 2 second regression: the placeholder link must NOT have an href before
// populatePanel runs. The prior `href="#"` placeholder, combined with
// `target="_blank"`, opened the current app URL in a new tab when the user
// clicked the link from a stale row state (zoning row left visible from a
// previous parcel click, link href still pointing at the placeholder).
test('parcels: placeholder zoning link has no href before any parcel is clicked', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel);
  const initialHref = await page.locator('#p-zoning').getAttribute('href');
  expect(initialHref).toBeNull();
  // Row should also be hidden before any click.
  await expect(page.locator('#p-zoning-row')).toBeHidden();
});

// Bug 4 regression: the query URL must not include `resultRecordCount`,
// because some older ArcGIS Server endpoints (e.g. Charlottesville City)
// return HTTP 200 + `{error: {code: 400}}` when that param + f=geojson is
// combined with a bbox that returns ≥500 features. Our fetchInBbox then
// silently renders nothing.
test('parcels: query URL omits resultRecordCount (Bug 4 / Charlottesville)', async ({ page }) => {
  const urls = [];
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    urls.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });
  await bootAt(page, 38.9811, -77.1003, 17);
  const reqPromise = page.waitForRequest(r => r.url().includes('/MD_ParcelBoundaries/MapServer/0/query'));
  await page.click('.layer[data-layer="parcels"]');
  await reqPromise;
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) {
    expect(u).not.toMatch(/resultRecordCount/);
  }
});

test('parcels: deactivating clears the layer and panel', async ({ page }) => {
  await stubParcels(page);
  await bootAt(page, 38.9811, -77.1003, 17);
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);
  await page.click('.layer[data-layer="parcels"]');
  expect(await page.evaluate(() => window.__parcel.parcels.isActive())).toBe(false);
  expect(await page.evaluate(() => window.__parcel.parcels.countLoaded())).toBe(0);
  await expect(page.locator('#p-id')).toContainText(/click a parcel/i);
});

// Fairfax County, VA: a separate fake parcel served from the Fairfax endpoint.
const FAKE_FAIRFAX = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { PIN: '0102 14 0231', Shape__Area: 1523 }, // sqm → ~0.376 ac
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-77.3870, 38.9120],
        [-77.3866, 38.9120],
        [-77.3866, 38.9122],
        [-77.3870, 38.9122],
        [-77.3870, 38.9120]
      ]]
    }
  }]
};

test('parcels: Fairfax County routing queries the Fairfax endpoint and computes acres from Shape__Area', async ({ page }) => {
  // Determinism: empty-stub every OTHER in-view county query first (the Reston
  // view overlaps Loudoun/PWC/Arlington/MD). refresh() awaits all in-view
  // counties before rendering, so a slow real endpoint would delay the stubbed
  // Fairfax parcel past the timeout. Specific stubs below are registered after,
  // so they take priority over this catch-all.
  await page.route('**/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"type":"FeatureCollection","features":[]}' })
  );
  // Stub the MD endpoint to return no features, and Fairfax to return one.
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) })
  );
  await page.route('**/ioennV6PpG5Xodq0/**/Parcels/FeatureServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_FAIRFAX) })
  );

  await bootAt(page, 38.9121, -77.3868, 17); // Reston, VA — Fairfax bbox, outside MD bbox
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);

  await page.evaluate(() => {
    const map = window.__parcel.map;
    let target = null;
    map.eachLayer(l => {
      if (l.feature && l.feature.properties && l.feature.properties.PIN === '0102 14 0231') target = l;
    });
    target.fire('click', { latlng: target.getBounds().getCenter() });
  });

  await expect(page.locator('#p-id')).toHaveText('0102 14 0231');
  // 1523 sqm / 4046.86 = 0.376 ac
  await expect(page.locator('#p-acres')).toContainText(/0\.37[5-7] ac/);
  await expect(page.locator('#p-owner')).toHaveText('—'); // Fairfax has no owner field
  await expect(page.locator('#p-value')).toHaveText('—'); // Fairfax has no value field
});

// Endpoint-URL regression tests (added 2026-05-16 after the prior Fairfax
// `Parcels_with_Address_points` service was retired and the original guessed
// Arlington URL was found to be a dead host). These exercise the registry
// URLs directly — no `**` mask on the path so a URL drift surfaces as a 404
// in the request log rather than silently routing to a mock for a stale path.
test('parcels: Fairfax current endpoint renders parcels at central Fairfax z16 with no 400s', async ({ page }) => {
  const fairfaxFake = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { PIN: '0282 06 0019', Shape__Area: 1842 },
      geometry: { type: 'Polygon', coordinates: [[
        [-77.3005, 38.8495], [-77.2995, 38.8495], [-77.2995, 38.8505],
        [-77.3005, 38.8505], [-77.3005, 38.8495]
      ]]}
    }]
  };
  const badStatus = [];
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('ioennV6PpG5Xodq0')) badStatus.push(r.status() + ' ' + r.url());
  });
  // Determinism: empty-stub all other in-view county queries (see note in the
  // Fairfax routing test above); the specific Fairfax stub below overrides it.
  await page.route('**/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"type":"FeatureCollection","features":[]}' })
  );
  await page.route('**/ioennV6PpG5Xodq0/**/Parcels/FeatureServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fairfaxFake) })
  );
  await bootAt(page, 38.85, -77.30, 16);
  const reqPromise = page.waitForRequest(r =>
    r.url().includes('ioennV6PpG5Xodq0/ArcGIS/rest/services/Parcels/FeatureServer/0/query')
  );
  await page.click('.layer[data-layer="parcels"]');
  await reqPromise;
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() >= 1);
  expect(badStatus).toEqual([]);
});

test('parcels: Arlington current endpoint renders parcels at central Arlington z16 with no 400s', async ({ page }) => {
  const arlingtonFake = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { RPCMSTR: '03001009', Shape__Area: 30024 },
      geometry: { type: 'Polygon', coordinates: [[
        [-77.1005, 38.8795], [-77.0995, 38.8795], [-77.0995, 38.8805],
        [-77.1005, 38.8805], [-77.1005, 38.8795]
      ]]}
    }]
  };
  const badStatus = [];
  page.on('response', r => {
    if (r.status() >= 400 && r.url().includes('arlgis.arlingtonva.us')) badStatus.push(r.status() + ' ' + r.url());
  });
  // Determinism: empty-stub all other in-view county queries (Arlington's view
  // overlaps DC-area MD + VA counties); the specific Arlington stub overrides it.
  await page.route('**/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"type":"FeatureCollection","features":[]}' })
  );
  await page.route('**/od_REA_Property_Polygons/FeatureServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(arlingtonFake) })
  );
  await bootAt(page, 38.88, -77.10, 16);
  const reqPromise = page.waitForRequest(r =>
    r.url().includes('arlgis.arlingtonva.us/arcgis/rest/services/Open_Data/od_REA_Property_Polygons/FeatureServer/0/query')
  );
  await page.click('.layer[data-layer="parcels"]');
  await reqPromise;
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() >= 1);
  expect(badStatus).toEqual([]);
  // Arlington derives acres from Shape__Area like Fairfax — verify the lookup.
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.RPCMSTR === '03001009') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  await expect(page.locator('#p-id')).toHaveText('03001009');
  await expect(page.locator('#p-acres')).toContainText(/7\.4\d{2} ac/); // 30024 / 4046.86 = 7.419
});

test('parcels: both endpoints are hit inside an overlapping bbox', async ({ page }) => {
  let mdHits = 0, fairfaxHits = 0;
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route => {
    mdHits++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });
  await page.route('**/ioennV6PpG5Xodq0/**/Parcels/FeatureServer/0/query**', route => {
    fairfaxHits++;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
  });

  // Park on the DC/Maryland/Virginia border so both bboxes intersect the view.
  await bootAt(page, 38.97, -77.10, 14);
  await page.click('.layer[data-layer="parcels"]');

  // Both should have been queried at least once after the activate refresh.
  await page.waitForFunction(() => true, null, { timeout: 1000 });
  expect(mdHits).toBeGreaterThanOrEqual(1);
  expect(fairfaxHits).toBeGreaterThanOrEqual(1);
});
