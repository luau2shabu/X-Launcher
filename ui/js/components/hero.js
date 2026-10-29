// The big rotating banner at the top of For you / Movies / Shows.
import { h, icon, clear } from '../dom.js';
import { t } from '../i18n.js';
import * as router from '../router.js';
import { metaLine } from './media.js';
import { mark } from '../brand.js';

const ROTATE_MS = 9000;
let paused = false;

/** Ambient mode and other apps in front pause every hero carousel. */
export function pauseHeroes(value) {
  paused = value;
}

export function hero(items, { onOpen }) {
  let index = 0;
  const slides = items.map((item) => h('div', { class: 'slide', style: { backgroundImage: `url("${item.art}")` } }));
  const info = h('div', { class: 'info' });
  const dots = h('div', { class: 'dots' }, items.map(() => h('i')));

  const card = h('div', {
    class: 'hero focusable',
    _activate: () => onOpen(items[index]),
    _nav: {
      left: () => (items.length > 1 ? (go(index - 1), true) : false),
      right: () => (items.length > 1 ? (go(index + 1), true) : false),
    },
  }, slides, info, dots);
  card.addEventListener('tvfocus', () => router.setBackdrop(null));

  function go(n) {
    index = (n + items.length) % items.length;
    slides.forEach((s, k) => s.classList.toggle('on', k === index));
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === index));
    const item = items[index];
    clear(info).append(
      h('div', { class: 'eyebrow' }, t('hero.new', { name: item.serverName || 'Plex' })),
      h('h1', null, item.title),
      h('div', { class: 'meta' }, metaLine(item)),
      item.summary ? h('p', { class: 'summary' }, item.summary) : null,
      h('div', { class: 'cta' }, icon('info'), t('hero.cta')),
    );
    restart();
  }

  let timer;
  function restart() {
    clearInterval(timer);
    timer = setInterval(() => {
      if (!card.isConnected) return clearInterval(timer);
      if (!paused && !document.hidden && card.offsetParent) go(index + 1);
    }, ROTATE_MS);
  }

  go(0);
  return h('section', { class: 'hero-sec', dataset: { nav: 'row', scroll: 'top' } }, card);
}

/** Shown when Plex has nothing to feature: a branded welcome banner that jumps to the apps row. */
export function welcomeHero({ onActivate }) {
  const card = h('div', { class: 'hero welcome focusable', _activate: onActivate },
    mark(),
    h('div', { class: 'info' },
      h('h1', null, t('hero.welcomeTitle')),
      h('p', { class: 'summary', style: { WebkitLineClamp: 3 } }, t('hero.welcomeText'))));
  card.addEventListener('tvfocus', () => router.setBackdrop(null));
  return h('section', { class: 'hero-sec', dataset: { nav: 'row', scroll: 'top' } }, card);
}
