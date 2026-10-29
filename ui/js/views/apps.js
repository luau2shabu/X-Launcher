// "Your apps" row (Home + Apps tab) and the Apps tab grid: launch, add, move, hide, remove.
import { h, toast } from '../dom.js';
import { t } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as router from '../router.js';
import * as overlay from '../components/overlay.js';
import { row, appCard, actionCard, skeletonRow } from '../components/cards.js';
import { pickIcon } from '../components/icon-picker.js';

export async function launch(app) {
  toast(t('apps.opening', { name: app.name }));
  try {
    await call('apps.launch', { id: app.id });
  } catch (err) {
    toast(t('common.error', { msg: err.message }), 5000);
  }
}

const kindLabel = (app) => ({ url: t('apps.website'), exe: t('apps.program'), store: t('apps.store') }[app.kind] || t('apps.desktop'));

async function appMenu(app, card, rerender) {
  const favorite = data.isFavorite(app.id);
  const hidden = data.isHidden(app.id);
  const inFavoritesRow = card.closest('[data-kind="favorites"]');
  const items = [{ label: t('apps.open'), hint: kindLabel(app), icon: 'play', action: () => launch(app) }];
  if (favorite) {
    if (inFavoritesRow) items.push({ label: t('apps.move'), icon: 'move', action: () => startMove(card) });
    items.push({
      label: t('apps.removeFav'), icon: 'delete',
      action: async () => {
        await data.updateProfile((p) => { p.favorites = p.favorites.filter((id) => id !== app.id); });
        toast(t('apps.removed', { name: app.name }));
        rerender();
      },
    });
  } else {
    items.push({
      label: t('apps.addFav'), icon: 'add',
      action: async () => {
        await data.updateProfile((p) => { p.favorites.push(app.id); });
        toast(t('apps.added', { name: app.name }));
        rerender();
      },
    });
  }
  items.push({ label: t('icons.change'), hint: t('icons.changeHint'), icon: 'photo', action: () => pickIcon(app, { rerender }) });
  if (app.kind !== 'url') {
    const windowed = data.state.settings.launch.windowedApps.includes(app.id);
    items.push({
      label: windowed ? t('apps.fullscreenOff') : t('apps.fullscreenOn'), hint: t('apps.fullscreenHint'), icon: 'display',
      action: async () => {
        const list = data.state.settings.launch.windowedApps;
        await data.updateSettings({ launch: { windowedApps: windowed ? list.filter((id) => id !== app.id) : [...list, app.id] } });
      },
    });
  }
  items.push({
    label: hidden ? t('apps.unhide') : t('apps.hide'), icon: hidden ? 'show' : 'hide',
    action: async () => {
      const hiddenApps = hidden ? data.state.settings.hiddenApps.filter((id) => id !== app.id) : [...data.state.settings.hiddenApps, app.id];
      await data.updateSettings({ hiddenApps });
      if (!hidden) toast(t('apps.hidden', { name: app.name }));
      rerender();
    },
  });
  if (app.custom) {
    items.push({
      label: t('apps.remove'), icon: 'delete', danger: true,
      action: async () => {
        await call('apps.removeCustom', { id: app.id });
        await data.loadSettings();
        data.invalidate('apps');
        toast(t('apps.removed', { name: app.name }));
        rerender();
      },
    });
  }
  await overlay.menu({ title: app.name, image: app.icon, items });
}

// Google TV-style move mode: ← → swap with neighbours, OK or Back to finish.
function startMove(card) {
  const track = card.parentElement;
  const original = { activate: card._activate, menu: card._menu };
  card.classList.add('moving');
  toast(t('apps.moveHint'), 4000);
  const swap = (sibling, before) => {
    if (!sibling?.dataset.id) return true;
    if (before) track.insertBefore(card, sibling);
    else track.insertBefore(sibling, card);
    focus.set(card);
    return true;
  };
  const finish = () => {
    card.classList.remove('moving');
    card._nav = null;
    card._back = null;
    card._activate = original.activate;
    card._menu = original.menu;
    const order = [...track.children].map((c) => c.dataset.id).filter(Boolean);
    data.updateProfile((p) => { p.favorites = order; });
    return true;
  };
  card._nav = {
    left: () => swap(card.previousElementSibling, true),
    right: () => swap(card.nextElementSibling, false),
    up: () => true,
    down: () => true,
  };
  card._activate = finish;
  card._menu = finish;
  card._back = finish;
}

