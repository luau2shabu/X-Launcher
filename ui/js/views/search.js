// Search page: on-screen keyboard on the left, results (apps + Plex) on the right.
import { h, debounce } from '../dom.js';
import { t, getLang } from '../i18n.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as router from '../router.js';
import { keyboard, queryField } from '../components/keyboard.js';
import { typing } from '../components/overlay.js';
import { row, appCard, posterCard, landscapeCard } from '../components/cards.js';
import { openDetails, itemMenu, playItem } from '../components/media.js';
import { launch } from './apps.js';

export function openSearch() {
  router.setBackdrop(null);
  const field = queryField(t('search.placeholder'));
  const results = h('div', { class: 'scroller' }, h('div', { class: 'hint' }, t('search.hint')));
  let generation = 0;

  const osk = keyboard({
    layout: getLang() === 'th' ? 'th' : 'en',
    allowThai: true,
    onInput: (ch) => update(field.value + ch),
    onBackspace: () => update(Array.from(field.value).slice(0, -1).join('')),
    onClear: () => update(''),
  });

  const left = h('div', { class: 'left' }, field.el, osk.el);
  const page = h('div', { class: 'page' }, h('div', { class: 'search' }, left, h('div', { class: 'right' }, results)));

  // Right from the keyboard's edge goes to the results; left from the results' first card comes back
  osk.grid._nav = { right: () => enterResults() };
  osk.special._nav = { right: () => enterResults(), down: () => true };
  function enterResults() {
    const first = focus.sections(results)[0];
    if (!first) return true;
    focus.set(first._mem && focus.items(first).includes(first._mem) ? first._mem : focus.items(first)[0]);
    return true;
  }

  function update(value) {
    field.value = value;
    runSearch();
  }

  const runSearch = debounce(async () => {
    const query = field.value.trim();
    const mine = ++generation;
    if (!query) return results.replaceChildren(h('div', { class: 'hint' }, t('search.hint')));
    results.replaceChildren(h('div', { class: 'hint' }, t('search.searching')));

    const needle = query.toLocaleLowerCase();
    const [apps, plex] = await Promise.all([
      data.visibleApps().then((all) => all.filter((a) => a.name.toLocaleLowerCase().includes(needle)).slice(0, 20)),
      data.plexSearch(query).catch(() => ({ movies: [], shows: [], episodes: [] })),
    ]);
    if (mine !== generation) return;

    const rows = [];
    if (plex.movies.length) rows.push(row(t('row.movies'), plex.movies.map((i) => posterCard(i, { onActivate: openDetails, onMenu: (x) => itemMenu(x) }))));
    if (plex.shows.length) rows.push(row(t('row.shows'), plex.shows.map((i) => posterCard(i, { onActivate: openDetails, onMenu: (x) => itemMenu(x) }))));
    if (plex.episodes.length) rows.push(row(t('row.searchEpisodes'), plex.episodes.map((i) => landscapeCard(i, { onActivate: (x) => playItem(x, x.viewOffset), onMenu: (x) => itemMenu(x) }))));
    if (apps.length) rows.push(row(t('row.searchApps'), apps.map((a) => appCard(a, { onActivate: launch }))));
    for (const [i, r] of rows.entries()) {
      // Section-level overrides only run at the row's edge: left of the first card returns to the keyboard
      r._nav = { left: () => (focus.set(osk.grid._mem || focus.items(osk.grid)[0]), true), up: i === 0 ? () => true : null };
      r.addEventListener('tvfocus', (e) => router.setBackdropSoon(e.target._item?.art || null));
    }
    results.replaceChildren(...(rows.length ? rows : [h('div', { class: 'hint' }, t('search.none', { q: query }))]));
  }, 350);

  router.pushPage(page, {
    onKey: (e) => {
      if (!typing(e, field)) return false;
      runSearch();
      return true;
    },
    onBack: () => {
      router.setBackdrop(null);
      router.popPage();
    },
  });
}
