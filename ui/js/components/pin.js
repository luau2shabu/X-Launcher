// Parent PIN: numeric keypad dialog, and a helper that asks for the PIN only when one is set.
import { h, icon, toast } from '../dom.js';
import { t } from '../i18n.js';
import { call } from '../bridge.js';
import * as overlay from './overlay.js';

/** Shows a keypad and resolves the digits entered, or null when cancelled. */
export function askPin(title, text) {
  return new Promise((resolve) => {
    let value = '';
    const dots = h('div', { class: 'pin-dots' });
    const render = () => dots.replaceChildren(...Array.from({ length: Math.max(4, value.length) }, (_, i) => h('i', { class: i < value.length ? 'on' : '' })));
    const done = (result) => { close(); resolve(result); };
    const press = (d) => { if (value.length < 8) { value += d; render(); } };
    const key = (label, action, cls = '') => h('div', { class: `key focusable ${cls}`, _activate: action }, label);
    const pad = h('div', { class: 'keys pin-pad', dataset: { nav: 'grid' } },
      ...'123456789'.split('').map((d) => key(d, () => press(d))),
      key(icon('backspace'), () => { value = value.slice(0, -1); render(); }),
      key('0', () => press('0')),
      key(icon('check'), () => value.length >= 4 && done(value), 'ok'));
    const box = h('div', { class: 'dialog pin' }, h('h2', null, title), text ? h('p', null, text) : null, dots, pad);
    const close = overlay.open(box, {
      onBack: () => done(null),
      onKey: (e) => {
        if (/^\d$/.test(e.key)) { press(e.key); return true; }
        if (e.key === 'Backspace' && value) { value = value.slice(0, -1); render(); return true; }
        return false;
      },
      focus: undefined,
    });
    render();
  });
}

/**
 * Asks for the parent PIN when one is set. Resolves the PIN (or '' when no PIN exists),
 * or null when cancelled or wrong.
 */
export async function requirePin(text) {
  const status = await call('pin.status').catch(() => ({ set: false }));
  if (!status.set) return '';
  const pin = await askPin(t('pin.enter'), text);
  if (pin == null) return null;
  if (await call('pin.verify', { pin })) return pin;
  toast(t('pin.wrong'));
  return null;
}

/** Sets or changes the parent PIN (asks for the current one first). Resolves true when saved. */
export async function setPin() {
  const status = await call('pin.status').catch(() => ({ set: false }));
  let current = '';
  if (status.set) {
    current = await askPin(t('pin.current'));
    if (current == null) return false;
  }
  const pin = await askPin(t('pin.new'), t('pin.newHint'));
  if (pin == null) return false;
  const again = await askPin(t('pin.again'));
  if (again !== pin) {
    toast(t('pin.mismatch'));
    return false;
  }
  try {
    await call('pin.set', { pin, current });
    toast(t('pin.saved'));
    return true;
  } catch (err) {
    toast(t('common.error', { msg: err.message }));
    return false;
  }
}
