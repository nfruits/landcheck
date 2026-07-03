// Single source of truth for HTML-escaping strings before they enter an
// innerHTML / bindPopup / template-literal DOM sink. Centralised (2026-07-01
// security sweep) so a new sink can `import { escapeHtml }` instead of relying
// on per-file copies — the copy-paste pattern let js/protected-lands.js ship
// an unescaped PAD-US popup. Escapes the five HTML-significant characters.
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}
