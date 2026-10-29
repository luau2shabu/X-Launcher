// A whole Plex library as a poster grid, with sort chips and paging.
import { h } from '../dom.js';
import { t } from '../i18n.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as router from '../router.js';
import { posterCard } from '../components/cards.js';
import { openDetails, itemMenu } from '../components/media.js';

const PAGE = 60;
const SORTS = [
  ['titleSort', 'sort.title'],
  ['addedAt:desc', 'sort.added'],
  ['year:desc', 'sort.year'],
  ['audienceRating:desc', 'sort.rating'],
];

export function openSection(section) {
  let sort = 'titleSort';
  let unwatched = false;
  let total = 0;
  let loaded = 0;
  let loading = false;
  let generation = 0;

  const count = h('span');
  const chips = h('div', { class: 'chips', dataset: { nav: 'row', scroll: 'top' } });
  const grid = h('div', { class: 'grid posters', dataset: { nav: 'grid' } });
  const page = h('div', { class: 'page' },
    h('div', { class: 'scroller' },
      h('header', { class: 'topbar' }, h('div', { class: 'section-head', style: { padding: 0 } }, h('h2', { style: { fontSize: '2rem' } }, section.title), count)),
      chips,
      h('div', { class: 'grid-sec' }, grid)));

  function renderChips() {
    chips.replaceChildren(
      ...SORTS.map(([value, label]) => h('div', {
        class: `chip focusable ${sort === value ? 'selected' : ''}`,
        _activate: () => { if (sort !== value) { sort = value; reload(); } },
      }, t(label))),
      h('div', {
        class: `chip focusable ${unwatched ? 'selected' : ''}`,
        _activate: () => { unwatched = !unwatched; reload(); },
      }, t('filter.unwatched')),
    );
  }

  async function loadMore() {
    if (loading || (loaded >= total && loaded > 0)) return;
    loading = true;
    const mine = generation;
    try {
      const result = await data.plexAll({ server: section.server, section: section.key, start: loaded, size: PAGE, sort, unwatched });
      if (mine !== generation) return;
      total = result.total;
      loaded += result.items.length;
      count.textContent = t('library.items', { n: total.toLocaleString() });
      grid.append(...result.items.map((item) => posterCard(item, { onActivate: openDetails, onMenu: (i) => itemMenu(i) })));
      if (loaded === result.items.length) focus.refocus();
    } finally {
      loading = false;
    }
  }

  // Called from a chip, so keep focus on the chip at the same position after re-rendering them
  function reload() {
    const chipIndex = [...chips.children].findIndex((c) => c.classList.contains('focused'));
    generation++;
    loaded = 0;
    total = 0;
    grid.replaceChildren();
    grid._mem = null;
    renderChips();
    focus.refocus(chips.children[Math.max(0, chipIndex)]);
    loadMore();
  }

  // Load the next page when focus reaches the last two lines
  grid.addEventListener('tvfocus', (e) => {
    router.setBackdropSoon(e.target._item?.art || null);
    const cards = focus.items(grid);
    if (cards.indexOf(e.target) > cards.length - 16) loadMore();
  });

  renderChips();
  router.pushPage(page);
  loadMore();
}
