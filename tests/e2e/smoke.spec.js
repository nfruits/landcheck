import { test, expect } from '@playwright/test';

test('page loads with map and default UI state', async ({ page }) => {
  await page.goto('/app.html');

  await expect(page).toHaveTitle(/LandCheck/);
  await expect(page.locator('#map.leaflet-container')).toBeVisible();

  await expect(page.locator('.basemap-btn.active')).toHaveAttribute('data-basemap', 'satellite');
  // 4 basemaps: satellite, topo, street, terrain (Google removed 2026-07-01).
  await expect(page.locator('.basemap-btn')).toHaveCount(4);
  // 6 data layers (parcels, flood, wetlands, contours, soil, protected-lands)
  // + 4 independent admin toggles (states/counties/places/streets).
  await expect(page.locator('.layer')).toHaveCount(10);
  await expect(page.locator('.admin-toggle')).toHaveCount(4);

  // No-last-view default: MD/NoVA fallback at (38.85, -77.10) zoom 9.
  // (Bug 3 / 2026-05-17 removed the prior ipapi.co geolocation tier and the
  // MAP_INIT fallback; the no-view default is now this region.)
  await expect(page.locator('#lat-display')).toHaveText('38.85000°');
  await expect(page.locator('#lon-display')).toHaveText('-77.10000°');
  await expect(page.locator('#zoom-display')).toHaveText('9');
  await expect(page.locator('#scale-display')).toContainText('1px');

  // Bottom coord bar is gone; mini-readout in the sidebar replaces it.
  await expect(page.locator('.coord-bar')).toHaveCount(0);
  await expect(page.locator('.now-viewing')).toBeVisible();

  await expect(page.locator('#r-elev')).toHaveText('— ft');
  await expect(page.locator('#r-area')).toHaveText('— ac');
  await expect(page.locator('#r-flood')).toHaveText('— ');
});

test('zoom indicator stays readable in the sidebar at varied viewport sizes', async ({ page }) => {
  // The zoom indicator lives in the .now-viewing mini-readout, not on the map,
  // so the Leaflet attribution (which sits at the map's bottom-right) cannot
  // overlap it. Verify the element is visible across a few viewport sizes.
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/app.html');
    await expect(page.locator('#zoom-display')).toBeVisible();
    // And it's NOT inside the map container (where attribution might overlap).
    const insideMap = await page.locator('#map #zoom-display').count();
    expect(insideMap).toBe(0);
  }
});

test('mini-readout updates when the map is panned and zoomed', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.evaluate(() => window.__parcel.map.setView([38.97, -77.10], 11));
  await expect(page.locator('#lat-display')).toHaveText('38.97000°');
  await expect(page.locator('#lon-display')).toHaveText('-77.10000°');
  await expect(page.locator('#zoom-display')).toHaveText('11');
});

test('test hook is gated behind ?test=1', async ({ page }) => {
  await page.goto('/app.html');
  expect(await page.evaluate(() => typeof window.__parcel)).toBe('undefined');

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  expect(await page.evaluate(() => typeof window.__parcel.inspectPoint)).toBe('function');
});
