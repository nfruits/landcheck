import { test, expect } from '@playwright/test';

async function mockLookups(page, { elevation, floodZone, floodSubtype = null } = {}) {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ value: elevation })
    })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: floodZone === null
        ? JSON.stringify({ features: [] })
        : JSON.stringify({ features: [{ attributes: { FLD_ZONE: floodZone, ZONE_SUBTY: floodSubtype } }] })
    })
  );
}

test('clicking the map runs elevation + flood lookups', async ({ page }) => {
  await mockLookups(page, { elevation: 1234.5, floodZone: 'AE', floodSubtype: 'FLOODWAY' });

  await page.goto('/app.html');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('#r-elev')).toHaveText('1234.5 ft');
  await expect(page.locator('#r-flood')).toHaveText('AE · FLOODWAY');
  await expect(page.locator('#r-flood')).toHaveClass(/hazard/);
});

test('elevation -1000000 sentinel renders as "n/a"', async ({ page }) => {
  await mockLookups(page, { elevation: -1000000, floodZone: null });

  await page.goto('/app.html');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('#r-elev')).toHaveText('n/a');
  await expect(page.locator('#r-flood')).toHaveText('no data');
});

test('non-hazard zone X gets amber class, not hazard', async ({ page }) => {
  await mockLookups(page, { elevation: 850, floodZone: 'X' });

  await page.goto('/app.html');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('#r-flood')).toHaveText('X');
  await expect(page.locator('#r-flood')).toHaveClass(/amber/);
  await expect(page.locator('#r-flood')).not.toHaveClass(/hazard/);
});

test('clicking the map drops a pin marker on the map', async ({ page }) => {
  await mockLookups(page, { elevation: 100, floodZone: 'X' });

  await page.goto('/app.html');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
});
