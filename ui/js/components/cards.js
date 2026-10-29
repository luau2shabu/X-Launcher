// Cards and rows. Every card is a .focusable with _activate (OK) and optional _menu (long-press OK).
import { h, icon, img, hashColor, initials } from '../dom.js';
import { t } from '../i18n.js';

const BRAND_COLORS = {
  youtube: '#ff0033', netflix: '#e50914', 'prime video': '#00a8e1', 'hbo max': '#5822b4', max: '#002be7',
  'disney+': '#0b3d91', spotify: '#1db954', plex: '#e5a00d', 'plex htpc': '#1f1f1f', kodi: '#17b2e7', steam: '#1b2838',
};

const tileColors = new Map();

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

export function appCard(app, { onActivate, onMenu, hidden } = {}) {
  const letter = h('span', { class: 'letter' }, initials(app.name));
  const card = h('div', {
    class: `card app focusable ${hidden ? 'hidden-app' : ''}`,
    dataset: { id: app.id },
    _activate: () => onActivate?.(app, card),
    _menu: onMenu ? () => onMenu(app, card) : null,
  },
  h('div', { class: 'frame' }, app.icon ? img(app.icon, 'logo', letter) : letter),
  app.icon ? null : h('span', { class: 'name-in' }, app.name),
  h('span', { class: 'cap' }, app.name));
  paintTile(card, app);
  return card;
}

export function actionCard(label, iconName, onActivate, kind = 'app add') {
  return h('div', { class: `card ${kind} focusable`, _activate: onActivate },
    h('div', { class: 'frame' }, icon(iconName)),
    h('span', { class: 'cap' }, label));
}

// Tile background: the icon's average color (darkened) so the logo stands out;
// tiles without an icon (websites) use the brand color or a stable color from the name.
function paintTile(card, app) {
  if (!app.icon) return card.style.setProperty('--tile', BRAND_COLORS[app.name.toLowerCase()] || hashColor(app.name, 45, 32));
  if (tileColors.has(app.id)) return card.style.setProperty('--tile', tileColors.get(app.id));
  const probe = new Image();
  probe.crossOrigin = 'anonymous';
  probe.onload = () => {
    const color = averageColor(probe) || hashColor(app.name, 45, 32);
    tileColors.set(app.id, color);
    card.style.setProperty('--tile', color);
  };
  probe.src = app.icon;
}

function averageColor(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 24;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, 24, 24);
    const { data } = ctx.getImageData(0, 0, 24, 24);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return null;
    // Darken so white logos stay readable
    const k = 0.55 / n;
    return `rgb(${Math.round(r * k)} ${Math.round(g * k)} ${Math.round(b * k)})`;
  } catch {
    return null;
  }
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
