// "For you": hero, Your apps, Continue watching, Top picks, recently added per library.
import { h } from '../dom.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import { skeletonRow } from '../components/cards.js';
import { hero, welcomeHero } from '../components/hero.js';
import { mediaRow, openDetails } from '../components/media.js';
import { favoritesRow } from './apps.js';

const NOT_CONNECTED = { connected: false, hero: [], rows: [] };

export async function renderHome(container, ctx) {
  container.append(h('section', { class: 'hero-sec' }, h('div', { class: 'hero' })), skeletonRow('app'), skeletonRow('landscape'));

  const [favorites, plex] = await Promise.all([
    data.favoriteApps(),
    data.plexHome(ctx.refresh).catch(() => NOT_CONNECTED),
  ]);
  if (ctx.stale()) return;
  container.replaceChildren();

  const apps = favoritesRow(favorites, { rerender: ctx.rerender, onEmpty: () => ctx.selectTab('apps') });
  container.append(
    plex.hero?.length
      ? hero(plex.hero, { onOpen: openDetails })
      : welcomeHero({ onActivate: () => focus.set(focus.items(apps)[0]) }),
    apps,
  );
  for (const plexRow of plex.rows || []) container.append(mediaRow(plexRow, { rerender: ctx.rerender }));
}
