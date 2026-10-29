// Plex media helpers shared by Home, Movies, Shows, Library, Search and Details.
import { h, icon, toast } from '../dom.js';
import { t, formatDuration, formatTimecode } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import * as router from '../router.js';
import * as overlay from './overlay.js';
import { row, landscapeCard, posterCard, rowTitle } from './cards.js';

export function metaLine(item) {
  const parts = [];
  if (item.year) parts.push(h('span', null, item.year));
  if (item.rating) parts.push(h('span', { class: 'rating' }, item.rating.toFixed(1)));
  if (item.contentRating) parts.push(h('span', { class: 'badge' }, item.contentRating));
  if ((item.type === 'movie' || item.type === 'episode') && item.duration) parts.push(h('span', null, formatDuration(item.duration)));
  if (item.type === 'show' && item.childCount) parts.push(h('span', null, t('details.seasons', { n: item.childCount })));
  if (item.genres?.length) parts.push(h('span', null, item.genres.slice(0, 2).join(' · ')));
  return parts;
}

/** Plays in Plex HTPC and reports the outcome. */
export async function playItem(item, offset = 0) {
  toast(t('play.opening'), 8000);
  try {
    const result = await data.play(item, offset);
    if (result?.status === 'opened') toast(t('play.opened'), 5000);
  } catch (err) {
    toast(t('play.failed', { msg: err.message }), 6000);
  }
}

export const openDetails = (item) => router.open('details', item);

/** Long-press menu for a movie, show or episode. */
export async function itemMenu(item, rerender) {
  const playable = item.type === 'movie' || item.type === 'episode';
  const items = [];
  if (playable && item.viewOffset > 0) {
    items.push({ label: t('details.resume', { time: formatTimecode(item.viewOffset) }), icon: 'play', action: () => playItem(item, item.viewOffset) });
    items.push({ label: t('details.startOver'), icon: 'replay', action: () => playItem(item, 0) });
  } else if (playable) {
    items.push({ label: t('details.play'), icon: 'play', action: () => playItem(item, 0) });
  }
  items.push({ label: t('hero.cta'), icon: 'info', action: () => openDetails(item) });
  items.push({
    label: item.watched ? t('details.markUnwatched') : t('details.markWatched'),
    icon: item.watched ? 'hide' : 'check',
    action: () => toggleWatched(item, rerender),
  });
  await overlay.menu({ title: item.title, image: item.poster, items });
}

export async function toggleWatched(item, rerender) {
  try {
    await call('plex.watched', { server: item.server, key: item.key, watched: !item.watched });
    data.invalidate('plex');
    rerender?.();
  } catch (err) {
    toast(t('common.error', { msg: err.message }));
  }
}

/** A Plex row: landscape cards for Continue watching, posters otherwise. */
export function mediaRow(plexRow, { rerender } = {}) {
  const landscape = plexRow.kind === 'continue';
  const onActivate = (item) => {
    if (landscape && (item.type === 'movie' || item.type === 'episode')) playItem(item, item.viewOffset);
    else openDetails(item);
  };
  const onMenu = (item) => itemMenu(item, rerender);
  const cards = plexRow.items.map((item) => (landscape ? landscapeCard(item, { onActivate, onMenu }) : posterCard(item, { onActivate, onMenu })));
  const section = row(rowTitle(plexRow), cards, { kind: plexRow.kind });
  section.addEventListener('tvfocus', (e) => router.setBackdropSoon(e.target._item?.art || null));
  return section;
}

export function offlineNotice() {
  return h('div', { class: 'empty' }, h('b', null, t('plex.offlineTitle')), t('plex.offlineText'));
}

export function emptyNotice(text) {
  return h('div', { class: 'empty' }, text);
}
