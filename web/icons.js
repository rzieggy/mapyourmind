"use strict";
// A single 24px outline vocabulary for every editor control.
const iconPaths = {
  import: '<path d="M12 3v12m-4-4 4 4 4-4M5 14v7h14v-7"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>',
  select: '<path d="m5 3 14 10-7 1-3 7-4-18Z"/>',
  hand: '<path d="M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v9c0 4-3 6-7 6-3 0-5-2-6-4l-3-5a2 2 0 0 1 3-2l1 1Z"/>',
  shape: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  mind: '<rect x="3" y="9" width="6" height="6" rx="1"/><path d="M9 12h4M13 4v16m0-16h4m-4 8h4m-4 8h4"/><path d="M17 2h4v4h-4zm0 8h4v4h-4zm0 8h4v4h-4z"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8"/>',
  connector: '<path d="M4 19 20 4M12 4h8v8"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  export: '<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  document: '<path d="M5 3h9l5 5v13H5zM14 3v5h5M8 12h8M8 16h6"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  diamond: '<path d="m12 3 9 9-9 9-9-9z"/>',
  pill: '<rect x="3" y="6" width="18" height="12" rx="6"/>',
  io: '<path d="M7 5h14l-4 14H3z"/>',
  note: '<path d="M4 3h16v13l-5 5H4zM15 21v-5h5M8 8h8M8 12h6"/>',
  left: '<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
  center: '<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
  right: '<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
  alignLeft: '<path d="M4 3v18M8 7h12v3H8zm0 7h8v3H8z"/>',
  alignCenter: '<path d="M12 3v18M4 7h16v3H4zm3 7h10v3H7z"/>',
  alignRight: '<path d="M20 3v18M4 7h12v3H4zm4 7h8v3H8z"/>',
  horizontal: '<path d="M3 4v16m18-16v16M7 7h3v10H7zm7 0h3v10h-3z"/>',
  top: '<path d="M3 4h18M7 8h3v12H7zm7 0h3v8h-3z"/>',
  middle: '<path d="M3 12h18M7 4h3v16H7zm7 3h3v10h-3z"/>',
  bottom: '<path d="M3 20h18M7 4h3v12H7zm7 4h3v8h-3z"/>',
  vertical: '<path d="M4 3h16M4 21h16M7 7h10v3H7zm0 7h10v3H7z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.shape}</svg>`;
}
function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]"))
    el.innerHTML = icon(el.dataset.icon);
}
hydrateIcons();
