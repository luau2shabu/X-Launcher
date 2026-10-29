// Cached access to host data. Views call these instead of the bridge directly.
import { call } from './bridge.js';

const cache = new Map();

async function cached(key, ttlMs, load, refresh = false) {
  const hit = cache.get(key);
  if (!refresh && hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export const state = {
  settings: null,
  showHiddenApps: false,
  /** Parent PIN entered to open Settings while a kids profile is active; cleared when Settings closes. */
  unlockPin: null,
};

export function invalidate(prefix = '') {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

export async function loadSettings() {
  state.settings = await call('settings.get');
  return state.settings;
}

/** Saves a partial settings change. A kids profile needs the parent PIN (pass it as `pin`). */
export async function updateSettings(patch, pin = state.unlockPin) {
  state.settings = await call('settings.update', pin ? { ...patch, _pin: pin } : patch);
  invalidate('plex');
  return state.settings;
}

export const activeProfile = () =>
  state.settings.profiles.find((p) => p.id === state.settings.activeProfileId) || state.settings.profiles[0];

export async function updateProfile(mutate) {
  const profiles = structuredClone(state.settings.profiles);
  const profile = profiles.find((p) => p.id === state.settings.activeProfileId) || profiles[0];
  mutate(profile, profiles);
  return updateSettings({ profiles });
}

// ---- apps

export const apps = (refresh = false) => cached('apps', 10 * 60_000, () => call('apps.list', { refresh }), refresh);

export const isKids = () => activeProfile().kind === 'kids';
export const isAdmin = () => activeProfile().kind === 'admin';

/** "Your apps": the profile's favorites, or for a kids profile the apps the parent allowed (in that order). */
export async function favoriteApps() {
  const all = await apps();
  const byId = new Map(all.map((a) => [a.id, a]));
  const ids = isKids() ? activeProfile().rules?.allowedApps || [] : activeProfile().favorites;
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Apps the current profile may see: everything, or only the allowed ones for kids. */
export async function visibleApps() {
  const all = await apps();
  if (!isKids()) return all;
  const allowed = new Set(activeProfile().rules?.allowedApps || []);
  return all.filter((a) => allowed.has(a.id));
}

export const isFavorite = (id) => activeProfile().favorites.includes(id);
export const isHidden = (id) => state.settings.hiddenApps.includes(id);

// ---- plex

export const plexHome = (refresh = false) => cached('plex:home', 45_000, () => call('plex.home', { refresh }), refresh);
export const plexTab = (type, refresh = false) => cached(`plex:tab:${type}`, 3 * 60_000, () => call('plex.tab', { type, refresh }), refresh);
export const plexSections = () => cached('plex:sections', 5 * 60_000, () => call('plex.sections'));
export const plexServers = (refresh = false) => cached('plex:servers', 5 * 60_000, () => call('plex.servers', { refresh }), refresh);
export const plexOnDeck = () => cached('plex:ondeck', 30_000, () => call('plex.onDeck', { size: 20 }));
export const plexItem = (server, key) => call('plex.item', { server, key });
export const plexChildren = (server, key) => cached(`plex:children:${server}:${key}`, 60_000, () => call('plex.children', { server, key }));
export const plexRelated = (server, key) => cached(`plex:related:${server}:${key}`, 10 * 60_000, () => call('plex.related', { server, key }));
export const plexAll = (params) => call('plex.all', params);
export const plexSearch = (query) => call('plex.search', { query });

export async function play(item, offset = 0) {
  invalidate('plex:home');
  invalidate('plex:ondeck');
  return call('plex.play', { server: item.server, key: item.key, offset });
}
