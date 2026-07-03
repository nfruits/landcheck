import { test, expect } from '@playwright/test';

test('favicon: SVG declared in <head>, serves 200, no /favicon.ico 404', async ({ page, request }) => {
  const responses = [];
  page.on('response', r => {
    if (r.url().includes('favicon')) responses.push({ url: r.url(), status: r.status() });
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.waitForTimeout(300);

  // The <link rel="icon"> must be present and point to the SVG asset.
  const linkHref = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(linkHref).toBe('favicon.svg');

  // The SVG asset must serve 200 (headless Chromium under Playwright does
  // not always fetch favicons, so verify via a direct request).
  const svgRes = await request.get('/favicon.svg');
  expect(svgRes.status()).toBe(200);
  expect(svgRes.headers()['content-type']).toContain('image/svg');

  // Modern browsers honor the link tag and skip the legacy /favicon.ico
  // fallback — verify no 404 surfaced during the page load.
  const ico404 = responses.find(r => r.url.endsWith('/favicon.ico') && r.status === 404);
  expect(ico404, 'no /favicon.ico 404 expected — SVG link tag should preempt it').toBeFalsy();
});
