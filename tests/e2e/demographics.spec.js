import { test, expect } from '@playwright/test';

async function mockBaseLookups(page) {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) }));
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) }));
}

async function mockTract(page, { geoid = '51059481802', state = '51', county = '059', tract = '481802' } = {}) {
  await page.route('**/tigerweb.geo.census.gov/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        features: [{ attributes: { GEOID: geoid, STATE: state, COUNTY: county, TRACT: tract } }]
      })
    }));
}

async function mockAcs(page, opts = {}) {
  const defaults = {
    population: 4321,
    income: 92500,
    age: 38.4,
    educationDenom: 2800,
    bachelors: 600, masters: 400, professional: 80, doctorate: 40,
    laborForce: 2400, employed: 2280,
    housingDenom: 1700, ownerOccupied: 1300
  };
  const v = { ...defaults, ...opts };
  await page.route('**/api.census.gov/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([
        ['B01003_001E','B19013_001E','B01002_001E','B15003_001E','B15003_022E','B15003_023E','B15003_024E','B15003_025E','B23025_002E','B23025_004E','B25003_001E','B25003_002E','state','county','tract'],
        [String(v.population), String(v.income), String(v.age), String(v.educationDenom), String(v.bachelors), String(v.masters), String(v.professional), String(v.doctorate), String(v.laborForce), String(v.employed), String(v.housingDenom), String(v.ownerOccupied), '51', '059', '481802']
      ])
    }));
}

test('demographics section starts collapsed and fetches lazily', async ({ page }) => {
  await mockBaseLookups(page);
  await mockTract(page);
  await mockAcs(page);

  let acsCalled = false;
  page.on('request', req => { if (req.url().includes('api.census.gov')) acsCalled = true; });

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.demographics);
  await page.evaluate(() => window.__parcel.inspectPoint(38.85, -77.10));

  await expect(page.locator('#demographics-body')).toBeHidden();
  await expect(page.locator('#demographics-toggle')).toHaveAttribute('aria-expanded', 'false');

  // Wait for the inspect-point side-effects to settle before asserting lazy-load.
  await expect(page.locator('#r-elev')).toHaveText('100.0 ft');
  expect(acsCalled).toBe(false);
});

test('expanding demographics renders all six formatted fields', async ({ page }) => {
  await mockBaseLookups(page);
  await mockTract(page);
  await mockAcs(page);

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.demographics);
  await page.evaluate(() => window.__parcel.inspectPoint(38.85, -77.10));

  await page.click('#demographics-toggle');
  await expect(page.locator('#demographics-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#demographics-body')).toBeVisible();

  await expect(page.locator('#d-population')).toHaveText('4,321');
  await expect(page.locator('#d-income')).toHaveText('$92,500');
  await expect(page.locator('#d-age')).toHaveText('38.4 yr');
  // bachelors+masters+professional+doctorate = 1120 / 2800 = 40.0%
  await expect(page.locator('#d-education')).toHaveText('40.0%');
  // employed/laborForce = 2280/2400 = 95.0%
  await expect(page.locator('#d-employment')).toHaveText('95.0%');
  // ownerOccupied/housingDenom = 1300/1700 = 76.5%
  await expect(page.locator('#d-housing')).toHaveText('76.5%');
  await expect(page.locator('#demographics-note')).toContainText('tract 51059481802');
});

test('collapsing demographics hides the body without refetching', async ({ page }) => {
  await mockBaseLookups(page);
  await mockTract(page);
  await mockAcs(page);

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.demographics);
  await page.evaluate(() => window.__parcel.inspectPoint(38.85, -77.10));

  await page.click('#demographics-toggle');
  await expect(page.locator('#d-population')).toHaveText('4,321');
  await page.click('#demographics-toggle');
  await expect(page.locator('#demographics-body')).toBeHidden();
  await expect(page.locator('#demographics-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('clicking a new point collapses + clears the demographics section', async ({ page }) => {
  await mockBaseLookups(page);
  await mockTract(page);
  await mockAcs(page);

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.demographics);
  await page.evaluate(() => window.__parcel.inspectPoint(38.85, -77.10));
  await page.click('#demographics-toggle');
  await expect(page.locator('#d-population')).toHaveText('4,321');

  await page.evaluate(() => window.__parcel.inspectPoint(38.86, -77.11));
  await expect(page.locator('#demographics-body')).toBeHidden();
  await expect(page.locator('#d-population')).toHaveText('—');
});

test('tract without ACS coverage shows the unavailable note', async ({ page }) => {
  await mockBaseLookups(page);
  await mockTract(page);
  // ACS returns the header row only (no data row) — happens for suppressed
  // tracts and matches lookupAcs's `rows.length < 2` early-exit.
  await page.route('**/api.census.gov/**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify([['B01003_001E','state','county','tract']])
    }));

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.demographics);
  await page.evaluate(() => window.__parcel.inspectPoint(38.85, -77.10));

  await page.click('#demographics-toggle');
  await expect(page.locator('#demographics-note')).toContainText('not available');
  await expect(page.locator('#d-population')).toHaveText('—');
});
