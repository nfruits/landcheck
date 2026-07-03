import { test, expect } from '@playwright/test';

async function bootTestPage(page) {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.evaluate(() => window.__parcel.map.setView([30.27, -97.74], 18));
}

test('draw-polygon button activates the Leaflet.draw drawer', async ({ page }) => {
  await page.goto('/app.html');
  await page.click('#draw-polygon');
  await expect(page.locator('.leaflet-draw-tooltip')).toBeVisible();
});

test('synthetic polygon CREATED event populates area + perimeter readouts', async ({ page }) => {
  await bootTestPage(page);

  await page.evaluate(() => {
    const m = window.__parcel.map;
    // ~67m x 65m square ≈ 1.07 acres at this latitude
    const corners = [
      L.latLng(30.27000, -97.74000),
      L.latLng(30.27000, -97.73930),
      L.latLng(30.27060, -97.73930),
      L.latLng(30.27060, -97.74000)
    ];
    const layer = L.polygon(corners);
    m.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon' });
  });

  await expect(page.locator('#r-area')).not.toHaveText('— ac');
  await expect(page.locator('#r-perim')).not.toHaveText('— ft');

  const areaText = await page.locator('#r-area').textContent();
  const acres = parseFloat(areaText);
  expect(acres).toBeGreaterThan(0.5);
  expect(acres).toBeLessThan(2);
});

test('synthetic polyline CREATED event populates distance readout', async ({ page }) => {
  await bootTestPage(page);

  await page.evaluate(() => {
    const m = window.__parcel.map;
    const layer = L.polyline([L.latLng(30.27000, -97.74000), L.latLng(30.27090, -97.74000)]);
    m.fire(L.Draw.Event.CREATED, { layer, layerType: 'polyline' });
  });

  await expect(page.locator('#r-dist')).not.toHaveText('— ft');
  const distText = await page.locator('#r-dist').textContent();
  expect(parseFloat(distText)).toBeGreaterThan(0);
});

test('polygon: slope analysis samples vertices and shows terrain change', async ({ page }) => {
  // Stub EPQS to return ascending elevations: 1340, 1346, 1352, 1358 → range 18 ft
  let call = 0;
  await page.route('**/epqs.nationalmap.gov/v1/json**', route => {
    const v = 1340 + (call++) * 6;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: v }) });
  });
  await bootTestPage(page);
  await page.evaluate(() => {
    const m = window.__parcel.map;
    const layer = L.polygon([
      L.latLng(30.27000, -97.74000),
      L.latLng(30.27000, -97.73930),
      L.latLng(30.27060, -97.73930),
      L.latLng(30.27060, -97.74000)
    ]);
    m.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon' });
  });
  // Allow time for the parallel EPQS fetches
  await expect(page.locator('#r-terrain-change')).toContainText(/\d+ ft/, { timeout: 5000 });
  const text = await page.locator('#r-terrain-change').textContent();
  expect(text).toMatch(/^\d+ ft \(\d+–\d+ ft\)/);
});

test('polygon: slope analysis tolerates partial EPQS failure with a count note', async ({ page }) => {
  let call = 0;
  await page.route('**/epqs.nationalmap.gov/v1/json**', route => {
    // Fail every other call
    if (call++ % 2 === 0) return route.fulfill({ status: 500, body: 'oops' });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 1300 + call * 4 }) });
  });
  await bootTestPage(page);
  await page.evaluate(() => {
    const m = window.__parcel.map;
    const layer = L.polygon([
      L.latLng(30.27000, -97.74000),
      L.latLng(30.27000, -97.73930),
      L.latLng(30.27060, -97.73930),
      L.latLng(30.27060, -97.74000)
    ]);
    m.fire(L.Draw.Event.CREATED, { layer, layerType: 'polygon' });
  });
  await expect(page.locator('#r-terrain-change')).toContainText(/based on \d+ of \d+ samples/, { timeout: 5000 });
});

test('clear button resets all draw readouts', async ({ page }) => {
  await bootTestPage(page);

  await page.evaluate(() => {
    const m = window.__parcel.map;
    const polygon = L.polygon([
      L.latLng(30.27000, -97.74000),
      L.latLng(30.27000, -97.73900),
      L.latLng(30.27090, -97.73900)
    ]);
    m.fire(L.Draw.Event.CREATED, { layer: polygon, layerType: 'polygon' });
    const line = L.polyline([L.latLng(30.27, -97.74), L.latLng(30.271, -97.74)]);
    m.fire(L.Draw.Event.CREATED, { layer: line, layerType: 'polyline' });
  });

  await expect(page.locator('#r-area')).not.toHaveText('— ac');
  await expect(page.locator('#r-dist')).not.toHaveText('— ft');

  await page.click('#clear-draw');

  await expect(page.locator('#r-area')).toHaveText('— ac');
  await expect(page.locator('#r-perim')).toHaveText('— ft');
  await expect(page.locator('#r-dist')).toHaveText('— ft');
  await expect(page.locator('#r-terrain-change')).toHaveText('—');
});
