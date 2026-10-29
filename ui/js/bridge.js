// Calls into the C# host over WebView2 messaging. Outside the host (or with ?mock=1)
// a mock backend is used so the UI can be developed in a normal browser.

const webview = window.chrome?.webview;
export const isMock = !webview || new URLSearchParams(location.search).has('mock');

const pending = new Map();
const listeners = new Map();
let seq = 0;
let mock = null;

if (!isMock) {
  webview.addEventListener('message', (e) => {
    const msg = e.data;
    if (msg && msg.id != null && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error));
      else resolve(msg.result);
    } else if (msg && msg.event) {
      emit(msg.event, msg.data);
    }
  });
}

export async function call(method, params = {}) {
  if (isMock) {
    mock ??= await import('./mock.js');
    return mock.call(method, params, emit);
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    webview.postMessage({ id, method, params });
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`timeout: ${method}`));
    }, 90000);
  });
}

/** Host events: "home", "focus" (bool), "key" (gamepad key name). */
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

function emit(event, data) {
  for (const fn of listeners.get(event) || []) fn(data);
}
