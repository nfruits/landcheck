import { test, expect } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
  'base64'
);

test.beforeEach(async ({ page }) => {
  await page.route('**/MapServer/export*', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
  );
  await page.route('**/casoilresource.lawr.ucdavis.edu/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
  );
});

test('toggling FEMA flood layer activates it and requests tiles', async ({ page }) => {
  await page.goto('/app.html');
  const tilePromise = page.waitForRequest(req => req.url().includes('NFHL/MapServer/export'));
  await page.click('.layer[data-layer="flood"]');
  await expect(page.locator('.layer[data-layer="flood"]')).toHaveClass(/active/);
  await tilePromise;
});

test('toggling layer off removes the active class', async ({ page }) => {
  await page.goto('/app.html');
  await page.click('.layer[data-layer="flood"]');
  await expect(page.locator('.layer[data-layer="flood"]')).toHaveClass(/active/);
  await page.click('.layer[data-layer="flood"]');
  await expect(page.locator('.layer[data-layer="flood"]')).not.toHaveClass(/active/);
});

test('parcels toggle at low zoom activates layer and shows zoom-hint toast', async ({ page }) => {
  await page.goto('/app.html');
  await page.click('.layer[data-layer="parcels"]');
  await expect(page.locator('.layer[data-layer="parcels"]')).toHaveClass(/active/);
  await expect(page.locator('#toast')).toContainText(/Zoom to 14/i);
});

test('toggling soil layer requests SoilWeb tiles', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  // Move to Iowa farmland at z=14 so soil's minZoom=9 is satisfied and tiles are requested
  await page.evaluate(() => window.__parcel.map.setView([41.95, -93.65], 14));

  const tilePromise = page.waitForRequest(req =>
    req.url().includes('casoilresource.lawr.ucdavis.edu') && req.url().includes('layers=ssurgo')
  );
  await page.click('.layer[data-layer="soil"]');
  await expect(page.locator('.layer[data-layer="soil"]')).toHaveClass(/active/);
  await tilePromise;
});

test('wetlands toggle at low zoom shows zoom-hint toast', async ({ page }) => {
  await page.goto('/app.html');
  await page.click('.layer[data-layer="wetlands"]');
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toContainText(/zoom 11/i);
});
