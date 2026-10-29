// App shell: top bar + tabs page, global keys (remote, keyboard, gamepad, air mouse), Home, idle → ambient.
import { h, icon, debounce, toast } from './dom.js';
import { t, setLang, formatClock } from './i18n.js';
import { on, call, isMock } from './bridge.js';
import * as data from './data.js';
import * as focus from './focus.js';
import * as router from './router.js';
import * as overlay from './components/overlay.js';
import { renderHome } from './views/home.js';
import { renderApps } from './views/apps.js';
import { renderMediaTab, renderLibrary } from './views/media-tabs.js';
import { openSection } from './views/section.js';
import { openItemDetails } from './views/details.js';
import { openSearch } from './views/search.js';
import { openSettings } from './views/settings.js';
import { openProfiles, avatar } from './views/profiles.js';
import { startAmbient, stopAmbient, isAmbientActive } from './views/ambient.js';
import { logo, showSplash } from './brand.js';
import { requirePin } from './components/pin.js';

const TABS = [
  ['home', 'tab.home', renderHome],
  ['movies', 'tab.movies', renderMediaTab('movie')],
  ['shows', 'tab.shows', renderMediaTab('show')],
  ['apps', 'tab.apps', renderApps],
  ['library', 'tab.library', renderLibrary],
];

const shell = {
  tab: 'home',
  generation: 0,
  topbar: null,
  content: null,
  page: null,
  hostFocused: true,
  lastInput: Date.now(),
  awaySince: 0,
};

// Callbacks the settings drawer and profile picker use
const app = {
  // Rebuild the top bar too: the avatar and kids time change with profile switches
  rerender: () => {
    buildTopbar();
    renderTab(shell.tab, { keepFocus: true });
  },
  setLanguage: async (lang) => {
    await data.updateSettings({ language: lang });
    setLang(lang);
    buildTopbar();
    renderTab(shell.tab, { keepFocus: true });
  },
  openProfiles: () => openProfiles(app),
  startAmbient: () => startAmbient(),
  showHiddenApps: () => {
    data.state.showHiddenApps = true;
    selectTab('apps', { focusContent: true });
  },
};

// ---------------------------------------------------------------- tabs page

function buildPage() {
  shell.topbar = h('header', { class: 'topbar', dataset: { nav: 'row', scroll: 'top' } });
  shell.content = h('div', { class: 'tab-content' });
  shell.page = h('div', { class: 'page' }, h('div', { class: 'scroller' }, shell.topbar, shell.content));
  buildTopbar();
  router.pushPage(shell.page, { onBack: tabsBack, focus: false });
}

function buildTopbar() {
  const wasFocused = shell.topbar.contains(focus.focused()) ? focus.focused().dataset.tab || focus.focused().dataset.role : null;
  const tabEls = TABS.map(([name, label]) => {
    const el = h('div', { class: `tab focusable ${name === shell.tab ? 'active' : ''}`, dataset: { tab: name }, _activate: () => enterContent() }, t(label));
    el.addEventListener('tvfocus', () => switchSoon(name));
    return el;
  });
  const clock = h('div', { class: 'clock' }, formatClock());
  shell.clock = clock;
  shell.kidsChip = h('div', { class: 'kids-chip', hidden: true });
  shell.topbar.replaceChildren(
    logo(),
    h('div', { class: 'round-btn focusable', dataset: { role: 'search' }, title: t('tab.search'), _activate: openSearch }, icon('search')),
    ...tabEls,
    h('div', { class: 'spacer' }),
    shell.kidsChip,
    clock,
    h('div', { class: 'round-btn focusable', dataset: { role: 'settings' }, _activate: () => openSettings(app) }, icon('settings')),
    h('div', { class: 'round-btn avatar-btn focusable', dataset: { role: 'profile' }, _activate: () => openProfiles(app) }, avatar(data.activeProfile())),
  );
  if (wasFocused) focus.set(shell.topbar.querySelector(`[data-tab="${wasFocused}"], [data-role="${wasFocused}"]`));
  refreshKids();
}

// ---------------------------------------------------------------- kids screen time

function refreshKids() {
  call('kids.status').then(updateKids).catch(() => {});
}

function updateKids(status) {
  if (!shell.kidsChip) return;
  const limited = status && status.limit > 0;
  shell.kidsChip.hidden = !limited;
  if (limited) shell.kidsChip.textContent = t('kids.left', { n: status.remaining });
  if (status?.timeUp) showTimeUp();
}

