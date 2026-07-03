import { test, expect } from '@playwright/test';

// Schema validation for the PARCEL_COUNTIES registry. With 70+ entries
// across Verified + Coming-soon tiers and per-region grouping, the registry
// is the most-edited config in the project. This test locks in the contract
// every entry must satisfy so future additions don't silently drift.

test('config: PARCEL_COUNTIES entries satisfy registry schema', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);

  // Pull the registry out into the test context.
  const { entries, activeKeys } = await page.evaluate(async () => {
    const cfg = await import('/js/config.js');
    return {
      entries: Object.entries(cfg.PARCEL_COUNTIES).map(([k, v]) => ({ key: k, ...v, _derive: !!v.derive })),
      activeKeys: cfg.ACTIVE_PARCEL_COUNTIES.slice()
    };
  });

  expect(entries.length).toBeGreaterThan(40); // Sanity: registry has substantial content.

  const issues = [];
  for (const e of entries) {
    if (typeof e.label !== 'string' || !e.label) issues.push(`${e.key}: missing label`);
    if (typeof e.state !== 'string' || !/^[A-Z]{2}$/.test(e.state)) issues.push(`${e.key}: state must be 2-letter code`);
    if (typeof e.region !== 'string' || !e.region) issues.push(`${e.key}: missing region (drives Coverage modal grouping)`);
    if (!Array.isArray(e.bbox) || e.bbox.length !== 4) issues.push(`${e.key}: bbox must be [minLon, minLat, maxLon, maxLat]`);
    else {
      const [w, s, ee, n] = e.bbox;
      if (!(w < ee && s < n)) issues.push(`${e.key}: bbox not normalized (w<e and s<n)`);
      if (![w, s, ee, n].every(v => Number.isFinite(v))) issues.push(`${e.key}: bbox has non-finite values`);
    }
    if (e.comingSoon) {
      if (typeof e.skipReason !== 'string' || e.skipReason.length < 10) {
        issues.push(`${e.key}: comingSoon=true requires a substantive skipReason`);
      }
      // Coming-soon must NOT be in ACTIVE — runtime would query a dead endpoint.
      if (activeKeys.includes(e.key)) {
        issues.push(`${e.key}: comingSoon=true must NOT appear in ACTIVE_PARCEL_COUNTIES`);
      }
    } else {
      // Verified entries must have a queryable URL + fieldMap shape.
      if (typeof e.url !== 'string' || !/^https?:\/\//.test(e.url)) {
        issues.push(`${e.key}: verified entry needs a full https URL`);
      }
      if (e.kind !== 'rest') issues.push(`${e.key}: kind must be 'rest' for now`);
      if (!e.fieldMap || typeof e.fieldMap !== 'object') issues.push(`${e.key}: missing fieldMap`);
      else for (const k of ['id', 'acres', 'owner', 'value']) {
        if (!Array.isArray(e.fieldMap[k])) issues.push(`${e.key}: fieldMap.${k} must be an array (use [] when not exposed)`);
      }
    }
  }
  expect(issues).toEqual([]);
});

test('config: ACTIVE_PARCEL_COUNTIES references only registered keys', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  const orphans = await page.evaluate(async () => {
    const cfg = await import('/js/config.js');
    return cfg.ACTIVE_PARCEL_COUNTIES.filter(k => !cfg.PARCEL_COUNTIES[k]);
  });
  expect(orphans).toEqual([]);
});

test('config: every Verified entry uses a documented region label', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.map);
  const unknown = await page.evaluate(async () => {
    const cfg = await import('/js/config.js');
    // Mirror the REGION_ORDER + REGION_LABELS from coverage.js — if you add a
    // new region to a county, you must also add the label here so the
    // Coverage modal can render it under a labelled group.
    const known = new Set([
      'us-northeast', 'us-south', 'us-midwest', 'us-west',
      // metro-county groups for no-statewide states
      'ca-counties', 'az-counties', 'or-counties', 'nm-counties',
      'il-counties', 'mi-counties', 'mo-counties', 'ia-counties', 'ks-counties', 'sd-counties',
      'ga-counties', 'sc-counties', 'ok-counties', 'al-counties', 'la-counties', 'ky-counties',
      'pa-counties',
      'maryland', 'northern-virginia', 'richmond', 'charlottesville',
      'hampton-roads', 'shenandoah', 'roanoke-lynchburg', 'southside',
      'eastern-shore', 'northern-neck', 'middle-peninsula',
      'southwest-virginia', 'central-virginia'
    ]);
    const out = [];
    for (const [k, v] of Object.entries(cfg.PARCEL_COUNTIES)) {
      if (v.region && !known.has(v.region)) out.push(`${k}: unknown region '${v.region}'`);
    }
    return out;
  });
  expect(unknown).toEqual([]);
});
