// Mock-only screen states for README screenshots: index.html?mock=1&demo=<state>
// (tools/capture-screenshots.ps1 renders each one with headless Edge).
import { call } from './bridge.js';
import * as data from './data.js';
import * as focus from './focus.js';
import * as router from './router.js';
import { sleep } from './dom.js';

const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
const activate = (selector) => document.querySelector(selector)?._activate?.();
const activateItem = (text) => [...document.querySelectorAll('.drawer .item')].find((i) => i.innerText.includes(text))?._activate?.();

export async function run(state, shell) {
  switch (state) {
    case 'home':
      press('ArrowDown'); // focus Your apps
      press('ArrowRight');
      break;
    case 'apps':
      shell.selectTab('apps');
      await sleep(800);
      press('ArrowDown');
      press('ArrowRight');
      break;
    case 'details':
      router.open('details', await call('plex.item', { server: 'mock-server', key: '112' }));
      await sleep(800);
      press('ArrowDown');
      press('ArrowDown');
      break;
    case 'search':
      activate('[data-role=search]');
      await sleep(300);
      for (const ch of 'ar') document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
      await sleep(800);
      for (let i = 0; i < 11; i++) press('ArrowRight');
      break;
    case 'menu':
      press('ArrowDown');
      press('ArrowRight');
      focus.focused()?._menu?.();
      break;
    case 'profiles':
      activate('[data-role=profile]');
      break;
    case 'kids':
      await data.updateSettings({ activeProfileId: 'kid1' });
      shell.rerender();
      await sleep(800);
      press('ArrowDown');
      break;
    case 'parental':
      activate('[data-role=settings]');
      await sleep(400);
      activateItem('ควบคุมโดยผู้ปกครอง');
      await sleep(400);
      activateItem('น้องมิว');
      break;
    default:
      break;
  }
}