let timeUpOpen = false;
function showTimeUp() {
  if (timeUpOpen) return;
  timeUpOpen = true;
  stopAmbient();
  let close;
  const done = () => { timeUpOpen = false; close(); };
  const box = h('div', { class: 'timeup' },
    icon('timer', 'icon big'),
    h('h1', null, t('kids.timeUp')),
    h('p', null, t('kids.timeUpText')),
    h('div', { dataset: { nav: 'list' }, class: 'timeup-actions' },
      h('div', { class: 'item focusable', _activate: async () => {
        const pin = await requirePin(t('pin.toAddTime'));
        if (pin == null) return;
        data.state.settings = await call('kids.addTime', { profile: data.activeProfile().id, minutes: 30, pin });
        done();
        refreshKids();
      } }, icon('add'), h('span', { class: 'label' }, t('kids.moreTime'))),
      h('div', { class: 'item focusable', _activate: () => { done(); openProfiles(app); } }, icon('person'), h('span', { class: 'label' }, t('kids.switchUser')))));
  // Back does nothing here: only a parent can unlock
  close = overlay.open(box, { onBack: () => {} });
}

on('kids', updateKids);

const tabEl = (name) => shell.topbar.querySelector(`[data-tab="${name}"]`);

// Like Google TV, moving focus onto a tab switches to it after a short pause
const switchSoon = debounce((name) => {
  if (focus.focused() === tabEl(name) && name !== shell.tab) selectTab(name);
}, 260);

function selectTab(name, { focusContent = false } = {}) {
  shell.tab = name;
  shell.topbar.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
  router.setBackdrop(null);
  renderTab(name, { focusContent });
}

async function renderTab(name, { refresh = false, keepFocus = false, focusContent = false } = {}) {
  const mine = ++shell.generation;
  const path = keepFocus ? focusPath() : null;
  const container = h('div');
  shell.content.replaceChildren(container);
  const [, , render] = TABS.find(([n]) => n === name);
  const ctx = {
    refresh,
    stale: () => mine !== shell.generation,
    rerender: () => renderTab(shell.tab, { keepFocus: true }),
    selectTab: (tab) => selectTab(tab, { focusContent: true }),
  };
  try {
    await render(container, ctx);
  } catch (err) {
    console.error(err);
    if (!ctx.stale()) toast(t('common.error', { msg: err.message }));
  }
  if (ctx.stale()) return;
  if (path) restoreFocus(path);
  else if (focusContent) enterContent();
  else if (!shell.topbar.contains(focus.focused()) && !overlay.isOpen() && router.depth() === 1) focus.set(tabEl(name));
}

function enterContent() {
  const first = focus.firstIn(shell.content);
  if (first) focus.set(first);
}

function tabsBack() {
  if (shell.topbar.contains(focus.focused())) {
    if (shell.tab !== 'home') {
      selectTab('home');
      focus.set(tabEl('home'));
    }
    return;
  }
  focus.set(tabEl(shell.tab));
}

// Remember focus as (section index, item index) so a re-render lands in the same spot
function focusPath() {
  const el = focus.focused();
  if (!el || !shell.content.contains(el)) return null;
  const sections = focus.sections(shell.content);
  const section = focus.sectionOf(el);
  return { section: sections.indexOf(section), item: focus.items(section).indexOf(el), scroll: shell.page.firstChild.scrollTop };
}

function restoreFocus(path) {
  if (router.depth() > 1 || overlay.isOpen()) return;
  const sections = focus.sections(shell.content);
  const section = sections[Math.min(path.section, sections.length - 1)];
  if (!section) return focus.set(tabEl(shell.tab));
  const its = focus.items(section);
  focus.set(its[Math.min(path.item, its.length - 1)] || its[0]);
}

// ---------------------------------------------------------------- Home button

function goHome() {
  stopAmbient();
  closeOverlays();
  router.popToRoot();
  if (shell.tab !== 'home') selectTab('home', { focusContent: true });
  else {
    shell.page.firstChild.scrollTo({ top: 0, behavior: 'smooth' });
    enterContent();
  }
}

function closeOverlays() {
  while (overlay.isOpen()) {
    const scope = focus.top();
    if (!scope || scope.root.parentElement?.id !== 'overlay') break;
    if (scope.root.querySelector('.timeup')) break; // the screen-time lock stays until a parent unlocks it
    scope.onBack?.();
    // a pane-based overlay (settings) may need several Backs; give up if it did not close
    if (scope === focus.top()) {
      focus.popScope(scope.root);
      scope.root.remove();
    }
  }
}

// ---------------------------------------------------------------- input

const DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const BACK_KEYS = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back']);
const LONG_PRESS_MS = 550;
let enterTimer = null;
let longPressed = false;

function activate() {
  focus.focused()?._activate?.();
}

function openMenu() {
  focus.focused()?._menu?.();
}

function back() {
  const el = focus.focused();
  if (el?._back && el._back() !== false) return;
  focus.top()?.onBack?.();
}

