import { test, expect } from '@playwright/test';

const FAKE_PAD = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      Unit_Nm: 'Shenandoah National Park',
      Mang_Name: 'National Park Service',
      Mang_Type: 'FED',
      Des_Tp: 'National Park',
      Own_Name: 'US Federal Government'
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-78.45, 38.40], [-78.20, 38.40], [-78.20, 38.55],
        [-78.45, 38.55], [-78.45, 38.40]
      ]]
    }
  }]
};

async function stub(page) {
  await page.route('**/v01gqwM5QqNysAAi/**/Manager_Type_PADUS/FeatureServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PAD) })
  );
}

test('PAD-US: low-zoom toggle shows zoom hint, no fetch', async ({ page }) => {
  let fetched = false;
  await page.route('**/v01gqwM5QqNysAAi/**/Manager_Type_PADUS/FeatureServer/0/query**', route => {
    fetched = true;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_PAD) });
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.protectedLands);
  await page.click('.layer[data-layer="protected-lands"]');
  await expect(page.locator('#toast')).toContainText(/Zoom to 10/i);
  expect(fetched).toBe(false);
});

test('PAD-US: toggle at z11 renders polygons + click popup shows manager/designation', async ({ page }) => {
  await stub(page);
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.protectedLands);
  await page.evaluate(() => window.__parcel.map.setView([38.475, -78.325], 11));
  await page.click('.layer[data-layer="protected-lands"]');
  await page.waitForFunction(() => window.__parcel.protectedLands.countLoaded() >= 1);
  expect(await page.evaluate(() => window.__parcel.protectedLands.countLoaded())).toBe(1);

  // Click the polygon → popup contains the National Park label + manager.
  await page.evaluate(() => {
    let t = null;
    window.__parcel.map.eachLayer(l => {
      if (l.feature?.properties?.Unit_Nm === 'Shenandoah National Park') t = l;
    });
    t.fire('click', { latlng: t.getBounds().getCenter() });
  });
  await expect(page.locator('.leaflet-popup-content')).toContainText('Shenandoah National Park');
  await expect(page.locator('.leaflet-popup-content')).toContainText('National Park');
  await expect(page.locator('.leaflet-popup-content')).toContainText('National Park Service');
});

test('PAD-US: toggling off clears the layer', async ({ page }) => {
  await stub(page);
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.protectedLands);
  await page.evaluate(() => window.__parcel.map.setView([38.475, -78.325], 11));
  await page.click('.layer[data-layer="protected-lands"]');
  await page.waitForFunction(() => window.__parcel.protectedLands.countLoaded() >= 1);
  await page.click('.layer[data-layer="protected-lands"]');
  expect(await page.evaluate(() => window.__parcel.protectedLands.isActive())).toBe(false);
  expect(await page.evaluate(() => window.__parcel.protectedLands.countLoaded())).toBe(0);
});
