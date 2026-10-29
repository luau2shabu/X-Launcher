// "Who's watching?" profile picker.
// The admin profile is the Windows user (name and photo from the Windows account).
// Local profiles are "standard" (e.g. Mom) or "kids" (limited by parental controls).
import { h, icon, toast, initials } from '../dom.js';
import { t } from '../i18n.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as overlay from '../components/overlay.js';
import { requirePin, setPin } from '../components/pin.js';
import { call } from '../bridge.js';

const COLORS = ['#3ba3cc', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#78d9ec', '#fcad70', '#ff8bcb'];

/** Round avatar: the Windows account photo for the admin, otherwise the first letter on the profile color. */
export function avatar(profile) {
  const letter = h('div', { class: 'avatar', style: { background: profile.color } }, initials(profile.name));
  let el = letter;
  if (profile.picture) {
    const photo = h('img', { src: profile.picture, alt: '' });
    el = h('div', { class: 'avatar photo' }, photo);
    photo.addEventListener('error', () => el.replaceWith(letter), { once: true });
  }
  return profile.kind === 'kids' ? h('div', { class: 'avatar-wrap' }, el, h('span', { class: 'kids-badge' }, 'KIDS')) : el;
}

const kindLabel = (profile) => t(`profiles.kind.${profile.kind}`);

export function openProfiles(app) {
  const track = h('div', { class: 'track' });
  const screen = h('div', { class: 'profiles' },
    h('h1', null, t('profiles.title')),
    h('section', { dataset: { nav: 'row' } }, track));
  const close = overlay.open(screen, { scrim: false });

  function render(focusId) {
    const settings = data.state.settings;
    const tiles = settings.profiles.map((profile) => h('div', {
      class: `profile-tile focusable ${profile.id === settings.activeProfileId ? 'current' : ''}`,
      dataset: { id: profile.id },
      _activate: () => choose(profile),
      _menu: () => manage(profile),
    }, avatar(profile), h('span', null, profile.name), h('small', null, kindLabel(profile))));
    // Children cannot create profiles
    if (!data.isKids()) {
      tiles.push(h('div', { class: 'profile-tile focusable', _activate: add },
        h('div', { class: 'avatar add' }, icon('add')), h('span', null, t('profiles.add'))));
    }
    track.replaceChildren(...tiles);
    focus.refocus(tiles.find((tile) => tile.dataset.id === (focusId || settings.activeProfileId)));
  }

  async function choose(profile) {
    if (profile.id === data.state.settings.activeProfileId) return close();
    // Leaving a kids profile needs the parent PIN
    let pin;
    if (data.isKids()) {
      pin = await requirePin(t('pin.toSwitch'));
      if (pin == null) return;
    }
    close();
    await data.updateSettings({ activeProfileId: profile.id }, pin);
    toast(t('profiles.switched', { name: profile.name }));
    app.rerender();
  }

  async function add() {
    const kind = await overlay.menu({
      title: t('profiles.add'),
      items: [
        { label: t('profiles.kind.standard'), hint: t('profiles.standardHint'), icon: 'person', kind: 'standard' },
        { label: t('profiles.kind.kids'), hint: t('profiles.kidsHint'), icon: 'tv', kind: 'kids' },
      ],
    });
    if (!kind) return;
    // Kids profiles are only safe with a parent PIN
    if (kind.kind === 'kids' && !(await call('pin.status')).set) {
      toast(t('pin.needed'));
      if (!(await setPin())) return;
    }
    const name = await overlay.prompt({ title: t('profiles.add'), text: t('profiles.name'), layout: 'th', allowThai: true });
    if (!name) return;
    const profiles = structuredClone(data.state.settings.profiles);
    const id = Math.random().toString(36).slice(2, 10);
    profiles.push({
      id, name, kind: kind.kind, color: COLORS[profiles.length % COLORS.length], favorites: [...data.activeProfile().favorites],
      rules: kind.kind === 'kids' ? { allowedApps: [], allowedSections: [], maxRating: 'child', dailyMinutes: 90 } : null,
    });
    await data.updateSettings({ profiles });
    if (kind.kind === 'kids') toast(t('profiles.kidsCreated'), 6000);
    render(id);
  }

  async function manage(profile) {
    if (data.isKids()) return; // children cannot edit profiles
    const items = [];
    if (profile.kind === 'admin') {
      items.push({ label: t('profiles.fromWindows'), hint: t('profiles.fromWindowsHint'), icon: 'info' });
    } else {
      items.push({
        label: t('profiles.rename'), icon: 'edit',
        action: async () => {
          const name = await overlay.prompt({ title: t('profiles.rename'), value: profile.name, layout: 'th', allowThai: true });
          if (!name) return;
          await data.updateSettings({ profiles: data.state.settings.profiles.map((p) => (p.id === profile.id ? { ...p, name } : p)) });
          render(profile.id);
          app.rerender();
        },
      });
      items.push({
        label: t('profiles.delete'), icon: 'delete', danger: true,
        action: async () => {
          if (!(await overlay.confirm(t('profiles.delete'), profile.name, { danger: true }))) return;
          await data.updateSettings({ profiles: data.state.settings.profiles.filter((p) => p.id !== profile.id) });
          render();
          app.rerender();
        },
      });
    }
    await overlay.menu({ title: profile.name, image: profile.picture, items });
  }

  render();
}
