// In-browser stand-in for the C# host (open index.html?mock=1). Mirrors src/XLauncher/Bridge/Routes.cs.

const SERVER = { id: 'mock-server', name: 'ANGSTROM-X', owned: true, onThisPc: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function svg(w, h, hue, title, sub = '') {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 70% 45%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 60% 18%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.78}" cy="${h * 0.3}" r="${Math.min(w, h) * 0.32}" fill="hsl(${(hue + 30) % 360} 80% 70% / .25)"/>
    <text x="${w * 0.07}" y="${h * 0.86}" font-family="Segoe UI, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.12)}" font-weight="700" fill="#fff">${title}</text>
    <text x="${w * 0.07}" y="${h * 0.94}" font-family="Segoe UI, sans-serif" font-size="${Math.round(Math.min(w, h) * 0.06)}" fill="#fffa">${sub}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

function iconSvg(letter, color) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect x="16" y="16" width="224" height="224" rx="48" fill="${color}"/>
    <text x="128" y="170" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="130" font-weight="700" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

const TITLES = [
  ['Dune: Part Two', 2024, 'movie', ['4K', 'Dolby Vision', 'HDR10', 'Dolby Atmos', '7.1']],
  ['Oppenheimer', 2023, 'movie', ['4K', 'HDR10', 'DTS-HD MA', '5.1']],
  ['Blade Runner 2049', 2017, 'movie', ['4K', 'Dolby Vision', 'Dolby Atmos']],
  ['Interstellar', 2014, 'movie', ['4K', 'HDR10', 'DTS-HD MA']],
  ['Spirited Away', 2001, 'movie', ['HD', 'Dolby Digital', '5.1']],
  ['Mad Max: Fury Road', 2015, 'movie', ['4K', 'Dolby Vision', 'Dolby Atmos']],
  ['Arrival', 2016, 'movie', ['4K', 'HDR10']],
  ['Parasite', 2019, 'movie', ['4K', 'HDR10', 'DTS:X']],
  ['The Batman', 2022, 'movie', ['4K', 'Dolby Vision', 'Dolby Atmos']],
  ['Top Gun: Maverick', 2022, 'movie', ['4K', 'Dolby Vision', 'Dolby Atmos']],
  ['Everything Everywhere', 2022, 'movie', ['4K', 'HDR10']],
  ['Inception', 2010, 'movie', ['4K', 'HDR10', 'Dolby TrueHD']],
  ['Severance', 2022, 'show', ['4K', 'Dolby Vision', 'Dolby Atmos']],
  ['The Last of Us', 2023, 'show', ['4K', 'HDR10', 'Dolby Atmos']],
  ['Shōgun', 2024, 'show', ['4K', 'Dolby Vision']],
  ['Dark', 2017, 'show', ['4K', 'HDR10']],
  ['Arcane', 2021, 'show', ['4K', 'Dolby Vision']],
  ['Chernobyl', 2019, 'show', ['HD', 'Dolby Digital+']],
  ['Planet Earth III', 2023, 'show', ['4K', 'HDR10']],
  ['Fallout', 2024, 'show', ['4K', 'Dolby Vision', 'Dolby Atmos']],
];
const GENRES = ['Sci-Fi', 'Drama', 'Action', 'Animation', 'Thriller'];
const SUMMARY = 'A sweeping story of ambition, survival and wonder, told on the biggest canvas. Perfect on a big screen with the lights down and the sound up.';

const items = TITLES.map(([title, year, type, badges], i) => {
  const hue = (i * 47) % 360;
  const show = type === 'show';
  return {
    server: SERVER.id, serverName: SERVER.name, key: String(100 + i), type, sectionKey: show ? '2' : '1',
    title, subtitle: String(year), year, summary: SUMMARY, tagline: i % 3 === 0 ? 'Long live the fighters.' : null,
    poster: svg(360, 540, hue, title.split(':')[0], year), landscape: svg(640, 360, hue, '', ''), art: svg(1920, 1080, hue, '', ''),
    duration: show ? 0 : (100 + i * 4) * 60000, viewOffset: 0, progress: 0, watched: i % 5 === 4,
    rating: 7 + (i % 3) * 0.6, contentRating: show ? 'TV-MA' : 'PG-13', genres: [GENRES[i % 5], GENRES[(i + 2) % 5]],
    directors: show ? [] : ['Denis Villeneuve'], cast: ['Actor One', 'Actor Two', 'Actor Three'], badges,
    childCount: show ? 2 : null, leafCount: show ? 16 : null, viewedLeafCount: show ? 3 : null,
  };
});

function episodes(show, season) {
  return Array.from({ length: 8 }, (_, e) => ({
    ...show, key: `${show.key}-${season}-${e + 1}`, type: 'episode', episodeTitle: `Chapter ${e + 1}`,
    subtitle: `S${season} E${e + 1} · Chapter ${e + 1}`, season, episode: e + 1, showKey: show.key, seasonKey: `${show.key}-s${season}`,
    landscape: svg(640, 360, (Number(show.key) * 47 + e * 9) % 360, '', ''),
    duration: 52 * 60000, viewOffset: season === 1 && e === 3 ? 21 * 60000 : 0, progress: season === 1 && e === 3 ? 0.4 : 0,
    watched: season === 1 && e < 3,
  }));
}

const onDeck = [
  { ...items[0], viewOffset: 64 * 60000, progress: 0.38 },
  { ...episodes(items[12], 1)[3] },
  { ...items[2], viewOffset: 12 * 60000, progress: 0.07 },
  { ...episodes(items[13], 2)[0], viewOffset: 5 * 60000, progress: 0.1 },
];

const sections = [
  { id: `${SERVER.id}/1`, server: SERVER.id, serverName: SERVER.name, key: '1', title: 'Movies', type: 'movie', art: items[3].landscape, hidden: false },
  { id: `${SERVER.id}/2`, server: SERVER.id, serverName: SERVER.name, key: '2', title: 'TV Shows', type: 'show', art: items[12].landscape, hidden: false },
];

const APP_DEFS = [
  ['Plex HTPC', '#1f1f1f', 'P'], ['Netflix', '#e50914', 'N'], ['YouTube', '#ff0033', '▶'], ['Prime Video', '#00a8e1', 'p'],
  ['HBO Max', '#5822b4', 'H'], ['Disney+', '#0b3d91', 'D'], ['Spotify', '#1db954', 'S'], ['Kodi', '#17b2e7', 'K'],
  ['VLC media player', '#ff8800', 'V'], ['Steam', '#1b2838', 'S'], ['Microsoft Edge', '#0c59a4', 'e'], ['Calculator', '#444', '='],
  ['File Explorer', '#f2b600', 'F'], ['Photos', '#1a73e8', '◆'], ['Xbox', '#107c10', 'X'], ['Twitch', '#9146ff', 'T'],
];
let apps = APP_DEFS.map(([name, color, letter], i) => ({
  id: `mock.app.${i}`, name, kind: i % 3 === 0 ? 'desktop' : 'store', icon: iconSvg(letter, color), custom: false,
}));

const SETTINGS_KEY = 'xlauncher-mock-settings';
let mockPin = null;
const today = () => new Date().toLocaleDateString('sv-SE');
function defaultSettings() {
  return {
    version: 1, language: 'th', clientId: 'mock', appsSeeded: true, activeProfileId: 'default',
    profiles: [
      { id: 'default', name: 'Somchai J.', kind: 'admin', color: '#3ba3cc', picture: iconSvg('S', '#81c995'), favorites: apps.slice(0, 7).map((a) => a.id) },
      { id: 'kid1', name: 'น้องมิว', kind: 'kids', color: '#fdd663', favorites: [], usageDate: today(), usedMinutes: 25,
        rules: { allowedApps: [apps[2].id, apps[5].id], allowedSections: ['mock-server/2'], maxRating: 'child', dailyMinutes: 90 } },
    ],
    hiddenApps: [], customApps: [], iconOverrides: {}, nameOverrides: {}, launch: { fullscreen: true, windowedApps: [] },
    plex: { enabled: true, localUrl: 'http://127.0.0.1:32400', useAccountServers: true, htpcPath: '', hiddenSections: [] },
    ambient: { enabled: true, idleMinutes: 5, source: 'plex', folder: '', showClock: true },
    input: { homeKeys: [172], gamepadEnabled: true },
  };
}
let settings;
try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || defaultSettings(); } catch { settings = defaultSettings(); }
const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* private mode */ } };

