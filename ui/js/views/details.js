// Details page for a movie, show or episode: art, metadata, badges, play buttons,
// seasons/episodes for shows, and "More like this".
import { h, icon, toast } from '../dom.js';
import { t, formatTimecode, formatDuration } from '../i18n.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as router from '../router.js';
import { row, landscapeCard, posterCard, badgeList } from '../components/cards.js';
import { metaLine, playItem, toggleWatched, itemMenu, openDetails } from '../components/media.js';

export async function openItemDetails(stub) {
  const art = h('div', { class: 'details-art', style: stub.art ? { backgroundImage: `url("${stub.art}")` } : null });
  const content = h('div', { class: 'scroller' });
  const page = h('div', { class: 'page details' }, art, content);
  content.append(header(stub, []));
  router.setBackdrop(null);
  router.pushPage(page, { onShow: () => refresh() });

  let item = stub;
  async function refresh() {
    try {
      item = (await data.plexItem(stub.server, stub.key)) || stub;
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
      return;
    }
    if (!page.isConnected) return;
    if (item.art) art.style.backgroundImage = `url("${item.art}")`;
    const focusedIndex = focusPath(content);
    content.replaceChildren(header(item, actions(item, refresh)));
    if (item.type === 'show') await appendSeasons(content, item);
    else if (item.type === 'season') await appendEpisodes(content, item, item.key);
    appendRelated(content, item);
    restoreFocus(content, focusedIndex);
  }
  await refresh();
}

function header(item, buttons) {
  const isEpisode = item.type === 'episode';
  const people = [];
  if (item.directors?.length) people.push(h('div', null, h('b', null, `${t('details.director')}: `), item.directors.join(', ')));
  if (item.cast?.length) people.push(h('div', null, h('b', null, `${t('details.cast')}: `), item.cast.join(', ')));
  const progress = item.progress > 0.01 && !item.watched
    ? h('div', { class: 'resume-bar' }, h('i', { style: { width: `${Math.round(item.progress * 100)}%` } }))
    : null;
  return h('div', { class: 'head' },
    h('div', { class: 'server' }, item.serverName),
    h('h1', null, item.title),
    isEpisode ? h('div', { class: 'episode' }, item.subtitle) : null,
    item.tagline ? h('div', { class: 'tagline' }, item.tagline) : null,
    h('div', { class: 'meta' }, metaLine(item),
      progress && item.duration ? h('span', null, t('details.left', { time: formatDuration(item.duration - item.viewOffset) })) : null),
    item.badges?.length ? h('div', { class: 'badges' }, badgeList(item.badges)) : null,
    item.summary ? h('p', { class: 'summary' }, item.summary) : null,
    people.length ? h('div', { class: 'people' }, people) : null,
    buttons.length ? h('div', { class: 'actions', dataset: { nav: 'row', scroll: 'top' } }, buttons) : null,
    progress);
}

function button(label, iconName, action) {
  return h('div', { class: 'btn focusable', _activate: action }, icon(iconName), label);
}

function actions(item, refresh) {
  const list = [];
  if (item.type === 'movie' || item.type === 'episode') {
    if (item.viewOffset > 0) {
      list.push(button(t('details.resume', { time: formatTimecode(item.viewOffset) }), 'play', () => playItem(item, item.viewOffset)));
      list.push(button(t('details.startOver'), 'replay', () => playItem(item, 0)));
    } else {
      list.push(button(t('details.play'), 'play', () => playItem(item, 0)));
    }
  } else if (item.onDeck) {
    const next = item.onDeck;
    const label = next.season != null ? `S${next.season} E${next.episode}` : next.subtitle;
    list.push(button(t('details.playEp', { ep: label }), 'play', () => playItem(next, next.viewOffset)));
  }
  list.push(button(item.watched ? t('details.markUnwatched') : t('details.markWatched'), item.watched ? 'hide' : 'check',
    () => toggleWatched(item, refresh)));
  return list;
}

async function appendSeasons(content, show) {
  const seasons = await data.plexChildren(show.server, show.key).catch(() => []);
  if (!seasons.length) return;
  const episodesHolder = h('div');
  let shown = null;
  const chips = seasons.map((season) => {
    const chip = h('div', { class: 'chip focusable', _item: season, _activate: () => focus.move('down') }, season.subtitle || t('details.season', { n: season.season }));
    chip.addEventListener('tvfocus', () => showSeason(season, chip));
    return chip;
  });
  const chipRow = h('section', { class: 'row', dataset: { nav: 'row' } },
    h('div', { class: 'viewport' }, h('div', { class: 'track', style: { gap: '.8rem' } }, chips)));

  // Start on the season of the next episode to watch
  const startIndex = Math.max(0, seasons.findIndex((s) => s.key === show.onDeck?.seasonKey));
  chipRow._mem = chips[startIndex];
  content.append(chipRow, episodesHolder);
  await showSeason(seasons[startIndex], chips[startIndex]);

  async function showSeason(season, chip) {
    if (shown === season.key) return;
    shown = season.key;
    chips.forEach((c) => c.classList.toggle('selected', c === chip));
    const episodes = await data.plexChildren(season.server, season.key).catch(() => []);
    if (shown !== season.key) return;
    const onDeckIndex = episodes.findIndex((e) => e.key === show.onDeck?.key);
    const episodesRow = episodeRow(episodes);
    if (onDeckIndex > 0) episodesRow._mem = episodesRow.querySelectorAll('.focusable')[onDeckIndex] || null;
    episodesHolder.replaceChildren(episodesRow);
  }
}

async function appendEpisodes(content, season, key) {
  const episodes = await data.plexChildren(season.server, key).catch(() => []);
  if (episodes.length) content.append(episodeRow(episodes));
}

function episodeRow(episodes) {
  const cards = episodes.map((ep) => {
    const card = landscapeCard({ ...ep, title: ep.episode != null ? `${ep.episode}. ${ep.episodeTitle || ''}` : ep.title, subtitle: formatDuration(ep.duration) }, {
      onActivate: () => playItem(ep, ep.viewOffset),
      onMenu: () => itemMenu(ep),
    });
    if (ep.watched) card.querySelector('.frame').append(h('span', { class: 'watched' }, icon('check')));
    return card;
  });
  return row(t('row.episodes'), cards, { kind: 'episodes' });
}

async function appendRelated(content, item) {
  const key = item.type === 'episode' ? item.showKey : item.key;
  if (!key) return;
  const related = await data.plexRelated(item.server, key).catch(() => []);
  if (!related.length || !content.isConnected) return;
  content.append(row(t('row.related'), related.map((r) => posterCard(r, { onActivate: openDetails, onMenu: (i) => itemMenu(i) })), { kind: 'related' }));
}

// Keep focus on the same button/row position across a refresh
function focusPath(root) {
  const el = focus.focused();
  if (!el || !root.contains(el)) return null;
  const sections = focus.sections(root);
  const section = focus.sectionOf(el);
  return { section: sections.indexOf(section), item: focus.items(section).indexOf(el) };
}

function restoreFocus(root, path) {
  if (!path) return focus.refocus();
  const section = focus.sections(root)[path.section];
  const its = section ? focus.items(section) : [];
  focus.refocus(its[Math.min(path.item, its.length - 1)]);
}
