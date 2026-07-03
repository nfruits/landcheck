import { test, expect } from '@playwright/test';

test('default view: last-viewed location restored from localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('parcel.lastView', JSON.stringify({
      lat: 38.97, lng: -76.50, zoom: 13
    }));
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  const center = await page.evaluate(() => {
    const c = window.__parcel.map.getCenter();
    return { lat: c.lat, lng: c.lng, zoom: window.__parcel.map.getZoom() };
  });
  expect(center.lat).toBeCloseTo(38.97, 2);
  expect(center.lng).toBeCloseTo(-76.50, 2);
  expect(center.zoom).toBe(13);
});

test('default view: panning persists current view to localStorage', async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem('parcel.lastView'); });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  // The initial fallback setView already schedules a persistView — wait for
  // that to settle before issuing the test's own setView so we measure the
  // test-issued state, not a race.
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__parcel.map.setView([38.5, -77.5], 14));
  await page.waitForTimeout(400);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('parcel.lastView') || 'null'));
  expect(stored).not.toBeNull();
  expect(stored.lat).toBeCloseTo(38.5, 2);
  expect(stored.lng).toBeCloseTo(-77.5, 2);
  expect(stored.zoom).toBe(14);
});

// Bug 3 regression: no request should ever go out to ipapi.co under any
// boot path. The prior IP-geolocation tier was removed because ipapi.co
// blocks browser CORS for plain origins and surfaces as a console error.
test('default view: no ipapi.co request fires under any boot path', async ({ page }) => {
  const ipapiRequests = [];
  page.on('request', r => { if (r.url().includes('ipapi.co')) ipapiRequests.push(r.url()); });
  await page.addInitScript(() => { localStorage.removeItem('parcel.lastView'); });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.waitForTimeout(500); // give any latent fetch a chance
  expect(ipapiRequests).toEqual([]);
});

// Bug 3 regression: when there is no last-viewed location in localStorage,
// the map opens at the MD/NoVA fallback (38.85, -77.10) at zoom 9 — no
// IP geolocation, no async setView jitter.
test('default view: hard fallback to MD/NoVA when no last-viewed', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('parcel.lastView');
    localStorage.removeItem('parcel.basemap');
  });
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  const c = await page.evaluate(() => {
    const cc = window.__parcel.map.getCenter();
    return { lat: cc.lat, lng: cc.lng, zoom: window.__parcel.map.getZoom() };
  });
  expect(c.lat).toBeCloseTo(38.85, 1);
  expect(c.lng).toBeCloseTo(-77.10, 1);
  expect(c.zoom).toBe(9);
});

test('default view: basemap preference persists across reload', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await page.click('.basemap-btn[data-basemap="topo"]');
  const stored = await page.evaluate(() => localStorage.getItem('parcel.basemap'));
  expect(stored).toBe('topo');
  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  await expect(page.locator('.basemap-btn[data-basemap="topo"]')).toHaveClass(/active/);
});
