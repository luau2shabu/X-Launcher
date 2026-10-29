// "Who's watching?" profile picker. Each profile keeps its own Your apps row.
import { h, icon, toast, initials } from '../dom.js';
import { t } from '../i18n.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as overlay from '../components/overlay.js';

const COLORS = ['#3ba3cc', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#78d9ec', '#fcad70', '#ff8bcb'];

export function avatar(profile, size) {
  return h('div', { class: 'avatar', style: { background: profile.color, ...(size ? { width: size, height: size } : null) } }, initials(profile.name));
}

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
    }, avatar(profile), h('span', null, profile.name)));
    tiles.push(h('div', { class: 'profile-tile focusable', _activate: add },
      h('div', { class: 'avatar add' }, icon('add')), h('span', null, t('profiles.add'))));
    track.replaceChildren(...tiles);
    focus.refocus(tiles.find((tile) => tile.dataset.id === (focusId || settings.activeProfileId)));
  }

  async function choose(profile) {
    close();
    if (profile.id === data.state.settings.activeProfileId) return;
    await data.updateSettings({ activeProfileId: profile.id });
    toast(t('profiles.switched', { name: profile.name }));
    app.rerender();
  }

  async function add() {
    const name = await overlay.prompt({ title: t('profiles.add'), text: t('profiles.name'), layout: 'th', allowThai: true });
    if (!name) return;
    const profiles = structuredClone(data.state.settings.profiles);
    const id = Math.random().toString(36).slice(2, 10);
    profiles.push({ id, name, color: COLORS[profiles.length % COLORS.length], favorites: [...data.activeProfile().favorites] });
    await data.updateSettings({ profiles });
    render(id);
  }

  async function manage(profile) {
    const items = [{
      label: t('profiles.rename'), icon: 'edit',
      action: async () => {
        const name = await overlay.prompt({ title: t('profiles.rename'), value: profile.name, layout: 'th', allowThai: true });
        if (!name) return;
        const profiles = data.state.settings.profiles.map((p) => (p.id === profile.id ? { ...p, name } : p));
        await data.updateSettings({ profiles });
        render(profile.id);
        app.rerender();
      },
    }];
    if (data.state.settings.profiles.length > 1) {
      items.push({
        label: t('profiles.delete'), icon: 'delete', danger: true,
        action: async () => {
          const ok = await overlay.confirm(t('profiles.delete'), profile.name, { danger: true });
          if (!ok) return;
          const profiles = data.state.settings.profiles.filter((p) => p.id !== profile.id);
          await data.updateSettings({ profiles });
          render();
          app.rerender();
        },
      });
    }
    await overlay.menu({ title: profile.name, items });
  }

  render();
}
