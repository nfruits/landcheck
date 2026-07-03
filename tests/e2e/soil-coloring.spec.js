import { test, expect } from '@playwright/test';

test('soil scoring: positive/negative/mixed signals map to green/red/yellow', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.soilColoring);
  const colors = await page.evaluate(() => ({
    allPositive: window.__parcel.soilColoring.tintFor(2.5),
    allNegative: window.__parcel.soilColoring.tintFor(-2),
    neutral: window.__parcel.soilColoring.tintFor(0)
  }));
  // Green
  expect(colors.allPositive).toBe('#3a8a3a');
  // Red
  expect(colors.allNegative).toBe('#b04525');
  // Yellow
  expect(colors.neutral).toBe('#c89a2a');
});

test('soil scoring: drainage/hydric/farmland classifications combine correctly', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.soilColoring);
  const cases = await page.evaluate(() => {
    const s = window.__parcel.soilColoring;
    return {
      ideal: s.scoreParts('Well drained', 'No', 'All areas are prime farmland'),
      worst: s.scoreParts('Poorly drained', 'Yes', 'Not prime farmland'),
      mixed: s.scoreParts('Moderately well drained', 'Partially', 'Farmland of statewide importance')
    };
  });
  // ideal: drainage +1 + hydric 0 + farmland +1 = +2
  expect(cases.ideal.drainage + cases.ideal.hydric + cases.ideal.farmland).toBeGreaterThan(1.5);
  // worst: -1 + -1 + 0 = -2
  expect(cases.worst.drainage + cases.worst.hydric + cases.worst.farmland).toBeLessThan(-1.5);
  // mixed: 0 + -0.5 + 0.5 = 0
  expect(cases.mixed.drainage + cases.mixed.hydric + cases.mixed.farmland).toBeCloseTo(0, 1);
});

test('soil legend appears when the Soil overlay is toggled on', async ({ page }) => {
  // Stub the SDA POST so activation doesn't hang on network
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Table: [] }) })
  );
  // Stub SoilWeb tile to avoid tile-failure auto-disable
  await page.route('**/casoilresource.lawr.ucdavis.edu/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.soilColoring);
  await expect(page.locator('#soil-legend')).toBeHidden();
  await page.click('.layer[data-layer="soil"]');
  await expect(page.locator('#soil-legend')).toBeVisible();
  await expect(page.locator('#soil-legend')).toContainText(/Soil quality/i);
  await expect(page.locator('#soil-legend')).toContainText(/Red ≠ bad/i);
  // Toggle off → legend hides
  await page.click('.layer[data-layer="soil"]');
  await expect(page.locator('#soil-legend')).toBeHidden();
});

test('soil coloring: SDA polygons render as Canvas overlay (stubbed response)', async ({ page }) => {
  // Stub an SDA response with one polygon
  const stubResponse = {
    Table: [
      ['mukey', 'muname', 'farmlndcl', 'drainagecl', 'hydricrating', 'wkt'],
      ['12345', 'Test Unit', 'All areas are prime farmland', 'Well drained', 'No',
       'POLYGON ((-77.10 38.98, -77.09 38.98, -77.09 38.99, -77.10 38.99, -77.10 38.98))']
    ]
  };
  await page.route('**/sdmdataaccess.sc.egov.usda.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubResponse) })
  );
  await page.route('**/casoilresource.lawr.ucdavis.edu/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.soilColoring);
  await page.evaluate(() => window.__parcel.map.setView([38.985, -77.095], 14));
  await page.click('.layer[data-layer="soil"]');
  await page.waitForFunction(() => window.__parcel.soilColoring.layerCount() > 0, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__parcel.soilColoring.layerCount())).toBeGreaterThan(0);
});
