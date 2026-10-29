// Cards and rows. Every card is a .focusable with _activate (OK) and optional _menu (long-press OK).
import { h, icon, img, hashColor, initials } from '../dom.js';
import { t } from '../i18n.js';

const BRAND_COLORS = {
  youtube: '#ff0033', netflix: '#e50914', 'prime video': '#00a8e1', 'hbo max': '#5822b4', max: '#002be7',
  'disney+': '#0b3d91', spotify: '#1db954', plex: '#e5a00d', 'plex htpc': '#1f1f1f', kodi: '#17b2e7', steam: '#1b2838',
};

export function row(title, cards, opts = {}) {
  const section = h('section', { class: `row ${opts.class || ''}`, dataset: { nav: 'row', kind: opts.kind || '' } },
    title ? h('h2', { class: 'row-title' }, title) : null,
    h('div', { class: 'viewport' }, h('div', { class: 'track' }, cards)),
  );
  return section;
}

export function skeletonRow(kind = 'landscape', count = 7) {
  return row(' ', Array.from({ length: count }, () => h('div', { class: `card ${kind}` })), { class: 'skeleton' });
}

// ---------------------------------------------------------------- apps

/** App tile: large icon on a neutral tile with the name always visible underneath. */
export function appCard(app, { onActivate, onMenu, hidden } = {}) {
  const card = h('div', {
    class: `card app focusable ${hidden ? 'hidden-app' : ''}`,
    dataset: { id: app.id },
    _activate: () => onActivate?.(app, card),
    _menu: onMenu ? () => onMenu(app, card) : null,
  },
  h('div', { class: 'frame' },
    appIcon(app),
    h('span', { class: 'app-name' }, app.name)));
  return card;
}

/** The app's icon, or (for websites without one) a colored rounded square with its first letter. */
export function appIcon(app, cls = 'app-icon') {
  const letter = h('span', { class: `${cls} letter`, style: { background: BRAND_COLORS[app.name.toLowerCase()] || hashColor(app.name, 50, 38) } }, initials(app.name));
  return app.icon ? img(app.icon, cls, letter) : letter;
}

export function actionCard(label, iconName, onActivate, kind = 'app add') {
  return h('div', { class: `card ${kind} focusable`, _activate: onActivate },
    h('div', { class: 'frame' }, h('span', { class: 'app-icon glyph' }, icon(iconName)), h('span', { class: 'app-name' }, label)));
}

// ---------------------------------------------------------------- media

function fallback(title) {
  return h('div', { class: 'fallback' }, title);
}

export function landscapeCard(item, { onActivate, onMenu, showProgress = true } = {}) {
  const card = h('div', {
    class: 'card landscape focusable',
    _item: item,
    _activate: () => onActivate?.(item, card),
    _menu: onMenu ? () => onMenu(item, card) : null,
  },
  h('div', { class: 'frame' },
    img(item.landscape || item.art, 'art', fallback(item.title)),
    h('div', { class: 'shade' }),
    h('div', { class: 'label' }, h('b', null, item.title), item.subtitle ? h('span', null, item.subtitle) : null),
    showProgress && item.progress > 0.01 ? h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round(item.progress * 100)}%` } })) : null,
  ));
  return card;
}

export function posterCard(item, { onActivate, onMenu } = {}) {
  const card = h('div', {
    class: 'card poster focusable',
    _item: item,
    _activate: () => onActivate?.(item, card),
    _menu: onMenu ? () => onMenu(item, card) : null,
  },
  h('div', { class: 'frame' },
    img(item.poster, 'art', fallback(item.title)),
    item.watched ? h('span', { class: 'watched' }, icon('check')) : null,
    item.progress > 0.01 ? h('div', { class: 'progress' }, h('i', { style: { width: `${Math.round(item.progress * 100)}%` } })) : null,
  ),
  h('span', { class: 'cap' }, item.subtitle && item.type !== 'movie' ? `${item.title} · ${item.subtitle}` : item.title));
  return card;
}

export function libraryCard(section, onActivate) {
  return h('div', { class: 'card library focusable', _activate: () => onActivate(section) },
    h('div', { class: 'frame' },
      img(section.art, 'art', h('div', { class: 'fallback' })),
      h('div', { class: 'shade' }),
      h('div', { class: 'label' }, h('b', null, section.title), h('span', null, section.serverName)),
    ));
}

export function badgeList(badges) {
  return (badges || []).map((b) => h('span', { class: 'badge' }, b));
}

export function rowTitle(row) {
  switch (row.kind) {
    case 'continue': return t('row.continue');
    case 'picks': return t('row.picks');
    case 'recent': return t('row.recent', { name: row.title });
    case 'recentMovies': return t('row.recentMovies');
    case 'recentShows': return t('row.recentShows');
    case 'related': return t('row.related');
    default: return row.title || '';
  }
}
