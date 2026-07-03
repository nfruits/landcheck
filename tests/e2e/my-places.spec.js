import { test, expect } from '@playwright/test';

async function bootWith(page, places = []) {
  await page.addInitScript((seed) => {
    localStorage.setItem('parcel.migrationDone', '1');
    localStorage.setItem('parcel.savedPlaces', JSON.stringify(seed));
  }, places);
  // Stub the most-common click-time fetches so inspectPoint doesn't hang.
  await page.route('**/epqs.nationalmap.gov/v1/json**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ value: 100 }) })
  );
  await page.route('**/NFHL/MapServer/28/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [] }) })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.myPlaces);
}

const SAMPLE = [
  { id: 'a', label: 'Bethesda lot', notes: 'wooded',
    lat: 38.98, lng: -77.10, parcelId: null, parcelMeta: null,
    nearestAddress: null, createdAt: new Date().toISOString() },
  { id: 'b', label: null, notes: null,
    lat: 39.10, lng: -77.20, parcelId: 'P-42', parcelMeta: { county: 'md-statewide', ACCTID: 'P-42', ACRES: 2.5 },
    nearestAddress: null, createdAt: new Date().toISOString() }
];

test('my places: empty state shows hint, list hidden', async ({ page }) => {
  await bootWith(page, []);
  await expect(page.locator('#my-places-empty')).toBeVisible();
  await expect(page.locator('.mp-row')).toHaveCount(0);
});

test('my places: list renders one row per saved place with label or fallback', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await expect(page.locator('.mp-row')).toHaveCount(2);
  await expect(page.locator('.mp-row').first()).toContainText('Bethesda lot');
  // Second row has no label or nearestAddress → falls back to coords
  await expect(page.locator('.mp-row').nth(1)).toContainText('39.10000');
});

test('my places: clicking a row flies to its location', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await page.locator('.mp-row').first().click();
  const center = await page.evaluate(() => {
    const c = window.__parcel.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  });
  expect(center.lat).toBeCloseTo(38.98, 2);
  expect(center.lng).toBeCloseTo(-77.10, 2);
});

test('my places: edit pencil opens inline form and saves changes', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await page.locator('.mp-row').first().locator('[data-action="edit"]').click();
  await expect(page.locator('.mp-row.editing')).toBeVisible();
  await page.fill('[data-edit="label"]', 'Renamed');
  await page.fill('[data-edit="notes"]', 'Updated notes');
  await page.click('[data-action="save-edit"]');
  await expect(page.locator('.mp-row').first()).toContainText('Renamed');
  const stored = await page.evaluate(() => window.__parcel.savedPlaces.list()[0]);
  expect(stored.label).toBe('Renamed');
  expect(stored.notes).toBe('Updated notes');
});

test('my places: delete prompts inline confirmation and removes on Confirm', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await page.locator('.mp-row').first().locator('[data-action="delete"]').click();
  await expect(page.locator('.mp-row.confirming-delete')).toBeVisible();
  await expect(page.locator('.mp-confirm-text')).toContainText(/Delete this saved place/i);
  await page.click('[data-action="confirm-delete"]');
  await expect(page.locator('.mp-row')).toHaveCount(1);
});

test('my places: delete Cancel keeps the entry', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await page.locator('.mp-row').first().locator('[data-action="delete"]').click();
  await page.click('[data-action="cancel-delete"]');
  await expect(page.locator('.mp-row.confirming-delete')).toHaveCount(0);
  await expect(page.locator('.mp-row')).toHaveCount(2);
});

test('my places: selecting 2 enables Compare button; modal opens with row per selection', async ({ page }) => {
  await bootWith(page, SAMPLE);
  await page.locator('.mp-row').first().locator('.mp-check').check();
  await expect(page.locator('#compare-selected')).toBeDisabled();
  await page.locator('.mp-row').nth(1).locator('.mp-check').check();
  await expect(page.locator('#compare-selected')).toBeEnabled();
  await expect(page.locator('#compare-selected')).toContainText(/Compare 2/);
  await page.click('#compare-selected');
  await expect(page.locator('.compare-modal.open')).toBeVisible();
  // Both selected labels (or fallback) appear as column headers
  const headers = await page.locator('.compare-table th').allInnerTexts();
  expect(headers.join(' ')).toContain('Bethesda lot');
});
