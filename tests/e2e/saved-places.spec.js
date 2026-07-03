import { test, expect } from '@playwright/test';

test('saved-places: migration absorbs parcel.pinned and marks done', async ({ page }) => {
  // Seed the legacy key BEFORE the page boots so the migration runs.
  await page.addInitScript(() => {
    localStorage.setItem('parcel.pinned', JSON.stringify([
      { id: 'OLD-1', county: 'md-statewide', props: { ACCTID: 'OLD-1' } },
      { id: 'OLD-2', county: 'md-statewide', props: { ACCTID: 'OLD-2' } }
    ]));
    localStorage.removeItem('parcel.savedPlaces');
    localStorage.removeItem('parcel.migrationDone');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savedPlaces);

  const list = await page.evaluate(() => window.__parcel.savedPlaces.list());
  expect(list.length).toBe(2);
  expect(list[0].parcelId).toBe('OLD-1');
  expect(list[1].parcelId).toBe('OLD-2');

  // Legacy key is gone, migration flag set
  const after = await page.evaluate(() => ({
    legacy: localStorage.getItem('parcel.pinned'),
    flag: localStorage.getItem('parcel.migrationDone')
  }));
  expect(after.legacy).toBeNull();
  expect(after.flag).toBe('1');
});

test('saved-places: migration is idempotent (does not run twice)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('parcel.pinned', JSON.stringify([
      { id: 'OLD-A', county: 'md-statewide', props: {} }
    ]));
    localStorage.removeItem('parcel.savedPlaces');
    localStorage.removeItem('parcel.migrationDone');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savedPlaces);

  // Simulate user manually re-seeding the legacy key (e.g., browser extension).
  // Migration should NOT run again because the flag is set.
  await page.evaluate(() => {
    localStorage.setItem('parcel.pinned', JSON.stringify([{ id: 'STALE', county: 'x', props: {} }]));
  });
  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.savedPlaces);

  const list = await page.evaluate(() => window.__parcel.savedPlaces.list());
  expect(list.length).toBe(1); // still just the one from initial migration
  expect(list[0].parcelId).toBe('OLD-A');
});

test('save-place form: clicking Save this place reveals the inline form', async ({ page }) => {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ attributes: { FLD_ZONE: 'X' } }] }) })
  );
  await page.addInitScript(() => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.removeItem('parcel.savedPlaces');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savePlace);
  await page.evaluate(() => window.__parcel.inspectPoint(39.0, -77.05));
  await expect(page.locator('#save-place')).toHaveText(/Save this place/i);
  await page.click('#save-place');
  await expect(page.locator('#save-place-form')).toBeVisible();
  await page.fill('#sp-label', 'Aunt Mary lot');
  await page.fill('#sp-notes', 'Wooded, 4 acres');
  await page.click('#sp-save');
  await expect(page.locator('#save-place-form')).toBeHidden();
  const list = await page.evaluate(() => window.__parcel.savedPlaces.list());
  expect(list.length).toBe(1);
  expect(list[0].label).toBe('Aunt Mary lot');
  expect(list[0].notes).toBe('Wooded, 4 acres');
  expect(list[0].lat).toBeCloseTo(39.0, 4);
  expect(list[0].lng).toBeCloseTo(-77.05, 4);
});

test('save-place form: saved location shows Saved — Edit and opens prepopulated', async ({ page }) => {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.addInitScript(() => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.setItem('parcel.savedPlaces', JSON.stringify([{
      id: 'pre-1', label: 'Existing', notes: 'kept',
      lat: 39.0, lng: -77.05, parcelId: null, parcelMeta: null,
      nearestAddress: null, createdAt: new Date().toISOString()
    }]));
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savePlace);
  await page.evaluate(() => window.__parcel.inspectPoint(39.0, -77.05));
  await expect(page.locator('#save-place')).toHaveText(/Saved — Edit/);
  await page.click('#save-place');
  await expect(page.locator('#sp-label')).toHaveValue('Existing');
  await expect(page.locator('#sp-notes')).toHaveValue('kept');
});

test('end-to-end: parcel click → Save this place → entry appears in My Places', async ({ page }) => {
  // Stub everything we need: parcels endpoint, elevation, flood, reverse-geocode.
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { ACCTID: 'MD-E2E-1', ACRES: 2.5, OWNNAME: 'TEST', NFMTTLVL: 500000 },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-77.10, 38.98], [-77.099, 38.98], [-77.099, 38.981],
              [-77.10, 38.981], [-77.10, 38.98]
            ]]
          }
        }]
      })
    })
  );
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ display_name: 'Test St, Bethesda, MD' })
    })
  );
  await page.addInitScript(() => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.removeItem('parcel.savedPlaces');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savedPlaces && window.__parcel.myPlaces);

  await page.evaluate(() => window.__parcel.map.setView([38.9805, -77.0995], 17));
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);
  await page.evaluate(() => {
    const map = window.__parcel.map;
    let target = null;
    map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'MD-E2E-1') target = l;
    });
    target.fire('click', { latlng: target.getBounds().getCenter() });
  });

  // Save place flow inside the fly-out
  await page.click('#save-place');
  await page.fill('#sp-label', 'E2E place');
  await page.fill('#sp-notes', 'parcel + place test');
  await page.click('#sp-save');

  // My Places list now shows the entry
  await expect(page.locator('.mp-row')).toHaveCount(1);
  await expect(page.locator('.mp-row').first()).toContainText('E2E place');
  // Saved entry carries the parcel meta
  const entry = await page.evaluate(() => window.__parcel.savedPlaces.list()[0]);
  expect(entry.label).toBe('E2E place');
  expect(entry.parcelId).toBe('MD-E2E-1');
  expect(entry.parcelMeta.ACRES).toBe(2.5);
});

test('saved-places: add/update/remove API works end-to-end', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('parcel.pinned');
    localStorage.removeItem('parcel.savedPlaces');
    localStorage.setItem('parcel.migrationDone', '1');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.savedPlaces);

  const id = await page.evaluate(() => {
    const e = window.__parcel.savedPlaces.add({
      label: 'Aunt Mary lot',
      notes: 'Wooded, near creek',
      lat: 38.97,
      lng: -77.10
    });
    return e.id;
  });
  expect(typeof id).toBe('string');

  await page.evaluate((i) => window.__parcel.savedPlaces.update(i, { notes: 'Updated note' }), id);
  let entry = await page.evaluate((i) => window.__parcel.savedPlaces.get(i), id);
  expect(entry.notes).toBe('Updated note');
  expect(entry.label).toBe('Aunt Mary lot'); // untouched

  await page.evaluate((i) => window.__parcel.savedPlaces.remove(i), id);
  entry = await page.evaluate((i) => window.__parcel.savedPlaces.get(i), id);
  expect(entry).toBeNull();
});
