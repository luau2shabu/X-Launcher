// Page stack (tabs page at the bottom, details/search/library pages on top) and shared screen chrome.
import * as focus from './focus.js';
import { debounce } from './dom.js';

const stage = () => document.getElementById('stage');
const pages = [];
const factories = {};

export function register(name, factory) {
  factories[name] = factory;
}

/** Open a registered page or overlay, e.g. open('details', item). */
export function open(name, ...args) {
  return factories[name]?.(...args);
}

export function pushPage(el, { onBack, onKey, onShow, focus: initial } = {}) {
  const previous = pages[pages.length - 1];
  if (previous) previous.el.hidden = true;
  stage().append(el);
  pages.push({ el, onShow });
  focus.pushScope(el, { onBack: onBack || popPage, onKey, focus: initial });
}

export function popPage() {
  if (pages.length <= 1) return false;
  const page = pages.pop();
  const previous = pages[pages.length - 1];
  previous.el.hidden = false;
  focus.popScope(page.el);
  page.el.remove();
  previous.onShow?.();
  return true;
}

export function popToRoot() {
  while (pages.length > 1) popPage();
}

export const depth = () => pages.length;

// ---------------------------------------------------------------- backdrop

let backdropUrl = null;
let backdropIndex = 0;

export function setBackdrop(url) {
  if (url === backdropUrl) return;
  backdropUrl = url;
  const layers = document.querySelectorAll('#backdrop .layer');
  const current = layers[backdropIndex];
  const next = layers[1 - backdropIndex];
  current.classList.remove('on');
  if (!url) return;
  const probe = new Image();
  probe.onload = () => {
    if (backdropUrl !== url) return;
    next.style.backgroundImage = `url("${url}")`;
    next.classList.add('on');
    backdropIndex = 1 - backdropIndex;
  };
  probe.src = url;
}

export const setBackdropSoon = debounce(setBackdrop, 450);
