// Passive UI plumbing: lat/lon/zoom/scale mini-readout in the sidebar,
// the About modal, the footer "Reset view" link, and the keyboard ESC
// handler that closes whichever modal is currently open. Purely presentation.

import { map, resetView } from './map.js';

const latDisplay = document.getElementById('lat-display');
const lonDisplay = document.getElementById('lon-display');
const zoomDisplay = document.getElementById('zoom-display');
const scaleDisplay = document.getElementById('scale-display');

function updateCenterReadout() {
  const c = map.getCenter();
  latDisplay.textContent = c.lat.toFixed(5) + '°';
  lonDisplay.textContent = c.lng.toFixed(5) + '°';
  zoomDisplay.textContent = map.getZoom();
  const metersPerPixel = 156543.03392 * Math.cos(c.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
  const feetPerPixel = metersPerPixel * 3.28084;
  scaleDisplay.textContent = `1px ≈ ${feetPerPixel.toFixed(1)}ft`;
}
map.on('move zoom', updateCenterReadout);
updateCenterReadout();

// Keep every layer toggle's aria-checked in sync with its row's .active
// class. One observer instead of patching the three modules (overlays,
// admin, parcels) that flip the class — also covers boot-time restored
// toggle states for free.
const toggleObserver = new MutationObserver((muts) => {
  for (const m of muts) {
    const row = m.target;
    row.querySelector('.toggle')?.setAttribute('aria-checked', String(row.classList.contains('active')));
  }
});
document.querySelectorAll('.layer').forEach(row => {
  const toggle = row.querySelector('.toggle');
  if (toggle) {
    toggle.setAttribute('aria-checked', String(row.classList.contains('active')));
    const label = row.querySelector('.layer-label')?.textContent.trim();
    if (label) toggle.setAttribute('aria-label', `Toggle ${label}`);
  }
  toggleObserver.observe(row, { attributes: true, attributeFilter: ['class'] });
});

const resetLink = document.getElementById('reset-view');
if (resetLink) resetLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('Reset view? This clears your saved center, zoom, and basemap preference.')) {
    resetView();
  }
});

// About modal — a real on-theme modal (was a native alert(), which couldn't
// carry clickable buymeacoffee/contact links; flagged in the 2026-05-11
// review, implemented 2026-07-01). Content lives in app.html #about-modal.
const aboutModal = document.getElementById('about-modal');
document.getElementById('about-link').addEventListener('click', (e) => {
  e.preventDefault();
  if (aboutModal) aboutModal.classList.add('open');
});
if (aboutModal) {
  document.getElementById('about-close')?.addEventListener('click', () => {
    aboutModal.classList.remove('open');
  });
  aboutModal.addEventListener('click', (e) => {
    if (e.target === aboutModal) aboutModal.classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') aboutModal.classList.remove('open');
  });
}