/** The favorites row. On Home it ends with a shortcut to the Apps tab when empty. */
export function favoritesRow(apps, { rerender, withAdd = false, onEmpty } = {}) {
  const cards = apps.map((app) => appCard(app, { onActivate: launch, onMenu: (a, card) => appMenu(a, card, rerender) }));
  if (withAdd || cards.length === 0) cards.push(actionCard(t('apps.add'), 'add', () => (withAdd ? addAppMenu(rerender) : onEmpty?.())));
  const section = row(t('row.apps'), cards, { kind: 'favorites' });
  section.addEventListener('tvfocus', () => router.setBackdrop(null));
  return section;
}

export async function addAppMenu(rerender) {
  await overlay.menu({
    title: t('apps.add'),
    items: [
      { label: t('apps.addProgram'), icon: 'program', action: () => addProgram(rerender) },
      { label: t('apps.addWebsite'), icon: 'web', action: () => addWebsite(rerender) },
    ],
  });
}

async function addProgram(rerender) {
  try {
    const app = await call('apps.addProgram');
    if (!app) return;
    await afterAdd(app, rerender);
  } catch (err) {
    toast(t('common.error', { msg: err.message }), 5000);
  }
}

async function addWebsite(rerender) {
  const url = await overlay.prompt({ title: t('apps.addWebsite'), text: t('apps.websiteUrl'), value: 'https://', layout: 'url' });
  if (!url || url === 'https://') return;
  let host = url;
  try { host = new URL(url.includes('://') ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { /* validated by the host */ }
  const suggested = host.split('.')[0].replace(/^./, (c) => c.toUpperCase());
  const name = await overlay.prompt({ title: t('apps.websiteName'), value: suggested, layout: 'en', allowThai: true });
  if (!name) return;
  const mode = await overlay.menu({
    title: t('apps.howOpen'),
    items: [
      { label: t('apps.tvMode'), hint: t('apps.tvModeHint'), icon: 'tv', tv: true },
      { label: t('apps.normalMode'), hint: t('apps.normalModeHint'), icon: 'web', tv: false },
    ],
  });
  if (!mode) return;
  try {
    const app = await call('apps.addWebsite', { url, name, tvMode: mode.tv });
    await afterAdd(app, rerender);
  } catch (err) {
    toast(t('common.error', { msg: err.message }), 5000);
  }
}

// A new app usually has only a small (or no) icon: offer large ones from the internet right away
async function afterAdd(app, rerender) {
  await data.loadSettings();
  data.invalidate('apps');
  toast(t('apps.added', { name: app.name }));
  rerender();
  await pickIcon(app, { rerender });
}

export async function renderApps(container, ctx) {
  container.append(skeletonRow('app'), skeletonRow('app'));
  const [all, favorites] = await Promise.all([data.apps(), data.favoriteApps()]);
  if (ctx.stale()) return;
  container.replaceChildren();

  container.append(favoritesRow(favorites, { rerender: ctx.rerender, withAdd: true }));

  const hiddenCount = all.filter((a) => data.isHidden(a.id)).length;
  const visible = all.filter((a) => data.state.showHiddenApps || !data.isHidden(a.id));
  const cards = visible.map((app) =>
    appCard(app, { hidden: data.isHidden(app.id), onActivate: launch, onMenu: (a, card) => appMenu(a, card, ctx.rerender) }));
  cards.push(actionCard(t('apps.addProgram'), 'program', () => addProgram(ctx.rerender)));
  cards.push(actionCard(t('apps.addWebsite'), 'web', () => addWebsite(ctx.rerender)));
  if (hiddenCount > 0 || data.state.showHiddenApps) {
    cards.push(actionCard(data.state.showHiddenApps ? t('apps.hideHidden') : t('apps.showHidden', { n: hiddenCount }), data.state.showHiddenApps ? 'hide' : 'show', () => {
      data.state.showHiddenApps = !data.state.showHiddenApps;
      ctx.rerender();
    }));
  }

  const grid = h('div', { class: 'grid apps', dataset: { nav: 'grid' } }, cards);
  grid.addEventListener('tvfocus', () => router.setBackdrop(null));
  container.append(h('section', { class: 'grid-sec' }, h('h2', { class: 'row-title', style: { padding: '0 0 1rem' } }, t('row.allApps')), grid));
}
