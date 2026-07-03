import { test, expect } from '@playwright/test';

test('flood layer auto-disables and shows toast after sustained tile failures', async ({ page }) => {
  await page.route('**/NFHL/MapServer/export**', route => route.abort());

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);

  // Move somewhere that actually requests flood tiles at a usable zoom.
  await page.evaluate(() => window.__parcel.map.setView([29.95, -90.07], 12));

  const layerEl = page.locator('.layer[data-layer="flood"]');
  await layerEl.click();

  const toast = page.locator('#toast');
  await expect(toast).toContainText(/Flood data temporarily unavailable/i, { timeout: 10000 });
  await expect(layerEl).not.toHaveClass(/active/);
});

test('successful tile resets the failure counter (flood toast does not fire on transient errors)', async ({ page }) => {
  let calls = 0;
  await page.route('**/NFHL/MapServer/export**', route => {
    calls += 1;
    // Fail the first 2, then succeed forever after with a 1x1 transparent png.
    if (calls <= 2) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      // 1x1 transparent PNG
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      )
    });
  });

  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.evaluate(() => window.__parcel.map.setView([29.95, -90.07], 12));

  const layerEl = page.locator('.layer[data-layer="flood"]');
  await layerEl.click();

  // Give the layer time to load several tiles. Counter should reset on success.
  await page.waitForTimeout(2000);
  await expect(layerEl).toHaveClass(/active/);
});
