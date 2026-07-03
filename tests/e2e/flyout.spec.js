import { test, expect } from '@playwright/test';

async function bootStubbed(page) {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 489.3 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ features: [{ attributes: { FLD_ZONE: 'X', ZONE_SUBTY: null } }] })
    })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.flyout);
}

test('flyout: starts closed', async ({ page }) => {
  await bootStubbed(page);
  await expect(page.locator('#flyout')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => window.__parcel.flyout.isOpen())).toBe(false);
});

test('flyout: opens after inspectPoint and shows elevation + flood', async ({ page }) => {
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(30.27, -97.74));
  await expect(page.locator('#flyout')).toHaveClass(/open/);
  await expect(page.locator('#flyout-title')).toContainText('30.27000');
  await expect(page.locator('#r-elev')).toHaveText('489.3 ft');
  await expect(page.locator('#r-flood')).toHaveText('X');
});

test('flyout: close button dismisses', async ({ page }) => {
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.flyout.open());
  await expect(page.locator('#flyout')).toHaveClass(/open/);
  await page.click('#flyout-close');
  await expect(page.locator('#flyout')).not.toHaveClass(/open/);
});

test('flyout: ESC key dismisses', async ({ page }) => {
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.flyout.open());
  await expect(page.locator('#flyout')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#flyout')).not.toHaveClass(/open/);
});

test('flyout: flood zone description appears in plain English', async ({ page }) => {
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(30.27, -97.74));
  await expect(page.locator('#r-flood-desc')).toContainText(/Minimal flood hazard/i);
});

test('flyout: parcel click sets the title to "Parcel <id>" and opens', async ({ page }) => {
  // Stub the MD endpoint with one feature
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { ACCTID: 'MD-99-CLICK', ACRES: 1.0, OWNNAME: 'X', NFMTTLVL: 100 },
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
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels && window.__parcel.flyout);
  await page.evaluate(() => window.__parcel.map.setView([38.9805, -77.0995], 17));
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);
  await page.evaluate(() => {
    const map = window.__parcel.map;
    let target = null;
    map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'MD-99-CLICK') target = l;
    });
    target.fire('click', { latlng: target.getBounds().getCenter() });
  });
  await expect(page.locator('#flyout')).toHaveClass(/open/);
  await expect(page.locator('#flyout-title')).toHaveText(/Parcel MD-99-CLICK/);
});

test('flyout header priority: saved-place label outranks parcel and address', async ({ page }) => {
  // Seed a saved place at exact coords. Boot, click those coords — title
  // should show the user's custom label, not coords or address.
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ display_name: 'Some Address', type: 'house', address: { house_number: '1' } })
    })
  );
  await page.addInitScript(() => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.setItem('parcel.savedPlaces', JSON.stringify([{
      id: 's1', label: 'Aunt Mary lot', notes: null,
      lat: 38.97, lng: -76.50, parcelId: null, parcelMeta: null,
      nearestAddress: null, createdAt: new Date().toISOString()
    }]));
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.inspectPoint);
  await page.evaluate(() => window.__parcel.inspectPoint(38.97, -76.50));
  await expect(page.locator('#flyout-title')).toHaveText('Aunt Mary lot');
  // Coordinates appear as small subtitle
  await expect(page.locator('#flyout-nearest')).toContainText('38.97000');
});

test('flyout header priority: parcel ID — owner format when both present', async ({ page }) => {
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { ACCTID: 'TEST-42', OWNNAME: 'JOHN Q. PUBLIC', ACRES: 1.5 },
          geometry: { type: 'Polygon', coordinates: [[
            [-77.10, 38.98], [-77.099, 38.98], [-77.099, 38.981],
            [-77.10, 38.981], [-77.10, 38.98]
          ]]}
        }]
      })
    })
  );
  await page.addInitScript(() => { localStorage.setItem('parcel.migrationDone', '1'); });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
  await page.evaluate(() => window.__parcel.map.setView([38.9805, -77.0995], 17));
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 1);
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.ACCTID === 'TEST-42') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  await expect(page.locator('#flyout-title')).toContainText('Parcel TEST-42');
  await expect(page.locator('#flyout-title')).toContainText('JOHN Q. PUBLIC');
});

test('flyout: aria-hidden flips with state', async ({ page }) => {
  await bootStubbed(page);
  await expect(page.locator('#flyout')).toHaveAttribute('aria-hidden', 'true');
  await page.evaluate(() => window.__parcel.flyout.open());
  await expect(page.locator('#flyout')).toHaveAttribute('aria-hidden', 'false');
  await page.evaluate(() => window.__parcel.flyout.close());
  await expect(page.locator('#flyout')).toHaveAttribute('aria-hidden', 'true');
});
