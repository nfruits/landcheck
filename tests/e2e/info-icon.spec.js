import { test, expect } from '@playwright/test';

test('info icon: hover shifts its colour to the amber accent', async ({ page }) => {
  await page.goto('/app.html');
  const icon = page.locator('.info-icon').first();
  await expect(icon).toBeVisible();

  const colorIdle = await icon.evaluate(el => window.getComputedStyle(el).color);
  await icon.hover();
  // Allow the 150ms transition to settle.
  await page.waitForTimeout(180);
  const colorHover = await icon.evaluate(el => window.getComputedStyle(el).color);

  expect(colorHover).not.toBe(colorIdle);
  // Hover colour must equal the live --amber token (drift-proof: reads the
  // token and converts to rgb rather than hardcoding a hex that changes when
  // the accent is retuned, e.g. the 2026-06-13 redesign #b8862c → #e0a23c).
  const expectedAmber = await page.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim();
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
  });
  expect(colorHover).toBe(expectedAmber);
});

test('info icon: click toggles a persistent tip-open class (for touch)', async ({ page }) => {
  await page.goto('/app.html');
  const icon = page.locator('.info-icon').first();
  await icon.click();
  await expect(icon).toHaveClass(/tip-open/);
  // Click outside closes
  await page.locator('header .brand-mark').click();
  await expect(icon).not.toHaveClass(/tip-open/);
});

test('info icon: carries the data-tip text, accessible via attribute', async ({ page }) => {
  await page.goto('/app.html');
  const icon = page.locator('.info-icon').first();
  const tip = await icon.getAttribute('data-tip');
  expect(tip).toMatch(/zoom/i);
  expect(tip.length).toBeGreaterThan(20); // a real helper sentence, not "?"
});
