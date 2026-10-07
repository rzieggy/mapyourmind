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
  pointer: '<circle cx="8" cy="16" r="2.5"/><path d="M10 14c3-3 4-8 10-9M12 18c3-1 5-4 6-7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12"/>',
  redo: '<path d="m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18"/>',
  export: '<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z"/>',
  folderPlus: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5ZM12 10.5v6M9 13.5h6"/>',
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
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9.5a1 1 0 0 0 1 1h3.5"/>',
  arrange: '<rect x="3" y="10" width="5" height="4" rx="1"/><rect x="16" y="4" width="5" height="4" rx="1"/><rect x="16" y="16" width="5" height="4" rx="1"/><path d="M8 12h4M12 6v12M12 6h4M12 18h4"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9h4v3H7zM13 13h4v3h-4zM11 10.5h2v4"/>',
  sticker: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2M9.2 9.6h.01M14.8 9.6h.01"/>',
  line: '<path d="M6 18 18 6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  template: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17M9.5 9.5v11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.shape}</svg>`;
}
function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]"))
    el.innerHTML = icon(el.dataset.icon);
}
hydrateIcons();
