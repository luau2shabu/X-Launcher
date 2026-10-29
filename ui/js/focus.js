// D-pad focus engine.
//
// A screen is a "scope" (page, drawer, dialog). Inside it, focusable things live in
// sections marked with data-nav:
//   row  – horizontal list (left/right inside, up/down jumps to the next section)
//   grid – wraps into lines (all four directions inside, leaves at the edges)
//   list – vertical list (up/down inside)
// Sections remember their last focused item, like Google TV rows do.
// Elements and sections can override movement with an `_nav` object: { left() {...} }.
// Returning false from an override falls back to the default behavior.

const scopes = [];
let current = null;
const focusListeners = new Set();

export const top = () => scopes[scopes.length - 1];
export const focused = () => current;

export function onFocusChange(fn) {
  focusListeners.add(fn);
  return () => focusListeners.delete(fn);
}

/** Make `root` the active screen. Options: onBack(), onKey(event) for raw typing, focus element. */
export function pushScope(root, options = {}) {
  scopes.push({ root, onBack: options.onBack, onKey: options.onKey, last: null });
  const target = options.focus === false ? null : options.focus || firstIn(root);
  if (target) set(target);
}

export function popScope(root) {
  const index = scopes.findIndex((s) => s.root === root);
  if (index < 0) return;
  scopes.splice(index, 1);
  const scope = top();
  if (!scope) return;
  const restore = scope.last && scope.root.contains(scope.last) && isVisible(scope.last) ? scope.last : firstIn(scope.root);
  if (restore) set(restore);
}

export function scopeOf(el) {
  return scopes.find((s) => s.root.contains(el));
}

export function set(el, { scroll = true } = {}) {
  if (!el) return;
  if (current && current !== el) current.classList.remove('focused');
  current = el;
  el.classList.add('focused');
  const scope = scopeOf(el);
  if (scope) scope.last = el;
  const section = sectionOf(el);
  if (section) section._mem = el;
  if (scroll) reveal(el, section);
  el.dispatchEvent(new CustomEvent('tvfocus', { bubbles: true }));
  for (const fn of focusListeners) fn(el);
}

/** Re-focus something sensible after the DOM under the current scope changed. */
export function refocus(preferred) {
  const scope = top();
  if (!scope) return;
  if (preferred && scope.root.contains(preferred) && isVisible(preferred)) return set(preferred);
  if (current && scope.root.contains(current) && isVisible(current)) return set(current);
  const first = firstIn(scope.root);
  if (first) set(first);
}

export function firstIn(root) {
  for (const section of sections(root)) {
    const its = items(section);
    if (its.length) return section._mem && its.includes(section._mem) ? section._mem : its[0];
  }
  return null;
}

export function move(dir) {
  const scope = top();
  if (!scope) return false;
  if (!current || !scope.root.contains(current) || !isVisible(current)) {
    const first = firstIn(scope.root);
    if (first) set(first);
    return true;
  }

  const own = current._nav?.[dir];
  if (own && own() !== false) return true;

  const section = sectionOf(current);
  if (!section) return false;
  const its = items(section);
  const i = its.indexOf(current);
  const type = section.dataset.nav;
  const horizontal = dir === 'left' || dir === 'right';

  if (type === 'row' && horizontal) {
    const j = dir === 'left' ? i - 1 : i + 1;
    if (j >= 0 && j < its.length) return set(its[j]), true;
  } else if (type === 'list' && !horizontal) {
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j >= 0 && j < its.length) return set(its[j]), true;
  } else if (type === 'grid') {
    const cols = columns(its);
    const col = i % cols;
    if (dir === 'left' && col > 0) return set(its[i - 1]), true;
    if (dir === 'right' && col < cols - 1 && i + 1 < its.length) return set(its[i + 1]), true;
    if (dir === 'up' && i - cols >= 0) return set(its[i - cols]), true;
    if (dir === 'down' && i + cols < its.length) return set(its[i + cols]), true;
    if (dir === 'down' && Math.floor(i / cols) < Math.floor((its.length - 1) / cols)) return set(its[its.length - 1]), true;
  }

  const sectionNav = section._nav?.[dir];
  if (sectionNav && sectionNav() !== false) return true;
  if (horizontal) return false;
  return jump(scope.root, section, dir);
}

function jump(root, section, dir) {
  const all = sections(root);
  const step = dir === 'up' ? -1 : 1;
  for (let j = all.indexOf(section) + step; j >= 0 && j < all.length; j += step) {
    const its = items(all[j]);
    if (its.length) {
      set(entry(all[j], its, dir));
      return true;
    }
  }
  section.dispatchEvent(new CustomEvent('tvedge', { detail: dir }));
  return false;
}

// Rows return to their remembered item; grids and lists enter at the nearest column.
function entry(section, its, dir) {
  const type = section.dataset.nav;
  if (section._mem && its.includes(section._mem) && type === 'row') return section._mem;
  if (type === 'list') return section._mem && its.includes(section._mem) ? section._mem : its[0];
  if (type === 'grid' && current) {
    const cols = columns(its);
    const lineStart = dir === 'down' ? 0 : Math.floor((its.length - 1) / cols) * cols;
    const line = its.slice(lineStart, lineStart + cols);
    const x = center(current).x;
    return line.reduce((best, el) => (Math.abs(center(el).x - x) < Math.abs(center(best).x - x) ? el : best), line[0]);
  }
  return its[0];
}

export function sections(root) {
  return [...root.querySelectorAll('[data-nav]')].filter(isVisible);
}

export function items(section) {
  return [...section.querySelectorAll('.focusable')].filter(
    (el) => el.closest('[data-nav]') === section && !el.classList.contains('disabled') && isVisible(el),
  );
}

export const sectionOf = (el) => el.closest('[data-nav]');

function isVisible(el) {
  return !!(el.offsetParent || el.getClientRects().length);
}

function columns(its) {
  if (its.length < 2) return 1;
  const top0 = its[0].offsetTop;
  let n = 1;
  while (n < its.length && its[n].offsetTop === top0) n++;
  return n;
}

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ---------------------------------------------------------------- scrolling

function reveal(el, section) {
  if (section?.dataset.nav === 'row') scrollRow(section, el);
  const scroller = el.closest('.scroller');
  if (!scroller) return;
  let target = null;
  const height = scroller.clientHeight;
  if (section?.dataset.scroll === 'top') {
    target = 0;
  } else if (section?.dataset.nav === 'grid' || section?.dataset.nav === 'list') {
    const y = offsetWithin(el, scroller);
    if (y - scroller.scrollTop < height * 0.25 || y + el.offsetHeight - scroller.scrollTop > height * 0.8) target = y - height * 0.3;
  } else if (section) {
    target = offsetWithin(section, scroller) - height * 0.16;
  }
  if (target != null) scroller.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}

/** Google TV keeps the focused card at the row's left edge until the row runs out. */
export function scrollRow(section, el) {
  const track = section.querySelector('.track');
  if (!track) return;
  const inset = parseFloat(getComputedStyle(track).paddingLeft) || 0;
  const max = Math.max(0, track.offsetWidth - section.clientWidth);
  const x = Math.min(max, Math.max(0, el.offsetLeft - inset));
  track.style.transform = `translateX(${-x}px)`;
}

function offsetWithin(el, scroller) {
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}
