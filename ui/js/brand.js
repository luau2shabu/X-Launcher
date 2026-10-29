// X Launcher brand: the Angstrom X bar mark and the spaced-out wordmark.
import { h } from './dom.js';

// Bars from the Angstrom X logo in a 106 x 80 box: x, y, height (width 10, fully rounded)
const BARS = [[3, 11, 62], [33, 3, 56], [63, 14, 62], [93, 3, 58]];
let gradientId = 0;

export function mark(cls = 'brand-mark') {
  const id = `xl-grad-${++gradientId}`;
  const bars = BARS.map(([x, y, height]) => `<rect x="${x}" y="${y}" width="10" height="${height}" rx="5" fill="url(#${id})"/>`).join('');
  return h('span', {
    class: cls,
    html: `<svg viewBox="0 0 106 80" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3BA3CC"/><stop offset="1" stop-color="#1F6F97"/></linearGradient></defs>${bars}</svg>`,
  });
}

/** Mark + "X LAUNCHER" wordmark, like the Angstrom X logo lockup. */
export function logo(cls = 'brand-logo') {
  return h('div', { class: cls, role: 'img', 'aria-label': 'X Launcher' }, mark(), h('span', { class: 'brand-word' }, 'X LAUNCHER'));
}

/** Full-screen splash while the first screen loads. */
export function showSplash() {
  const splash = h('div', { id: 'splash' }, logo('brand-logo big'), h('div', { class: 'brand-by' }, 'by ANGSTROM X'));
  document.body.append(splash);
  return () => {
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 700);
  };
}
