import { test, expect } from '@playwright/test';

const NOMINATIM_FIXTURE = [
  { lat: '30.2672', lon: '-97.7431', display_name: 'Austin, Travis County, Texas, USA' },
  { lat: '30.2849', lon: '-97.7341', display_name: 'Downtown Austin, Texas, USA' }
];

// Locate is collapsed by default — every test that types into the search
// input has to click the toggle first to reveal it.
async function expandLocate(page) {
  await page.click('#search-toggle');
  await expect(page.locator('#locate-panel')).toHaveClass(/expanded/);
}

test('locate starts collapsed and exposes a toggle button', async ({ page }) => {
  await page.goto('/app.html');
  await expect(page.locator('#locate-panel')).not.toHaveClass(/expanded/);
  await expect(page.locator('#search-toggle')).toBeVisible();
  // Input exists in the DOM but its wrap is hidden by CSS until expanded.
  await expect(page.locator('#search')).toBeHidden();
});

test('locate expands on toggle click and the search input becomes usable', async ({ page }) => {
  await page.goto('/app.html');
  await expandLocate(page);
  await expect(page.locator('#search')).toBeVisible();
});

test('coordinate input shows direct go-to result with no network call', async ({ page }) => {
  let nominatimCalled = false;
  await page.route('**/nominatim.openstreetmap.org/**', route => {
    nominatimCalled = true;
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('30.27, -97.74');
  await expect(page.locator('.search-results')).toHaveClass(/active/);
  await expect(page.locator('.search-result').first()).toContainText('30.27000');
  await expect(page.locator('.search-result').first()).toContainText('-97.74000');

  expect(nominatimCalled).toBe(false);
});

test('address search calls Nominatim and renders results', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(NOMINATIM_FIXTURE)
    })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('Austin TX');
  await expect(page.locator('.search-result').first()).toContainText('Austin, Travis County');
  await expect(page.locator('.search-result')).toHaveCount(2);
});

test('clicking a search result populates readouts via inspectPoint and auto-collapses', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(NOMINATIM_FIXTURE)
    })
  );
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ value: 489.3 })
    })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ features: [{ attributes: { FLD_ZONE: 'X', ZONE_SUBTY: null } }] })
    })
  );

  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('Austin TX');
  await page.locator('.search-result').first().click();

  // Locate auto-collapses after a result selection
  await expect(page.locator('#locate-panel')).not.toHaveClass(/expanded/);
  await expect(page.locator('#r-elev')).toHaveText('489.3 ft');
  await expect(page.locator('#r-flood')).toHaveText('X');
});

test('empty search response shows "no matches"', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('zzzqqqxxxnope');
  await expect(page.locator('.search-result').first()).toContainText(/no matches/i);
});

test('ZIP code search calls Nominatim and renders results', async ({ page }) => {
  const ZIP_FIX = [
    { lat: '20815', lon: '-77.10', display_name: 'Bethesda, Montgomery County, MD 20815, USA' }
  ];
  let calledWithZip = false;
  await page.route('**/nominatim.openstreetmap.org/search**', route => {
    if (route.request().url().includes('q=20815')) calledWithZip = true;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ZIP_FIX) });
  });
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('20815');
  await expect(page.locator('.search-result').first()).toContainText('20815');
  expect(calledWithZip).toBe(true);
});

test('city name search renders results', async ({ page }) => {
  const CITY_FIX = [
    { lat: '38.9784', lon: '-77.1011', display_name: 'Bethesda, Maryland, USA' }
  ];
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CITY_FIX) })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('Bethesda');
  await expect(page.locator('.search-result').first()).toContainText('Bethesda');
});

test('search has a help-tooltip element with usage hint', async ({ page }) => {
  await page.goto('/app.html');
  await expandLocate(page);
  await expect(page.locator('#search-help')).toBeVisible();
  await expect(page.locator('#search-help')).toHaveAttribute('title', /address/i);
  await expect(page.locator('#search')).toHaveAttribute('placeholder', /address.*city.*zip.*lat,lon/i);
});

