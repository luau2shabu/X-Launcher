// "Who's watching?" profile picker. Each profile keeps its own Your apps row and can be
// signed in with Google (name and photo come from the Google account).
import { h, icon, toast, initials, sleep } from '../dom.js';
import { t } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as overlay from '../components/overlay.js';

const COLORS = ['#3ba3cc', '#f28b82', '#fdd663', '#81c995', '#c58af9', '#78d9ec', '#fcad70', '#ff8bcb'];

/** Round avatar: the Google photo when signed in, otherwise the first letter on the profile color. */
export function avatar(profile) {
  const letter = h('div', { class: 'avatar', style: { background: profile.color } }, initials(profile.name));
  if (!profile.picture) return letter;
  const photo = h('img', { src: profile.picture, alt: '' });
  photo.addEventListener('error', () => wrap.replaceWith(letter), { once: true });
  const wrap = h('div', { class: 'avatar photo' }, photo);
  return wrap;
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
    }, avatar(profile), h('span', null, profile.name), profile.email ? h('small', null, profile.email) : null));
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

  async function createProfile(name) {
    const profiles = structuredClone(data.state.settings.profiles);
    const id = Math.random().toString(36).slice(2, 10);
    profiles.push({ id, name, color: COLORS[profiles.length % COLORS.length], favorites: [...data.activeProfile().favorites] });
    await data.updateSettings({ profiles });
    return id;
  }

  async function removeProfile(id) {
    await data.updateSettings({ profiles: data.state.settings.profiles.filter((p) => p.id !== id) });
  }

  async function add() {
    const choice = await overlay.menu({
      title: t('profiles.add'),
      items: [
        { label: t('google.signIn'), hint: t('google.signInHint'), icon: 'person', google: true },
        { label: t('profiles.enterName'), icon: 'edit', google: false },
      ],
    });
    if (!choice) return;
    if (choice.google) {
      const id = await createProfile('Google');
      const ok = await googleSignIn(id);
      if (!ok) await removeProfile(id);
      render(ok ? id : undefined);
      if (ok) app.rerender();
      return;
    }
    const name = await overlay.prompt({ title: t('profiles.add'), text: t('profiles.name'), layout: 'th', allowThai: true });
    if (!name) return;
    render(await createProfile(name));
  }

  async function manage(profile) {
    const items = [];
    if (profile.email) {
      items.push({
        label: t('google.signOut'), hint: profile.email, icon: 'exit',
        action: async () => {
          data.state.settings = await call('google.signOut', { profile: profile.id });
          render(profile.id);
          app.rerender();
        },
      });
    } else {
      items.push({
        label: t('google.signIn'), hint: t('google.signInHint'), icon: 'person',
        action: async () => {
          if (await googleSignIn(profile.id)) {
            render(profile.id);
            app.rerender();
          }
        },
      });
    }
    items.push({
      label: t('profiles.rename'), icon: 'edit',
      action: async () => {
        const name = await overlay.prompt({ title: t('profiles.rename'), value: profile.name, layout: 'th', allowThai: true });
        if (!name) return;
        const profiles = data.state.settings.profiles.map((p) => (p.id === profile.id ? { ...p, name } : p));
        await data.updateSettings({ profiles });
        render(profile.id);
        app.rerender();
      },
    });
    if (data.state.settings.profiles.length > 1) {
      items.push({
        label: t('profiles.delete'), icon: 'delete', danger: true,
        action: async () => {
          const ok = await overlay.confirm(t('profiles.delete'), profile.name, { danger: true });
          if (!ok) return;
          await removeProfile(profile.id);
          render();
          app.rerender();
        },
      });
    }
    await overlay.menu({ title: profile.name, image: profile.picture, items });
  }

  render();
}

/**
 * Google device sign-in: shows a QR code and a code to enter at google.com/device on a phone,
 * then waits for approval. Resolves true when the profile got the Google name and photo.
 */
export async function googleSignIn(profileId) {
  const status = await call('google.status').catch(() => ({ configured: false }));
  if (!status.configured) {
    await overlay.menu({ title: t('google.notSetUp'), items: [{ label: t('google.notSetUpText'), icon: 'info' }] });
    return false;
  }

  let start;
  try {
    start = await call('google.start', { profile: profileId });
  } catch (err) {
    toast(t('common.error', { msg: err.message }), 6000);
    return false;
  }

  let cancelled = false;
  const statusLine = h('div', { class: 'google-status' }, t('google.waiting'));
  const box = h('div', { class: 'dialog google' },
    h('h2', null, t('google.title')),
    h('div', { class: 'google-body' },
      h('img', { class: 'qr', src: start.qr, alt: '' }),
      h('div', { class: 'google-steps' },
        h('p', null, t('google.step1')),
        h('div', { class: 'google-url' }, start.verificationUrl.replace(/^https?:\/\//, '')),
        h('p', null, t('google.step2')),
        h('div', { class: 'google-code' }, start.userCode),
        statusLine)),
    h('div', { dataset: { nav: 'list' } },
      h('div', { class: 'item focusable', _activate: () => { cancelled = true; close(); } }, icon('back'), h('span', { class: 'label' }, t('common.cancel')))));
  const close = overlay.open(box, { onBack: (c) => { cancelled = true; c(); } });

  let interval = start.interval || 5;
  const deadline = Date.now() + start.expiresIn * 1000;
  while (!cancelled && Date.now() < deadline) {
    await sleep(interval * 1000);
    if (cancelled) break;
    try {
      const result = await call('google.poll', { session: start.session });
      if (result.interval) interval = result.interval;
      if (result.status === 'done') {
        data.state.settings = result.settings;
        close();
        const profile = data.state.settings.profiles.find((p) => p.id === profileId);
        toast(t('google.signedIn', { name: profile?.name || '' }));
        return true;
      }
      if (result.status === 'denied' || result.status === 'expired') {
        statusLine.textContent = t(result.status === 'denied' ? 'google.denied' : 'google.expired');
        await sleep(2500);
        break;
      }
    } catch (err) {
      statusLine.textContent = t('common.error', { msg: err.message });
      await sleep(3000);
      break;
    }
  }
  close();
  return false;
}