/** Handles one logical key. Returns true when used. Shared by keyboard and gamepad. */
function handleKey(key, event) {
  noteInput();
  if (isAmbientActive()) {
    stopAmbient();
    return true;
  }
  const scope = focus.top();
  if (event && scope?.onKey && scope.onKey(event)) return true;

  if (DIRS[key]) return focus.move(DIRS[key]) || true;
  if (BACK_KEYS.has(key)) return back(), true;
  if (key === 'ContextMenu' || key === 'Menu') return openMenu(), true;
  if (key === 'BrowserHome' || key === 'Home') return goHome(), true;
  if (key === 'BrowserSearch' || key === 'Search') return openSearch(), true;
  if (key === 'Settings') return openSettings(app), true;
  if (key === 'F5') {
    data.invalidate();
    renderTab(shell.tab, { refresh: true, keepFocus: true });
    return true;
  }
  return false;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'NumpadEnter') {
    e.preventDefault();
    noteInput();
    if (isAmbientActive()) return stopAmbient();
    if (e.repeat) return;
    longPressed = false;
    clearTimeout(enterTimer);
    enterTimer = setTimeout(() => {
      enterTimer = null;
      longPressed = true;
      openMenu();
    }, LONG_PRESS_MS);
    return;
  }
  if (handleKey(e.key, e)) e.preventDefault();
});

document.addEventListener('keyup', (e) => {
  if ((e.key === 'Enter' || e.key === 'NumpadEnter') && enterTimer) {
    clearTimeout(enterTimer);
    enterTimer = null;
    if (!longPressed) activate();
  }
});

// Gamepad keys arrive from the host already mapped
on('key', (key) => {
  if (key === 'Enter') {
    noteInput();
    if (isAmbientActive()) return stopAmbient();
    return activate();
  }
  handleKey(key);
});
on('home', goHome);
on('focus', (focused) => {
  shell.hostFocused = focused;
  if (!focused) {
    shell.awaySince = Date.now();
    return;
  }
  noteInput();
  // Back from an app: refresh Continue watching etc. without moving focus
  if (shell.awaySince && Date.now() - shell.awaySince > 20_000 && router.depth() === 1 && !overlay.isOpen()) {
    data.invalidate('plex');
    renderTab(shell.tab, { keepFocus: true });
  }
  shell.awaySince = 0;
});

// Air mouse: hovering focuses, clicking activates, right click opens the menu
let cursorTimer;
let lastPointer = { x: 0, y: 0 };
document.addEventListener('mousemove', (e) => {
  if (Math.abs(e.clientX - lastPointer.x) + Math.abs(e.clientY - lastPointer.y) < 4) return;
  lastPointer = { x: e.clientX, y: e.clientY };
  if (isAmbientActive()) return stopAmbient();
  noteInput();
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => document.body.classList.add('hide-cursor'), 3000);
  const target = e.target.closest?.('.focusable');
  const scope = focus.top();
  if (target && scope?.root.contains(target) && target !== focus.focused()) focus.set(target, { scroll: false });
});
document.addEventListener('click', (e) => {
  const target = e.target.closest?.('.focusable');
  if (!target || !focus.top()?.root.contains(target)) return;
  focus.set(target, { scroll: false });
  activate();
});
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const target = e.target.closest?.('.focusable');
  if (target && focus.top()?.root.contains(target)) {
    focus.set(target, { scroll: false });
    openMenu();
  }
});

// ---------------------------------------------------------------- idle → ambient, clock

function noteInput() {
  shell.lastInput = Date.now();
}

setInterval(() => {
  if (shell.clock) shell.clock.textContent = formatClock();
  const ambient = data.state.settings?.ambient;
  if (!ambient?.enabled || isAmbientActive() || !shell.hostFocused || document.hidden) return;
  if (Date.now() - shell.lastInput > ambient.idleMinutes * 60_000) startAmbient();
}, 5000);

// ---------------------------------------------------------------- start

router.register('details', openItemDetails);
router.register('section', openSection);

// UI errors go to the host's xlauncher.log
function report(level, message) {
  if (!isMock) call('ui.log', { level, message: String(message).slice(0, 2000) }).catch(() => {});
}
window.addEventListener('error', (e) => report('error', `${e.message} at ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => report('error', e.reason?.stack || e.reason));

async function start() {
  const hideSplash = showSplash();
  // Listing apps first lets the host seed first-run favorites before we read settings
  await data.apps().catch(() => []);
  const settings = await data.loadSettings();
  setLang(settings.language);
  if (isMock) document.title = 'X Launcher (mock)';
  buildPage();
  await renderTab('home', { focusContent: true });
  hideSplash();
  const rows = focus.sections(shell.content).length;
  const apps = (await data.favoriteApps()).length;
  call('ui.ready', { summary: `${rows} sections on Home, ${apps} favorite apps` }).catch(() => {});

  const demo = isMock && new URLSearchParams(location.search).get('demo');
  if (demo) (await import('./demo.js')).run(demo, { selectTab: (tab) => selectTab(tab, { focusContent: true }), rerender: app.rerender });
}

start().catch((err) => {
  console.error(err);
  report('error', err.stack || err.message);
  document.getElementById('splash')?.remove();
  document.body.append(h('div', { class: 'empty' }, h('b', null, 'X Launcher'), err.message));
});
