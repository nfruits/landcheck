import { test, expect } from '@playwright/test';

test('coverage: button opens a modal with Verified + Coming-soon sections, grouped by region', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await expect(page.locator('#coverage-modal')).not.toHaveClass(/open/);
  await page.click('#coverage-btn');
  await expect(page.locator('#coverage-modal')).toHaveClass(/open/);
  // Two sections: Verified and Coming soon.
  await expect(page.locator('.coverage-section-title', { hasText: /^Verified$/ })).toBeVisible();
  await expect(page.locator('.coverage-section-title', { hasText: /^Coming soon$/ })).toBeVisible();
  // Region groupings inside Verified — at least Maryland and Northern Virginia
  // are present since md-statewide + Fairfax/Loudoun/etc. are wired.
  await expect(page.locator('.coverage-region-label', { hasText: 'Maryland' }).first()).toBeVisible();
  await expect(page.locator('.coverage-region-label', { hasText: 'Northern Virginia' }).first()).toBeVisible();
  // Verified badge appears at least once (MD + the new VA wires)
  await expect(page.locator('.coverage-item-status.verified').first()).toBeVisible();
  // Coming-soon badge appears at least once (Fauquier / Spotsylvania / etc.)
  await expect(page.locator('.coverage-item-status.coming-soon').first()).toBeVisible();
});

test('coverage: runtime-verified county flips its badge to Verified', async ({ page }) => {
  // Seed localStorage so Loudoun appears verified at boot.
  await page.addInitScript(() => {
    localStorage.setItem('parcel.county.verified.loudoun-va', '1');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await page.click('#coverage-btn');
  const loudounRow = page.locator('.coverage-item', { hasText: 'Loudoun' });
  await expect(loudounRow.locator('.coverage-item-status.verified')).toBeVisible();
});

test('coverage: footer carries a mailto placeholder for future county requests', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await page.click('#coverage-btn');
  // GitHub issue link is first; mailto is the second link in the footer.
  const mailtoHref = await page.locator('.coverage-footer a[href^="mailto:"]').first().getAttribute('href');
  expect(mailtoHref).toMatch(/^mailto:/);
});

test('coverage: clicking an entry flies the map to that county bbox', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await page.click('#coverage-btn');
  // Order-independent: read the first entry's key, look up its bbox from the
  // registry, and assert the map centered within it. (The first entry is no
  // longer Maryland — statewide regions lead the list as of the 2026-06-12
  // nationwide expansion.)
  const firstItem = page.locator('.coverage-item').first();
  const key = await firstItem.getAttribute('data-key');
  const bbox = await page.evaluate(async (k) => {
    const cfg = await import('/js/config.js');
    return cfg.PARCEL_COUNTIES[k]?.bbox;
  }, key);
  await firstItem.click();
  // fitBounds is asynchronous (animated) — wait for moveend before reading center.
  await page.evaluate(() => new Promise(resolve => {
    window.__parcel.map.once('moveend', resolve);
    setTimeout(resolve, 2000); // safety
  }));
  const center = await page.evaluate(() => {
    const c = window.__parcel.map.getCenter();
    return { lat: c.lat, lng: c.lng };
  });
  const [minLon, minLat, maxLon, maxLat] = bbox;
  expect(center.lat).toBeGreaterThan(minLat);
  expect(center.lat).toBeLessThan(maxLat);
  expect(center.lng).toBeGreaterThan(minLon);
  expect(center.lng).toBeLessThan(maxLon);
});

test('coverage: close button dismisses the modal', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await page.click('#coverage-btn');
  await expect(page.locator('#coverage-modal')).toHaveClass(/open/);
  await page.click('#coverage-modal .coverage-close');
  await expect(page.locator('#coverage-modal')).not.toHaveClass(/open/);
});

test('coverage: footer carries the coverage-expansion note + GitHub issue link', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);
  await page.click('#coverage-btn');
  await expect(page.locator('.coverage-footer')).toContainText(/expanded county-by-county/i);
  // GitHub issue link points at the real repo.
  const issueHref = await page.locator('.coverage-footer a').first().getAttribute('href');
  expect(issueHref).toBe('https://github.com/nfruits/landcheck/issues');
});
