// Google TV-style on-screen keyboard: a key grid plus a row of special keys.
import { h, icon, clear } from '../dom.js';
import { t } from '../i18n.js';

const LAYOUTS = {
  en: { cols: 9, keys: [...'abcdefghijklmnopqrstuvwxyz1234567890'] },
  th: {
    cols: 11,
    keys: [
      ...'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ',
      'ะ', 'ั', 'า', 'ำ', 'ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'เ', 'แ', 'โ', 'ใ', 'ไ',
      '็', '่', '้', '๊', '๋', '์', 'ๆ',
    ],
  },
  url: { cols: 9, keys: [...'abcdefghijklmnopqrstuvwxyz1234567890', '.', '/', ':', '-', '_', '@', '?', '=', '&'] },
};

// Thai combining marks need a base character to be visible on a key
const isCombining = (ch) => /[ัิ-ฺ็-๎]/.test(ch);

/**
 * @param {object} opts
 * @param {(text: string) => void} opts.onInput   called with a character to append
 * @param {() => void} opts.onBackspace
 * @param {() => void} opts.onClear
 * @param {() => void} opts.onSubmit
 * @param {string} [opts.layout]  'th' | 'en' | 'url'
 * @param {boolean} [opts.allowThai]  show the language toggle
 * @param {string} [opts.submitLabel]
 */
export function keyboard(opts) {
  let layout = opts.layout || 'en';
  const grid = h('div', { class: 'keys', dataset: { nav: 'grid' } });
  const special = h('div', { class: 'special', dataset: { nav: 'row' } });
  const root = h('div', { class: 'osk' }, grid, special);

  function key(label, action, cls = '') {
    return h('div', { class: `key focusable ${cls}`, _activate: action }, label);
  }

  function renderKeys() {
    const { cols, keys } = LAYOUTS[layout];
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    clear(grid).append(...keys.map((ch) => key(isCombining(ch) ? `◌${ch}` : ch, () => opts.onInput(ch))));
  }

  function renderSpecial() {
    clear(special);
    if (opts.allowThai) {
      special.append(key(layout === 'th' ? 'ABC' : 'กขค', () => {
        layout = layout === 'th' ? 'en' : 'th';
        renderKeys();
        renderSpecial();
      }, 'wide'));
    }
    if (layout === 'url') special.append(key('.com', () => opts.onInput('.com'), 'wide'));
    special.append(
      key(icon('space'), () => opts.onInput(' '), 'wide'),
      key(icon('backspace'), () => opts.onBackspace(), 'wide'),
      key(t('key.clear'), () => opts.onClear(), 'wide'),
    );
    if (opts.onSubmit) special.append(key(opts.submitLabel || t('key.ok'), () => opts.onSubmit(), 'wide'));
  }

  renderKeys();
  renderSpecial();
  return { el: root, grid, special };
}

/** The text field shown above a keyboard. */
export function queryField(placeholder) {
  const text = h('span', { class: 'text', dataset: { placeholder } });
  const el = h('div', { class: 'query' }, icon('search'), text, h('span', { class: 'caret' }));
  return {
    el,
    get value() { return text.textContent; },
    set value(v) { text.textContent = v; },
  };
}