function merge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') merge(target[k], v);
    else target[k] = v;
  }
}

const movies = items.filter((i) => i.type === 'movie');
const shows = items.filter((i) => i.type === 'show');

const handlers = {
  'settings.get': () => settings,
  'settings.update': (p) => {
    const { clientId, customApps, _pin, ...rest } = p;
    const active = settings.profiles.find((x) => x.id === settings.activeProfileId);
    if (active?.kind === 'kids' && mockPin != null && _pin !== mockPin) throw new Error('Parent PIN required');
    merge(settings, rest);
    save();
    return settings;
  },
  'apps.list': () => [...settings.customApps.map((c) => ({ ...c, custom: true, icon: null })), ...apps],
  'apps.launch': (p) => { console.info('[mock] launch', p.id); return true; },
  'apps.addWebsite': (p) => {
    const app = { id: `custom:${Date.now()}`, name: p.name, kind: 'url', target: p.url, tvMode: !!p.tvMode };
    settings.customApps.push(app);
    settings.profiles.find((x) => x.id === settings.activeProfileId).favorites.push(app.id);
    save();
    return { ...app, custom: true, icon: null };
  },
  'apps.addProgram': () => null,
  'apps.removeCustom': (p) => {
    settings.customApps = settings.customApps.filter((a) => a.id !== p.id);
    settings.profiles.forEach((x) => { x.favorites = x.favorites.filter((id) => id !== p.id); });
    save();
    return true;
  },
  'plex.servers': () => [SERVER],
  'plex.sections': () => sections.map((s) => ({ ...s, hidden: settings.plex.hiddenSections.includes(s.id) })),
  'plex.home': () => ({
    connected: true, servers: [SERVER],
    hero: [items[0], items[12], items[5], items[14]],
    rows: [
      { kind: 'continue', items: onDeck },
      { kind: 'picks', items: [...items].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 12) },
      { kind: 'recent', title: 'Movies', items: movies, sectionId: sections[0].id },
      { kind: 'recent', title: 'TV Shows', items: shows, sectionId: sections[1].id },
    ],
  }),
  'plex.tab': (p) => {
    const list = p.type === 'movie' ? movies : shows;
    return {
      connected: true, hero: list.slice(0, 4), sections: sections.filter((s) => s.type === p.type),
      rows: [
        { kind: 'picks', items: [...list].reverse() },
        { kind: 'recent', title: p.type === 'movie' ? 'Movies' : 'TV Shows', items: list },
        ...GENRES.slice(0, 3).map((g) => ({ kind: 'genre', title: g, items: list.filter((i) => i.genres.includes(g)) })).filter((r) => r.items.length),
      ],
    };
  },
  'plex.onDeck': () => onDeck,
  'plex.all': (p) => {
    let list = (p.section === '1' ? movies : shows).concat(p.section === '1' ? movies.map((m, i) => ({ ...m, key: `${m.key}x${i}` })) : []);
    if (p.unwatched) list = list.filter((i) => !i.watched);
    if (p.sort === 'year:desc') list = [...list].sort((a, b) => b.year - a.year);
    if (p.sort === 'titleSort') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return { items: list.slice(p.start, p.start + p.size), total: list.length };
  },
  'plex.item': (p) => {
    const base = items.find((i) => i.key === p.key) || onDeck.find((i) => i.key === p.key) || items[0];
    if (base.type === 'show') return { ...base, onDeck: episodes(base, 1)[3] };
    return base;
  },
  'plex.children': (p) => {
    const show = items.find((i) => i.key === p.key);
    if (show) return [1, 2].map((s) => ({ ...show, key: `${show.key}-s${s}`, type: 'season', subtitle: `Season ${s}`, season: s }));
    const [, showKey, season] = p.key.match(/^(\d+)-s(\d+)$/) || [];
    return showKey ? episodes(items.find((i) => i.key === showKey), Number(season)) : [];
  },
  'plex.related': () => items.slice(3, 11),
  'plex.search': (p) => {
    const q = p.query.toLowerCase();
    const hits = items.filter((i) => i.title.toLowerCase().includes(q));
    return { movies: hits.filter((i) => i.type === 'movie'), shows: hits.filter((i) => i.type === 'show'), episodes: [] };
  },
  'plex.watched': (p) => { const it = items.find((i) => i.key === p.key); if (it) it.watched = !!p.watched; return true; },
  'plex.play': async () => { await sleep(600); return { status: 'playing' }; },
  'ambient.photos': () => items.map((i) => i.art),
  'system.info': () => ({ version: '0.1.0-mock', machine: 'ANGSTROM-X', os: 'Microsoft Windows 10.0.26300', network: { connected: true, name: 'Ethernet', type: 'ethernet', speedMbps: 1000, ip: '192.168.1.10' } }),
  'system.power': (p) => { console.info('[mock] power', p.action); return true; },
  'system.openSettings': (p) => { console.info('[mock] open settings', p.page); return true; },
  'system.pickFolder': () => null,
  'icons.search': async (p) => {
    await sleep(700);
    return [0, 1, 2, 3, 4].map((i) => ({
      url: iconSvg(p.name[0].toUpperCase(), `hsl(${(i * 70 + 200) % 360} 65% 45%)`), label: `${p.name} ${i + 1}`, source: i < 2 ? 'web' : 'store', size: 512,
    }));
  },
  'icons.use': (p) => {
    settings.iconOverrides[p.id] = 'mock.png';
    const app = apps.find((a) => a.id === p.id);
    if (app) app.icon = iconSvg('★', '#3ba3cc');
    save();
    return app?.icon;
  },
  'icons.reset': (p) => { delete settings.iconOverrides[p.id]; save(); return true; },
  'icons.fromFile': (p) => {
    const app = apps.find((a) => a.id === p.id);
    if (app) app.icon = iconSvg('F', '#c58af9');
    settings.iconOverrides[p.id] = 'file.png';
    save();
    return app?.icon;
  },
  'apps.rename': (p) => {
    const app = apps.find((a) => a.id === p.id);
    if (app) app.name = p.name || app.name;
    settings.nameOverrides[p.id] = p.name;
    save();
    return settings;
  },
  'pin.status': () => ({ set: mockPin != null }),
  'pin.verify': (p) => mockPin == null || p.pin === mockPin,
  'pin.set': (p) => { if (mockPin != null && p.current !== mockPin) throw new Error('The current PIN is wrong'); mockPin = p.pin; return true; },
  'kids.status': () => {
    const p = settings.profiles.find((x) => x.id === settings.activeProfileId);
    if (p.kind !== 'kids') return null;
    const used = p.usageDate === today() ? p.usedMinutes : 0;
    const limit = p.rules.dailyMinutes;
    return { used, limit, remaining: limit ? Math.max(0, limit - used) : null, timeUp: limit > 0 && used >= limit };
  },
  'kids.addTime': (p) => {
    const kid = settings.profiles.find((x) => x.id === p.profile);
    kid.usedMinutes = Math.max(0, kid.usedMinutes - (p.minutes || 30));
    save();
    return settings;
  },
  'ui.ready': (p) => { console.info('[mock] ui ready', p.summary); return true; },
  'ui.log': (p) => { console.warn('[mock] ui log', p.level, p.message); return true; },
};

export async function call(method, params) {
  const handler = handlers[method];
  if (!handler) throw new Error(`Unknown method '${method}'`);
  await sleep(method.startsWith('plex.') ? 150 : 20);
  return structuredClone(await handler(params || {}));
}
