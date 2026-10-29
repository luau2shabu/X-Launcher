// Icon picker: searches the internet for large icons for an app and lets the user choose one.
import { h, img, toast } from '../dom.js';
import { t } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as overlay from './overlay.js';
import { appIcon } from './cards.js';

const SOURCE_LABELS = { store: 'App Store', web: 'Website' };

export async function pickIcon(app, { rerender } = {}) {
  const grid = h('div', { class: 'icon-grid', dataset: { nav: 'grid' } });
  const status = h('p', { class: 'icon-status' }, t('icons.searching'));
  const box = h('div', { class: 'dialog icon-picker' },
    h('h2', null, t('icons.title', { name: app.name })),
    h('p', null, t('icons.text')),
    status,
    grid);
  const close = overlay.open(box, { focus: false });

  const tile = (picture, label, sub, action) => h('div', { class: 'icon-choice focusable', _activate: action },
    picture, h('span', { class: 'icon-label' }, label), sub ? h('small', null, sub) : null);

  // While searching, the "keep current" tile is already usable
  const keep = tile(appIcon(app, 'choice-img'), t('icons.keep'), null, close);
  grid.append(keep);
  focus.refocus(keep);

  let results = [];
  try {
    results = await call('icons.search', { name: app.name, website: app.kind === 'url' ? app.target : null });
  } catch (err) {
    console.warn(err);
  }
  if (!box.isConnected) return;

  const choose = (candidate) => async () => {
    close();
    toast(t('icons.saving'));
    try {
      await call('icons.use', { id: app.id, url: candidate.url });
      await data.loadSettings();
      data.invalidate('apps');
      toast(t('icons.saved', { name: app.name }));
      rerender?.();
    } catch (err) {
      toast(t('common.error', { msg: err.message }), 5000);
    }
  };

  const tiles = results.map((c) => {
    const picture = img(c.url, 'choice-img', null);
    const el = tile(picture, c.label || SOURCE_LABELS[c.source] || '', `${SOURCE_LABELS[c.source] || c.source} · ${c.size}px`, choose(c));
    // Drop candidates whose image does not load
    picture?.addEventListener('error', () => el.remove(), { once: true });
    return el;
  });
  if (data.state.settings.iconOverrides?.[app.id]) {
    tiles.push(tile(h('span', { class: 'choice-img reset' }, '↺'), t('icons.reset'), null, async () => {
      close();
      await call('icons.reset', { id: app.id });
      await data.loadSettings();
      data.invalidate('apps');
      rerender?.();
    }));
  }
  grid.append(...tiles);
  status.textContent = results.length ? '' : t('icons.none');
  if (tiles.length && focus.focused() === keep) focus.set(tiles[0]);
}