test('typing into the expanded search input fires Nominatim and renders results (regression)', async ({ page }) => {
  // Real user flow: click the icon, then TYPE — not fill(). fill() bypasses
  // focus/event-binding paths so it can hide regressions in the collapse refactor.
  const ANNAPOLIS_FIX = [
    { lat: '38.9784', lon: '-76.4922', display_name: 'Annapolis, Anne Arundel County, MD, USA' }
  ];
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANNAPOLIS_FIX) })
  );
  await page.goto('/app.html');
  await page.click('#search-toggle');
  await expect(page.locator('#search')).toBeVisible();
  await page.locator('#search').click();
  await page.keyboard.type('Annapolis MD');
  // End-to-end: input value updated AND results rendered.
  await expect(page.locator('#search')).toHaveValue('Annapolis MD');
  await expect(page.locator('.search-result').first()).toContainText(/Annapolis/i);
});

test('search uses Census geocoder for queries that look like street addresses', async ({ page }) => {
  let censusCalled = false;
  let nominatimCalled = false;
  await page.route('**/geocoding.geo.census.gov/**', route => {
    censusCalled = true;
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { addressMatches: [{
        coordinates: { x: -77.0365, y: 38.8977 },
        matchedAddress: '1600 PENNSYLVANIA AVE NW, WASHINGTON, DC, 20500'
      }]}})
    });
  });
  await page.route('**/nominatim.openstreetmap.org/**', route => {
    nominatimCalled = true;
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('1600 Pennsylvania Ave NW');
  await expect(page.locator('.search-result').first()).toContainText('PENNSYLVANIA');
  expect(censusCalled).toBe(true);
  expect(nominatimCalled).toBe(false);
  await expect(page.locator('.result-source').first()).toHaveText(/Census/i);
});

test('search falls back to Nominatim when Census returns no match', async ({ page }) => {
  await page.route('**/geocoding.geo.census.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { addressMatches: [] }}) })
  );
  await page.route('**/nominatim.openstreetmap.org/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ lat: '38.9', lon: '-77.0', display_name: 'Some Address' }]) })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('999 Nonexistent Rd');
  await expect(page.locator('.search-result').first()).toContainText('Some Address');
});

test('search: city-only queries skip Census and go straight to Nominatim', async ({ page }) => {
  let censusCalled = false;
  await page.route('**/geocoding.geo.census.gov/**', route => {
    censusCalled = true;
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { addressMatches: [] }}) });
  });
  await page.route('**/nominatim.openstreetmap.org/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ lat: '38.98', lon: '-77.10', display_name: 'Bethesda, MD' }]) })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('Bethesda MD');
  await expect(page.locator('.search-result').first()).toContainText('Bethesda');
  expect(censusCalled).toBe(false);
});

test('recent searches: clicking a result saves it; empty focus shows the history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('parcel.recentSearches');
  });
  await page.route('**/geocoding.geo.census.gov/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ result: { addressMatches: [{
        coordinates: { x: -77.0, y: 38.9 },
        matchedAddress: '500 Oak St, Annapolis, MD'
      }]}}) })
  );
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 50 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('500 Oak St Annapolis');
  await page.locator('.search-result').first().click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('parcel.recentSearches')));
  expect(stored).toContain('500 Oak St Annapolis');

  // Re-expand; empty input should show recents
  await page.click('#search-toggle');
  await expect(page.locator('#search')).toBeVisible();
  await page.locator('#search').focus();
  await expect(page.locator('.search-result-recent').first()).toContainText('500 Oak St Annapolis');
});

test('clicking outside the locate panel closes it', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/search**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM_FIXTURE) })
  );
  await page.goto('/app.html');
  await expandLocate(page);
  await page.locator('#search').fill('Austin TX');
  await expect(page.locator('.search-results')).toHaveClass(/active/);
  await page.locator('header .brand-mark').click();
  await expect(page.locator('#locate-panel')).not.toHaveClass(/expanded/);
});
