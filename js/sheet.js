// Mobile bottom-sheet controller for the sidebar. On small screens (≤820px)
// the <aside> becomes a fixed, map-first bottom sheet with three snap states
// driven by the data-sheet attribute: "peek" (handle + first panel edge),
// "half", and "full". The handle supports drag (pointer events) and plain
// click-to-cycle. Desktop is untouched — everything here is gated on the
// same media query as the CSS.
//
// The sheet OVERLAYS .map-wrap (position:fixed), so Leaflet never resizes
// and no invalidateSize() plumbing is needed.

const mq = window.matchMedia('(max-width: 820px)');
const aside = document.querySelector('aside');
const handle = document.getElementById('sheet-handle');

const ORDER = ['peek', 'half', 'full'];

function setState(state) {
  if (aside) aside.dataset.sheet = state;
}

function init() {
  if (!aside || !handle) return;
  if (!aside.dataset.sheet) setState('peek');

  let dragging = false;
  let startY = 0;
  let startOffset = 0; // px the sheet is translated down from fully-open

  const peekPx = () => {
    const v = getComputedStyle(aside).getPropertyValue('--sheet-peek').trim();
    return parseInt(v, 10) || 104;
  };
  const offsetFor = (state) => {
    const h = aside.getBoundingClientRect().height;
    if (state === 'full') return 0;
    if (state === 'half') return h * 0.48;
    return h - peekPx();
  };

  handle.addEventListener('pointerdown', (e) => {
    if (!mq.matches) return;
    dragging = true;
    startY = e.clientY;
    startOffset = offsetFor(aside.dataset.sheet || 'peek');
    aside.style.transition = 'none';
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = aside.getBoundingClientRect().height;
    const max = h - peekPx();
    const next = Math.min(max, Math.max(0, startOffset + (e.clientY - startY)));
    aside.style.transform = `translateY(${next}px)`;
  });

  handle.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const h = aside.getBoundingClientRect().height;
    const max = h - peekPx();
    const current = startOffset + (e.clientY - startY);
    const moved = Math.abs(e.clientY - startY) > 6;
    aside.style.transition = '';
    aside.style.transform = '';
    if (!moved) {
      // Treat as a tap: cycle peek → half → full → peek.
      const cur = aside.dataset.sheet || 'peek';
      setState(ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]);
      return;
    }
    // Snap to the nearest state by released offset.
    const targets = [['full', 0], ['half', h * 0.48], ['peek', max]];
    let best = targets[0];
    for (const t of targets) {
      if (Math.abs(current - t[1]) < Math.abs(current - best[1])) best = t;
    }
    setState(best[0]);
  });

  handle.addEventListener('keydown', (e) => {
    if (!mq.matches) return;
    const cur = aside.dataset.sheet || 'peek';
    const i = ORDER.indexOf(cur);
    if (e.key === 'ArrowUp' && i < ORDER.length - 1) setState(ORDER[i + 1]);
    if (e.key === 'ArrowDown' && i > 0) setState(ORDER[i - 1]);
  });
}

init();

export const sheetApi = {
  state: () => aside?.dataset.sheet || 'peek',
  set: setState
};
