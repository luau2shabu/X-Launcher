// Google TV-style settings drawer on the right, with sub-panes.
import { h, icon, toast } from '../dom.js';
import { t, formatClock, formatDate, getLang } from '../i18n.js';
import { call } from '../bridge.js';
import * as data from '../data.js';
import * as focus from '../focus.js';
import * as overlay from '../components/overlay.js';
import { logo } from '../brand.js';
import { requirePin, setPin } from '../components/pin.js';

const IDLE_STEPS = [1, 3, 5, 10, 15, 30, 60];
const LIMIT_STEPS = [0, 30, 60, 90, 120, 180, 240];
const RATING_STEPS = ['young', 'child', 'teen', 'all'];

/**
 * @param {object} app  shell callbacks: setLanguage(lang), rerender(), openProfiles(), startAmbient(), showHiddenApps()
 */
export async function openSettings(app) {
  // On a kids profile, Settings is for parents only
  if (data.isKids()) {
    const pin = await requirePin(t('pin.toSettings'));
    if (pin == null) return;
    data.state.unlockPin = pin;
  }
  const head = h('div', { class: 'drawer-head' });
  const list = h('div', { class: 'list' });
  const drawer = h('div', { class: 'drawer' }, head, list);
  const stack = [];

  const close = overlay.open(drawer, {
    onBack: (closeNow) => {
      if (stack.length > 1) {
        const leaving = stack.pop();
        render(stack[stack.length - 1].returnTo ?? 0, leaving);
      } else {
        data.state.unlockPin = null;
        closeNow();
      }
    },
    focus: false,
  });

  function push(pane) {
    if (stack.length) stack[stack.length - 1].returnTo = currentIndex();
    stack.push(pane);
    render(0);
  }

  function currentIndex() {
    const inner = list.firstElementChild;
    return inner ? focus.items(inner).indexOf(focus.focused()) : 0;
  }

  async function render(index = 0) {
    const pane = stack[stack.length - 1];
    head.replaceChildren(...pane.head());
    const items = await pane.items();
    const inner = h('div', { class: 'list-inner', dataset: { nav: 'list' } }, items.map(itemEl));
    list.replaceChildren(inner);
    const its = focus.items(inner);
    focus.refocus(its[Math.max(0, Math.min(index, its.length - 1))]);
    keepVisible(inner);
  }

  // Re-render the same pane after a change, keeping focus on the same row
  const rerenderPane = () => render(currentIndex());

  function keepVisible(inner) {
    inner.addEventListener('tvfocus', (e) => {
      const listHeight = list.clientHeight;
      const y = e.target.offsetTop;
      const shift = Math.max(0, Math.min(y - listHeight * 0.4, inner.scrollHeight - listHeight));
      inner.style.transform = `translateY(${-shift}px)`;
    });
    focus.focused()?.dispatchEvent(new CustomEvent('tvfocus', { bubbles: true }));
  }

  function itemEl(item) {
    const right = item.toggle != null
      ? h('span', { class: `toggle ${item.toggle ? 'on' : ''}` })
      : item.value != null ? h('span', { class: 'value' }, item.value) : item.next ? icon('chevron') : null;
    return h('div', { class: `item focusable ${item.danger ? 'danger' : ''} ${item.action ? '' : 'info'}`, _activate: item.action },
      icon(item.icon || 'info'),
      h('span', { class: 'label' }, item.label, item.sub ? h('small', null, item.sub) : null),
      right);
  }

  // Pane headers are built on every render so they follow a language change
  const titleHead = (titleKey) => () => [h('div', { class: 'title' }, t(titleKey))];

  // ---------------------------------------------------------------- panes

  const main = {
    head: () => [h('div', { class: 'big-clock' }, formatClock()), h('div', { class: 'date' }, formatDate())],
    items: async () => {
      const [servers, info] = await Promise.all([data.plexServers().catch(() => []), call('system.info').catch(() => null)]);
      const net = info?.network;
      return [
        { icon: 'person', label: t('settings.profile'), value: data.activeProfile().name, action: () => { close(); app.openProfiles(); } },
        {
          icon: 'language', label: t('settings.language'), value: getLang() === 'th' ? 'ไทย' : 'English',
          action: async () => { await app.setLanguage(getLang() === 'th' ? 'en' : 'th'); rerenderPane(); },
        },
        { icon: 'server', label: t('settings.plex'), sub: servers.length ? t('settings.plexServers', { n: servers.length }) : t('settings.plexNone'), next: true, action: () => push(plexPane) },
        { icon: 'apps', label: t('settings.apps'), next: true, action: () => push(appsPane) },
        {
          icon: 'shield', label: t('parental.title'), sub: t('parental.sub'), next: true,
          action: async () => {
            // Only the admin manages children; anyone else needs the parent PIN
            if (!data.isAdmin() && !data.state.unlockPin) {
              const pin = await requirePin(t('pin.toParental'));
              if (pin == null) return;
            }
            push(parentalPane);
          },
        },
        { icon: 'photo', label: t('settings.ambient'), value: data.state.settings.ambient.enabled ? t('settings.on') : t('settings.off'), next: true, action: () => push(ambientPane) },
        { icon: 'display', label: t('settings.display'), sub: t('settings.opensWindows'), action: () => windows('display') },
        { icon: 'hdr', label: t('settings.hdr'), sub: t('settings.opensWindows'), action: () => windows('hdr') },
        { icon: 'volume', label: t('settings.sound'), sub: t('settings.opensWindows'), action: () => windows('sound') },
        {
          icon: net?.type === 'wifi' ? 'wifi' : 'ethernet', label: t('settings.network'),
          sub: net?.connected ? `${net.name} · ${net.speedMbps >= 1000 ? `${net.speedMbps / 1000} Gbps` : `${net.speedMbps} Mbps`}` : t('settings.disconnected'),
          action: () => windows('network'),
        },
        { icon: 'bluetooth', label: t('settings.bluetooth'), sub: t('settings.opensWindows'), action: () => windows('bluetooth') },
        { icon: 'power', label: t('settings.power'), next: true, action: () => push(powerPane) },
        { icon: 'info', label: t('settings.about'), next: true, action: () => push(aboutPane) },
      ];
    },
  };

  const plexPane = {
    head: titleHead('settings.plex'),
    items: async () => {
      const servers = await data.plexServers().catch(() => []);
      const options = data.state.settings.plex;
      return [
        ...servers.map((s) => ({ icon: 'server', label: s.name, sub: t(s.onThisPc ? 'settings.serverThisPc' : s.owned ? 'settings.serverOwned' : 'settings.serverShared') })),
        {
          icon: 'refresh', label: t('settings.plexRefresh'),
          action: async () => {
            data.invalidate('plex');
            await data.plexServers(true).catch(() => []);
            app.rerender();
            rerenderPane();
          },
        },
        {
          icon: 'person', label: t('settings.plexAccount'), toggle: options.useAccountServers,
          action: async () => {
            await data.updateSettings({ plex: { useAccountServers: !options.useAccountServers } });
            await data.plexServers(true).catch(() => []);
            app.rerender();
            rerenderPane();
          },
        },
        { icon: 'library', label: t('settings.plexLibraries'), next: true, action: () => push(librariesPane) },
      ];
    },
  };

  const librariesPane = {
    head: titleHead('settings.plexLibraries'),
    items: async () => {
      const sections = await data.plexSections().catch(() => []);
      const hidden = data.state.settings.plex.hiddenSections;
      return sections.map((s) => ({
        icon: s.type === 'show' ? 'tv' : 'movie', label: s.title, sub: s.serverName, toggle: !hidden.includes(s.id),
        action: async () => {
          const next = hidden.includes(s.id) ? hidden.filter((id) => id !== s.id) : [...hidden, s.id];
          await data.updateSettings({ plex: { hiddenSections: next } });
          app.rerender();
          rerenderPane();
        },
      }));
    },
  };

  const appsPane = {
    head: titleHead('settings.apps'),
    items: async () => {
      const hiddenCount = data.state.settings.hiddenApps.length;
      const fullscreen = data.state.settings.launch.fullscreen;
      return [
        {
          icon: 'display', label: t('settings.appsFullscreen'), sub: t('settings.appsFullscreenHint'), toggle: fullscreen,
          action: async () => {
            await data.updateSettings({ launch: { fullscreen: !fullscreen } });
            rerenderPane();
          },
        },
        {
          icon: 'refresh', label: t('settings.appsRefresh'),
          action: async () => {
            await data.apps(true);
            app.rerender();
            toast('✓');
          },
        },
        { icon: 'hide', label: t('settings.appsHidden', { n: hiddenCount }), next: true, action: () => { close(); app.showHiddenApps(); } },
      ];
    },
  };

  const ambientPane = {
    head: titleHead('settings.ambient'),
    items: async () => {
      const a = data.state.settings.ambient;
      const nextIdle = IDLE_STEPS[(IDLE_STEPS.indexOf(a.idleMinutes) + 1) % IDLE_STEPS.length];
      return [
        { icon: 'photo', label: t('settings.ambientOn'), toggle: a.enabled, action: () => saveAmbient({ enabled: !a.enabled }) },
        { icon: 'timer', label: t('settings.ambientWait'), value: t('settings.minutes', { n: a.idleMinutes }), action: () => saveAmbient({ idleMinutes: nextIdle }) },
        {
          icon: a.source === 'folder' ? 'folder' : 'server', label: t('settings.ambientSource'),
          value: a.source === 'folder' ? t('settings.ambientFolder') : t('settings.ambientPlex'),
          action: () => saveAmbient({ source: a.source === 'folder' ? 'plex' : 'folder' }),
        },
        {
          icon: 'folder', label: t('settings.ambientChoose'), sub: a.folder || '—',
          action: async () => {
            const folder = await call('system.pickFolder');
            if (folder) saveAmbient({ folder, source: 'folder' });
          },
        },
        { icon: 'play', label: t('settings.ambientPreview'), action: () => { close(); app.startAmbient(); } },
      ];
    },
  };

  // ---- parental controls (kids profiles)

  const parentalPane = {
    head: titleHead('parental.title'),
    items: async () => {
      const pinSet = (await call('pin.status')).set;
      const kids = data.state.settings.profiles.filter((p) => p.kind === 'kids');
      return [
        { icon: 'shield', label: pinSet ? t('pin.change') : t('pin.setup'), value: pinSet ? t('settings.on') : t('settings.off'), action: async () => { await setPin(); rerenderPane(); } },
        ...kids.map((kid) => ({
          icon: 'tv', label: kid.name, sub: limitText(kid.rules.dailyMinutes) + ' · ' + t(`rating.${kid.rules.maxRating}`), next: true,
          action: () => push(kidsPane(kid.id)),
        })),
        { icon: 'add', label: t('parental.addKid'), action: () => { close(); app.openProfiles(); } },
      ];
    },
  };

  const kid = (id) => data.state.settings.profiles.find((p) => p.id === id);
  const limitText = (minutes) => (minutes ? t('settings.minutes', { n: minutes }) : t('parental.noLimit'));
  const next = (steps, value) => steps[(steps.indexOf(value) + 1) % steps.length];

  async function saveRules(id, mutate) {
    const profiles = structuredClone(data.state.settings.profiles);
    mutate(profiles.find((p) => p.id === id).rules);
    await data.updateSettings({ profiles });
    rerenderPane();
  }

  function kidsPane(id) {
    return {
      head: () => [h('div', { class: 'title' }, kid(id).name), h('div', { class: 'sub' }, t('profiles.kind.kids'))],
      items: async () => {
        const p = kid(id);
        const rules = p.rules;
        const today = new Date().toLocaleDateString('sv-SE'); // yyyy-MM-dd
        const used = p.usageDate === today ? p.usedMinutes : 0;
        return [
          { icon: 'timer', label: t('parental.today'), value: rules.dailyMinutes ? `${used} / ${rules.dailyMinutes}` : t('settings.minutes', { n: used }) },
          { icon: 'timer', label: t('parental.limit'), value: limitText(rules.dailyMinutes), action: () => saveRules(id, (r) => { r.dailyMinutes = next(LIMIT_STEPS, r.dailyMinutes); }) },
          {
            icon: 'add', label: t('parental.addTime'),
            action: async () => {
              const pin = data.state.unlockPin ?? (await requirePin(t('pin.toAddTime')));
              if (pin == null) return;
              data.state.settings = await call('kids.addTime', { profile: id, minutes: 30, pin });
              toast(t('parental.timeAdded', { name: p.name }));
              rerenderPane();
            },
          },
          { icon: 'shield', label: t('parental.rating'), value: t(`rating.${rules.maxRating}`), action: () => saveRules(id, (r) => { r.maxRating = next(RATING_STEPS, r.maxRating); }) },
          { icon: 'apps', label: t('parental.apps'), value: String(rules.allowedApps.length), next: true, action: () => push(kidsAppsPane(id)) },
          { icon: 'library', label: t('parental.libraries'), value: String(rules.allowedSections.length), next: true, action: () => push(kidsLibrariesPane(id)) },
        ];
      },
    };
  }

  function kidsAppsPane(id) {
    return {
      head: () => [h('div', { class: 'title' }, t('parental.apps')), h('div', { class: 'sub' }, kid(id).name)],
      items: async () => {
        const all = (await data.apps()).filter((a) => !data.isHidden(a.id));
        const allowed = kid(id).rules.allowedApps;
        // Allowed apps first, in the order the child will see them
        const sorted = [...all].sort((a, b) => (allowed.includes(b.id) - allowed.includes(a.id)) || a.name.localeCompare(b.name));
        return sorted.map((app) => ({
          icon: 'apps', label: app.name, toggle: allowed.includes(app.id),
          action: () => saveRules(id, (r) => {
            r.allowedApps = r.allowedApps.includes(app.id) ? r.allowedApps.filter((x) => x !== app.id) : [...r.allowedApps, app.id];
          }),
        }));
      },
    };
  }

  function kidsLibrariesPane(id) {
    return {
      head: () => [h('div', { class: 'title' }, t('parental.libraries')), h('div', { class: 'sub' }, kid(id).name)],
      items: async () => {
        const sections = await data.plexSections().catch(() => []);
        const allowed = kid(id).rules.allowedSections;
        return sections.map((s) => ({
          icon: s.type === 'show' ? 'tv' : 'movie', label: s.title, sub: s.serverName, toggle: allowed.includes(s.id),
          action: () => saveRules(id, (r) => {
            r.allowedSections = r.allowedSections.includes(s.id) ? r.allowedSections.filter((x) => x !== s.id) : [...r.allowedSections, s.id];
          }),
        }));
      },
    };
  }

  async function saveAmbient(patch) {
    await data.updateSettings({ ambient: patch });
    rerenderPane();
  }

  const powerPane = {
    head: titleHead('settings.power'),
    items: async () => [
      ['sleep', 'sleep', 'settings.sleep'],
      ['restart', 'refresh', 'settings.restart'],
      ['shutdown', 'power', 'settings.shutdown'],
      ['quit', 'exit', 'settings.quit'],
    ].map(([action, iconName, label]) => ({
      icon: iconName, label: t(label), danger: action !== 'quit',
      action: async () => {
        const ok = await overlay.confirm(t('settings.confirm', { action: t(label) }), t(label), { danger: true });
        if (ok) call('system.power', { action }).catch((err) => toast(t('common.error', { msg: err.message })));
      },
    })),
  };

  const aboutPane = {
    head: () => [logo(), h('div', { class: 'sub', style: { marginTop: '1rem' } }, '© Angstrom X Co., Ltd.')],
    items: async () => {
      const info = await call('system.info').catch(() => null);
      if (!info) return [];
      return [
        { icon: 'info', label: t('settings.version'), value: info.version },
        { icon: 'display', label: t('settings.device'), value: info.machine },
        { icon: info.network.type === 'wifi' ? 'wifi' : 'ethernet', label: 'IP', value: info.network.ip || '—' },
        { icon: 'program', label: 'Windows', sub: info.os },
      ];
    },
  };

  async function windows(page) {
    try {
      await call('system.openSettings', { page });
    } catch (err) {
      toast(t('common.error', { msg: err.message }));
    }
  }

  push(main);
}
