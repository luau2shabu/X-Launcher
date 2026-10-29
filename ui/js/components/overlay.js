// Layers above the pages: context menus, choice dialogs, text input, confirmations.
import { h, icon } from '../dom.js';
import * as focus from '../focus.js';
import { t } from '../i18n.js';
import { keyboard, queryField } from './keyboard.js';

const layer = () => document.getElementById('overlay');

/** Shows `content` above everything with its own focus scope. Returns close(). */
export function open(content, { onBack, onKey, scrim = true, focus: initial } = {}) {
  const wrap = h('div', { class: 'overlay-layer', style: { position: 'absolute', inset: 0 } },
    scrim ? h('div', { class: 'scrim', onclick: () => close() }) : null,
    content);
  layer().append(wrap);
  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    focus.popScope(wrap);
    wrap.remove();
  }
  focus.pushScope(wrap, { onBack: onBack ? () => onBack(close) : close, onKey, focus: initial });
  return close;
}

export const isOpen = () => layer().childElementCount > 0;

/** Context menu. items: [{ label, icon, action, danger }]. */
export function menu({ title, image, items }) {
  return new Promise((resolve) => {
    let close;
    const list = h('div', { dataset: { nav: 'list' } },
      items.map((item) => h('div', {
        class: `item focusable ${item.danger ? 'danger' : ''}`,
        _activate: () => {
          close();
          resolve(item);
          item.action?.();
        },
      }, item.icon ? icon(item.icon) : null, h('span', { class: 'label' }, item.label, item.hint ? h('small', null, item.hint) : null))));
    const box = h('div', { class: 'menu-pop' },
      title ? h('div', { class: 'menu-head' }, image ? h('img', { src: image, alt: '' }) : null, h('b', null, title)) : null,
      list);
    close = open(box, { onBack: (c) => { c(); resolve(null); } });
  });
}

/** Yes/no confirmation. Resolves true when the user confirms. */
export function confirm(title, confirmLabel, { danger = false, text } = {}) {
  return new Promise((resolve) => {
    let close;
    const done = (value) => { close(); resolve(value); };
    const box = h('div', { class: 'dialog' },
      h('h2', null, title),
      text ? h('p', null, text) : null,
      h('div', { dataset: { nav: 'list' } },
        h('div', { class: `item focusable ${danger ? 'danger' : ''}`, _activate: () => done(true) }, icon(danger ? 'power' : 'check'), h('span', { class: 'label' }, confirmLabel)),
        h('div', { class: 'item focusable', _activate: () => done(false) }, icon('back'), h('span', { class: 'label' }, t('common.cancel')))));
    close = open(box, { onBack: () => done(false) });
  });
}

/** Text entry with an on-screen keyboard (physical keys work too). Resolves the text or null. */
export function prompt({ title, text, value = '', layout = 'en', allowThai = false }) {
  return new Promise((resolve) => {
    let close;
    const field = queryField('');
    field.value = value;
    const done = (result) => { close(); resolve(result); };
    const osk = keyboard({
      layout,
      allowThai,
      onInput: (ch) => { field.value += ch; },
      onBackspace: () => { field.value = Array.from(field.value).slice(0, -1).join(''); },
      onClear: () => { field.value = ''; },
      onSubmit: () => done(field.value.trim() || null),
    });
    const box = h('div', { class: 'dialog input' }, h('h2', null, title), text ? h('p', null, text) : null, field.el, osk.el);
    close = open(box, {
      onBack: () => done(null),
      onKey: (e) => typing(e, field),
    });
  });
}

/**
 * Physical-keyboard typing into a field (e.g. the QWERTY side of an air-mouse remote).
 * Returns true when the key was used; Enter and arrows are left to normal navigation.
 */
export function typing(e, field) {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key === 'Backspace') {
    if (!field.value) return false; // empty field: Backspace means Back
    field.value = Array.from(field.value).slice(0, -1).join('');
    return true;
  }
  if (e.key.length === 1 && !(e.key === ' ' && !field.value)) {
    field.value += e.key;
    return true;
  }
  return false;
}
