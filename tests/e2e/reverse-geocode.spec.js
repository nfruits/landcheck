import { test, expect } from '@playwright/test';

async function bootStubbed(page) {
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.addInitScript(() => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.removeItem('parcel.savedPlaces');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.inspectPoint);
}

test('reverse-geocode: high-confidence address upgrades the fly-out title', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        display_name: '100 Main St, Bethesda, MD 20815, USA',
        type: 'house', class: 'building',
        address: { house_number: '100' }
      })
    })
  );
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(38.98, -77.10));
  await expect(page.locator('#flyout-title')).toContainText('Near 100 Main St');
  await expect(page.locator('#flyout-title')).not.toHaveClass(/approximate/);
});

test('reverse-geocode: low-confidence locality result uses "Near ~" and muted style', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        display_name: 'Montgomery County, Maryland, USA',
        type: 'administrative', class: 'boundary'
      })
    })
  );
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(39.00, -77.20));
  await expect(page.locator('#flyout-title')).toContainText('Near ~ Montgomery County');
  await expect(page.locator('#flyout-title')).toHaveClass(/approximate/);
});

test('reverse-geocode: nearest address auto-fills the Save form label placeholder', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        display_name: '500 Oak St, Annapolis, MD',
        type: 'house', address: { house_number: '500' }
      })
    })
  );
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(38.97, -76.50));
  await expect(page.locator('#flyout-title')).toContainText('Oak St');
  await page.click('#save-place');
  await expect(page.locator('#sp-label')).toHaveAttribute('placeholder', /Oak St/);
});

test('reverse-geocode: failure fails silently (no nearest line, no error toast)', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/reverse**', route =>
    route.fulfill({ status: 500, contentType: 'text/plain', body: 'server error' })
  );
  await bootStubbed(page);
  await page.evaluate(() => window.__parcel.inspectPoint(38.98, -77.10));
  // Give a moment for the failed fetch
  await page.waitForTimeout(400);
  await expect(page.locator('#flyout-nearest')).toBeEmpty();
  // No toast surfaced
  await expect(page.locator('#toast')).toHaveCount(0);
});
