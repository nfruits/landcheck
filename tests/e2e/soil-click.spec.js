import { test, expect } from '@playwright/test';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
  'base64'
);

const SDA_IOWA_FIXTURE = {
  Table: [
    ['muname', 'farmlndcl', 'drainagecl', 'hydricrating', 'slope_l', 'slope_h', 'pmgroupname'],
    [
      'Clarion loam, Bemis moraine, 2 to 6 percent slopes',
      'All areas are prime farmland',
      'Well drained',
      'No',
      '2',
      '6',
      'loamy till'
    ]
  ]
};

async function bootIowaTestPage(page) {
  await page.route('**/casoilresource.lawr.ucdavis.edu/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
  );
  // Real lookup mocks so click handler doesn't time out on those branches
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 1140 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.evaluate(() => window.__parcel.map.setView([41.95, -93.65], 14));
}

test('clicking the map with soil active populates the detail panel', async ({ page }) => {
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SDA_IOWA_FIXTURE) })
  );

  await bootIowaTestPage(page);
  await page.click('.layer[data-layer="soil"]');
  await expect(page.locator('.layer[data-layer="soil"]')).toHaveClass(/active/);

  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('#s-name')).toHaveText('Clarion loam, Bemis moraine, 2 to 6 percent slopes');
  await expect(page.locator('#s-name')).not.toHaveClass(/empty/);
  await expect(page.locator('#s-drain')).toHaveText('Well drained');
  await expect(page.locator('#s-hydric')).toHaveText('No');
  await expect(page.locator('#s-farm')).toHaveText('All areas are prime farmland');
  await expect(page.locator('#s-slope')).toHaveText('2%–6%');
  await expect(page.locator('#s-parent')).toHaveText('loamy till');
});

test('out-of-coverage point shows "No soil data at this location"', async ({ page }) => {
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  await bootIowaTestPage(page);
  await page.click('.layer[data-layer="soil"]');

  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator('#s-name')).toHaveText('No soil data at this location');
  await expect(page.locator('#s-drain')).toHaveText('—');
});

test('click without soil active leaves SDA untouched and shows hint message', async ({ page }) => {
  let sdaCalled = false;
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route => {
    sdaCalled = true;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SDA_IOWA_FIXTURE) });
  });

  await bootIowaTestPage(page);
  // Soil layer NOT toggled on
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // Wait for the elevation lookup to complete so we know inspectPoint ran
  await expect(page.locator('#r-elev')).toHaveText('1140.0 ft');
  expect(sdaCalled).toBe(false);
  await expect(page.locator('#s-name')).toContainText('click map with Soil active');
});

test('toggling soil off clears the detail panel', async ({ page }) => {
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SDA_IOWA_FIXTURE) })
  );

  await bootIowaTestPage(page);
  await page.click('.layer[data-layer="soil"]');
  const box = await page.locator('#map').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#s-name')).toHaveText(/Clarion/);

  await page.click('.layer[data-layer="soil"]');
  await expect(page.locator('#s-name')).toContainText('click map with Soil active');
  await expect(page.locator('#s-drain')).toHaveText('—');
});
