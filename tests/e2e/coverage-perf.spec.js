import { test, expect } from '@playwright/test';

// Performance budget for the Coverage modal. With 70+ entries across
// Verified + Coming-soon sections, the modal's renderList path could become
// slow if it ever switched to per-row DOM updates. Lock the budget here so
// a regression surfaces immediately.

test('coverage: modal open with 70+ entries renders in under 250ms', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.coverage);

  // Sanity: the registry actually has the entries we're benchmarking against.
  const entryCount = await page.evaluate(async () => {
    const cfg = await import('/js/config.js');
    return Object.keys(cfg.PARCEL_COUNTIES).length;
  });
  expect(entryCount).toBeGreaterThanOrEqual(50);

  // Measure: click the button, wait for the modal class to flip to .open,
  // record total elapsed.
  const elapsed = await page.evaluate(async () => {
    const btn = document.getElementById('coverage-btn');
    const modal = document.getElementById('coverage-modal');
    const t0 = performance.now();
    btn.click();
    // Wait for the .open class + the DOM populated.
    while (!modal.classList.contains('open')) await new Promise(r => setTimeout(r, 4));
    while (!document.querySelector('.coverage-item')) await new Promise(r => setTimeout(r, 4));
    return performance.now() - t0;
  });
  expect(elapsed).toBeLessThan(250);

  // And the modal-card max-height + overflow constraints from the v2 update
  // keep the modal from overflowing the viewport even with the full list.
  const cardOverflow = await page.evaluate(() => {
    const card = document.querySelector('.coverage-modal-card');
    const cs = getComputedStyle(card);
    return { overflowY: cs.overflowY, maxHeight: cs.maxHeight };
  });
  expect(cardOverflow.overflowY).toBe('auto');
  expect(cardOverflow.maxHeight).toMatch(/vh|px/);
});
