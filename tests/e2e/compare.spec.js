import { test, expect } from '@playwright/test';

const FAKE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { ACCTID: 'A1', ACRES: 0.5, OWNNAME: 'OWNER A', NFMTTLVL: 100000 },
      geometry: { type: 'Polygon', coordinates: [[[-77.1010,38.9810],[-77.1008,38.9810],[-77.1008,38.9812],[-77.1010,38.9812],[-77.1010,38.9810]]] }
    },
    {
      type: 'Feature',
      properties: { ACCTID: 'B2', ACRES: 1.5, OWNNAME: 'OWNER B', NFMTTLVL: 250000 },
      geometry: { type: 'Polygon', coordinates: [[[-77.1000,38.9810],[-77.0995,38.9810],[-77.0995,38.9815],[-77.1000,38.9815],[-77.1000,38.9810]]] }
    }
  ]
};

async function setup(page) {
  await page.route('**/MD_ParcelBoundaries/MapServer/0/query**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE) })
  );
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
  await page.evaluate(() => window.__parcel.map.setView([38.9811, -77.1003], 17));
  await page.evaluate(() => localStorage.removeItem('parcel.pinned'));
  await page.evaluate(() => window.__parcel.parcels.reloadPinnedFromStorage());
  await page.click('.layer[data-layer="parcels"]');
  await page.waitForFunction(() => window.__parcel.parcels.countLoaded() === 2);
}

async function clickParcelById(page, id) {
  await page.evaluate(targetId => {
    const map = window.__parcel.map;
    let target = null;
    map.eachLayer(l => {
      if (l.feature && l.feature.properties && l.feature.properties.ACCTID === targetId) target = l;
    });
    target.fire('click', { latlng: target.getBounds().getCenter() });
  }, id);
}

test('pin via JS api requires a parcel click to set currentSelection', async ({ page }) => {
  // The legacy pin button is replaced by the Save-this-place flow; the
  // legacy pinning JS path still works and is exercised here until the
  // compare modal moves to savedPlaces in a follow-up commit.
  await setup(page);
  // Without a clicked parcel, pinCurrent is a no-op
  const before = await page.evaluate(() => window.__parcel.parcels.pinned().length);
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  const after = await page.evaluate(() => window.__parcel.parcels.pinned().length);
  expect(after).toBe(before);

  // After click, pinCurrent adds an entry
  await clickParcelById(page, 'A1');
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  const afterClick = await page.evaluate(() => window.__parcel.parcels.pinned().length);
  expect(afterClick).toBe(before + 1);
});

test('pin a parcel → chip appears and survives reload', async ({ page }) => {
  await setup(page);
  await clickParcelById(page, 'A1');
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  await expect(page.locator('.pin-chip')).toHaveCount(1);
  await expect(page.locator('.pin-chip').first()).toContainText('A1');

  // Persisted to localStorage
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('parcel.pinned')));
  expect(stored).toHaveLength(1);
  expect(stored[0].id).toBe('A1');

  // Survives a full page reload
  await page.reload();
  await page.waitForFunction(() => window.__parcel && window.__parcel.parcels);
  await expect(page.locator('.pin-chip')).toHaveCount(1);
  await expect(page.locator('.pin-chip').first()).toContainText('A1');
});

test('compare modal renders all pinned parcels in a table', async ({ page }) => {
  await setup(page);
  await clickParcelById(page, 'A1');
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  await clickParcelById(page, 'B2');
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  await expect(page.locator('.pin-chip')).toHaveCount(2);

  await page.click('#compare-parcels');
  await expect(page.locator('.compare-modal.open')).toBeVisible();
  await expect(page.locator('.compare-table th')).toContainText(['', 'A1', 'B2']);
  await expect(page.locator('.compare-table tbody tr')).toHaveCount(4); // county, owner, acreage, value
  await expect(page.locator('.compare-table')).toContainText('Maryland');
  await expect(page.locator('.compare-table')).toContainText('OWNER A');
  await expect(page.locator('.compare-table')).toContainText('OWNER B');
  await expect(page.locator('.compare-table')).toContainText('$250,000');

  await page.click('.compare-close');
  await expect(page.locator('.compare-modal.open')).toHaveCount(0);
});

test('cap at 3 pinned parcels', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    localStorage.setItem('parcel.pinned', JSON.stringify([
      { id: 'X1', county: 'md-statewide', props: { ACCTID: 'X1' } },
      { id: 'X2', county: 'md-statewide', props: { ACCTID: 'X2' } },
      { id: 'X3', county: 'md-statewide', props: { ACCTID: 'X3' } }
    ]));
    window.__parcel.parcels.reloadPinnedFromStorage();
  });
  await clickParcelById(page, 'A1');
  // 3 already pinned — attempting another should be a no-op
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  expect(await page.evaluate(() => window.__parcel.parcels.pinned().length)).toBe(3);
  await expect(page.locator('.pin-chip')).toHaveCount(3);
});

test('unpin via × removes the chip', async ({ page }) => {
  await setup(page);
  await clickParcelById(page, 'A1');
  await page.evaluate(() => window.__parcel.parcels.pinCurrent());
  await expect(page.locator('.pin-chip')).toHaveCount(1);
  await page.click('.pin-chip-x');
  await expect(page.locator('.pin-chip')).toHaveCount(0);
});
