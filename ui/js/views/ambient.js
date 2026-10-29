// Ambient mode: full-screen slideshow of Plex artwork or the user's photos, with a clock.
import { h } from '../dom.js';
import { formatClock, formatDate } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import { pauseHeroes } from '../components/hero.js';

const SLIDE_MS = 15000;
let active = null;

export const isAmbientActive = () => !!active;

export async function startAmbient() {
  if (active) return;
  const settings = data.state.settings.ambient;
  const slides = await collectSlides(settings.source).catch(() => []);
  if (!slides.length) return;

  const clock = h('b');
  const date = h('span');
  const caption = h('div', { class: 'caption' });
  const shots = [h('div', { class: 'shot' }), h('div', { class: 'shot' })];
  const root = h('div', { class: 'ambient' }, shots, caption,
    settings.showClock ? h('div', { class: 'clock' }, clock, date) : null);
  document.getElementById('overlay').append(root);
  pauseHeroes(true);

  let index = -1;
  let layer = 0;
  const tickClock = () => {
    clock.textContent = formatClock();
    date.textContent = formatDate();
  };
  const next = () => {
    index = (index + 1) % slides.length;
    const slide = slides[index];
    const probe = new Image();
    probe.onload = () => {
      if (active?.root !== root) return;
      shots[layer].classList.remove('on');
      layer = 1 - layer;
      shots[layer].style.backgroundImage = `url("${slide.url}")`;
      // restart the drift animation
      shots[layer].classList.remove('on');
      void shots[layer].offsetWidth;
      shots[layer].classList.add('on');
      caption.textContent = slide.caption || '';
    };
    probe.onerror = () => setTimeout(next, 500);
    probe.src = slide.url;
  };

  tickClock();
  next();
  active = {
    root,
    timers: [setInterval(tickClock, 10_000), setInterval(next, SLIDE_MS)],
  };
}

export function stopAmbient() {
  if (!active) return;
  active.timers.forEach(clearInterval);
  active.root.remove();
  active = null;
  pauseHeroes(false);
}

async function collectSlides(source) {
  if (source === 'folder') {
    const photos = await call('ambient.photos');
    return shuffle(photos.map((url) => ({ url })));
  }
  const home = await data.plexHome();
  const seen = new Set();
  const items = [...(home.hero || []), ...(home.rows || []).flatMap((r) => r.items)];
  return shuffle(items.filter((i) => i.art && !seen.has(i.art) && seen.add(i.art)).map((i) => ({ url: i.art, caption: i.title })));
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
