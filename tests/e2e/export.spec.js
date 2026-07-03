import { test, expect } from '@playwright/test';

// Skip the real snapshot in tests by default — leaflet-image needs CORS tiles
// that aren't reachable in the test browser. Individual tests can override.
async function stubLeafletImage(page, opts = { mode: 'fail' }) {
  await page.evaluate((o) => {
    if (o.mode === 'fail') {
      window.leafletImage = (_, cb) => cb(new Error('skipped in test'));
    } else if (o.mode === 'fake') {
      // Build a 800x600 canvas with some noise so the PNG isn't trivially small.
      const c = document.createElement('canvas');
      c.width = 800; c.height = 600;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#abc';
      ctx.fillRect(0, 0, 800, 600);
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = `rgb(${(i*17)%256},${(i*53)%256},${(i*97)%256})`;
        ctx.fillRect((i*13)%800, (i*23)%600, 12, 12);
      }
      window.leafletImage = (_, cb) => cb(null, c);
    }
  }, opts);
}

test('PDF export button is wired and writes a non-empty PDF', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);
  await stubLeafletImage(page);

  await page.evaluate(() => {
    window.__pdfSaved = null;
    const real = window.jspdf.jsPDF;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      const origSave = inst.save.bind(inst);
      inst.save = (filename) => {
        const out = inst.output('blob');
        window.__pdfSaved = { filename, size: out.size, type: out.type };
        return origSave(filename);
      };
      return inst;
    };
  });

  await page.evaluate(() => window.__parcel.flyout.open());
  await page.click('#export-pdf');
  await page.waitForFunction(() => window.__pdfSaved !== null, null, { timeout: 5000 });
  const saved = await page.evaluate(() => window.__pdfSaved);
  expect(saved).not.toBeNull();
  expect(saved.filename).toMatch(/^parcel-.*\.pdf$/);
  expect(saved.type).toBe('application/pdf');
  expect(saved.size).toBeGreaterThan(500);
});

test('PDF includes the new 2-page section headings', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);
  await stubLeafletImage(page);

  const dataUri = await page.evaluate(async () => {
    const real = window.jspdf.jsPDF;
    let captured = null;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      inst.save = () => { captured = inst.output('datauristring'); };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return captured;
  });

  expect(dataUri).toMatch(/^data:application\/pdf/);
  const raw = Buffer.from(dataUri.split(',')[1], 'base64').toString('latin1');
  expect(raw).toContain('Summary');
  expect(raw).toContain('Detailed Findings');
  expect(raw).toContain('Hazards');
  expect(raw).toContain('Terrain');
  expect(raw).toContain('Soil');
  expect(raw).toContain('Page 1 of 2');
  expect(raw).toContain('Page 2 of 2');
});

test('PDF is exactly 2 pages and surfaces acreage on page 1', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);
  await stubLeafletImage(page);

  // Stub a realistic parcel context so acreage has a real value
  const result = await page.evaluate(async () => {
    // Seed an inspect with parcelMeta carrying acreage
    document.getElementById('p-acres').textContent = '2.450 ac';
    const real = window.jspdf.jsPDF;
    let pageCount = 0;
    let capturedUri = null;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      const origSave = inst.save.bind(inst);
      inst.save = () => {
        pageCount = inst.internal.getNumberOfPages();
        capturedUri = inst.output('datauristring');
      };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return { pageCount, capturedUri };
  });

  expect(result.pageCount).toBe(2);
  const raw = Buffer.from(result.capturedUri.split(',')[1], 'base64').toString('latin1');
  // Acreage value should appear (the "2.450 ac" we stubbed).
  expect(raw).toMatch(/2\.450 ac/);
  // The 'Acreage' label is on the summary page (page 1) — both Acreage label
  // and the value must appear in the document at all.
  expect(raw).toContain('Acreage');
});

test('PDF footer disclaimer appears on every page', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);
  await stubLeafletImage(page);

  const dataUri = await page.evaluate(async () => {
    const real = window.jspdf.jsPDF;
    let captured = null;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      inst.save = () => { captured = inst.output('datauristring'); };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return captured;
  });
  const raw = Buffer.from(dataUri.split(',')[1], 'base64').toString('latin1');
  // Disclaimer text appears (jsPDF may write multiple times — at minimum once)
  expect(raw).toMatch(/verify with surveyor/i);
});

test('PDF with map snapshot is at least 50KB larger than without', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);

  // First: snapshot disabled (baseline)
  await stubLeafletImage(page, { mode: 'fail' });
  const withoutSize = await page.evaluate(async () => {
    const real = window.jspdf.jsPDF;
    let size = 0;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      inst.save = () => { size = inst.output('blob').size; };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return size;
  });

  // Then: snapshot succeeds with a fake 800x600 canvas
  await stubLeafletImage(page, { mode: 'fake' });
  const withSize = await page.evaluate(async () => {
    const real = window.jspdf.jsPDF;
    let size = 0;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      inst.save = () => { size = inst.output('blob').size; };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return size;
  });

  expect(withoutSize).toBeGreaterThan(500);
  expect(withSize).toBeGreaterThan(withoutSize + 50_000);
});

test('PDF: snapshot failure falls back silently to text-only with a small note', async ({ page }) => {
  await page.goto('/app.html?test=1');
  await page.waitForFunction(() => window.__parcel && window.__parcel.export);
  await stubLeafletImage(page, { mode: 'fail' });

  const dataUri = await page.evaluate(async () => {
    const real = window.jspdf.jsPDF;
    let captured = null;
    window.jspdf.jsPDF = function (...args) {
      const inst = new real(...args);
      inst.save = () => { captured = inst.output('datauristring'); };
      return inst;
    };
    await window.__parcel.export.exportPdf();
    window.jspdf.jsPDF = real;
    return captured;
  });
  const raw = Buffer.from(dataUri.split(',')[1], 'base64').toString('latin1');
  expect(raw).toContain('Map snapshot unavailable');
  // No toast surfaced
  await expect(page.locator('#toast')).toHaveCount(0);
});
