// Movies / Shows tabs and the Library tab.
import { h } from '../dom.js';
import { t } from '../i18n.js';
import * as data from '../data.js';
import * as router from '../router.js';
import { row, skeletonRow, libraryCard } from '../components/cards.js';
import { hero } from '../components/hero.js';
import { mediaRow, openDetails, offlineNotice, emptyNotice } from '../components/media.js';

function librariesRow(sections) {
  const cards = sections.map((s) => libraryCard(s, (section) => router.open('section', section)));
  const section = row(t('row.libraries'), cards, { kind: 'libraries' });
  section.addEventListener('tvfocus', (e) => router.setBackdropSoon(null));
  return section;
}

export function renderMediaTab(type) {
  return async (container, ctx) => {
    container.append(h('section', { class: 'hero-sec' }, h('div', { class: 'hero' })), skeletonRow('poster'), skeletonRow('poster'));
    const tab = await data.plexTab(type, ctx.refresh).catch(() => ({ connected: false }));
    if (ctx.stale()) return;
    container.replaceChildren();

    if (!tab.connected) return container.append(offlineNotice());
    if (tab.hero?.length) container.append(hero(tab.hero, { onOpen: openDetails }));
    for (const plexRow of tab.rows) container.append(mediaRow(plexRow, { rerender: ctx.rerender }));
    if (tab.sections?.length) container.append(librariesRow(tab.sections));
    if (!tab.rows.length && !tab.sections?.length) container.append(emptyNotice(t('library.empty')));
  };
}

export async function renderLibrary(container, ctx) {
  container.append(skeletonRow('landscape'), skeletonRow('landscape'));
  const [onDeck, sections] = await Promise.all([
    data.plexOnDeck().catch(() => []),
    data.plexSections().catch(() => null),
  ]);
  if (ctx.stale()) return;
  container.replaceChildren();

  if (!sections) return container.append(offlineNotice());
  if (onDeck.length) container.append(mediaRow({ kind: 'continue', items: onDeck }, { rerender: ctx.rerender }));
  const visible = sections.filter((s) => !s.hidden);
  if (visible.length) container.append(librariesRow(visible));
  else container.append(emptyNotice(t('library.empty')));
}
