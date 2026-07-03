import { test, expect } from '@playwright/test';

test('clicking a basemap moves the active class', async ({ page }) => {
  await page.goto('/app.html');

  await page.click('.basemap-btn[data-basemap="street"]');
  await expect(page.locator('.basemap-btn.active')).toHaveAttribute('data-basemap', 'street');

  await page.click('.basemap-btn[data-basemap="topo"]');
  await expect(page.locator('.basemap-btn.active')).toHaveAttribute('data-basemap', 'topo');

  await expect(page.locator('.basemap-btn.active')).toHaveCount(1);
});

test('switching to street basemap requests CARTO tiles', async ({ page }) => {
  await page.goto('/app.html');
  const tilePromise = page.waitForRequest(req => req.url().includes('basemaps.cartocdn.com'));
  await page.click('.basemap-btn[data-basemap="street"]');
  await tilePromise;
});

test('label overlay tiles render over satellite basemap', async ({ page }) => {
  await page.goto('/app.html');
  await expect(page.locator('img[src*="dark_only_labels"]').first()).toBeAttached({ timeout: 5000 });
});

test('switching to street basemap removes the labels overlay', async ({ page }) => {
  await page.goto('/app.html');
  await expect(page.locator('img[src*="dark_only_labels"]').first()).toBeAttached({ timeout: 5000 });
  await page.click('.basemap-btn[data-basemap="street"]');
  await expect(page.locator('img[src*="dark_only_labels"]')).toHaveCount(0);
});
