import { ICONS } from './icons.js';

/**
 * Tiny element builder. Props: class, style (object), dataset, html, onX listeners,
 * and any prop starting with "_" is set directly on the element (e.g. _activate, _menu, _nav).
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('_')) el[key] = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function icon(name, cls = 'icon') {
  return h('span', { class: cls, html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ''}"/></svg>` });
}

export function debounce(fn, ms) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/** Stable pleasant color for a string (used for letter tiles and avatars). */
export function hashColor(text, saturation = 55, lightness = 42) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} ${saturation}% ${lightness}%)`;
}

export function initials(name) {
  const clean = String(name || '?').trim();
  return (Array.from(clean)[0] || '?').toUpperCase();
}

/** Image that removes itself (and shows a fallback node instead) if it fails to load. */
export function img(src, cls, fallback) {
  if (!src) return fallback || null;
  const el = h('img', { class: cls, src, loading: 'lazy', decoding: 'async', alt: '', draggable: 'false' });
  el.addEventListener('error', () => {
    if (fallback) el.replaceWith(fallback);
    else el.remove();
  }, { once: true });
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

const toastEl = () => document.getElementById('toast');
let toastTimer;
export function toast(message, ms = 3200) {
  const el = toastEl();
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
