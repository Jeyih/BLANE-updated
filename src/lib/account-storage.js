// Account namespace prevents another sign-in from inheriting an earlier user's plan.
let activeAccount = null;
const storageListeners = new Set();
export function subscribeAccountStorage(listener) {
  storageListeners.add(listener);
  const fromTab = event => {
    const match = event.key?.match(/^blane:account:([^:]+):(.+)$/);
    if (match) { try { listener({ account: decodeURIComponent(match[1]), key: match[2], value: event.newValue }); } catch {} }
  };
  globalThis.window?.addEventListener('storage', fromTab);
  return () => { storageListeners.delete(listener); globalThis.window?.removeEventListener('storage', fromTab); };
}
export function setActiveAccount(id) { activeAccount = id || null; }
export function accountStorage(getStorage, getAccount = () => activeAccount) {
  const keyFor = key => getAccount() ? `blane:account:${encodeURIComponent(getAccount())}:${key}` : null;
  return {
    keyFor,
    getItem(key) { try { const k = keyFor(key); return k ? getStorage()?.getItem(k) ?? null : null; } catch { return null; } },
    setItem(key, value) {
      const k = keyFor(key);
      if (!k || getStorage()?.getItem(k) === String(value)) return;
      getStorage()?.setItem(k, value);
      storageListeners.forEach(listener => listener({ account: getAccount(), key, value: String(value) }));
    },
    removeItem(key) {
      const k = keyFor(key); if (!k) return;
      getStorage()?.removeItem(k);
      storageListeners.forEach(listener => listener({ account: getAccount(), key, value: null }));
    },
    matches(eventKey, key) { const scopedKey = keyFor(key); return scopedKey !== null && eventKey === scopedKey; },
  };
}
export function readStoredJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key));
    if (!value || typeof value !== 'object' || Array.isArray(value) !== Array.isArray(fallback)) return fallback;
    return value;
  } catch { return fallback; }
}
export const localMealStorage = accountStorage(() => globalThis.localStorage);
// Preserve legacy session data while making portions and groceries survive a
// closed tab. Both stores retain the authenticated account namespace.
export const durableSessionStorage = {
  getItem(key) { return globalThis.localStorage?.getItem(key) ?? globalThis.sessionStorage?.getItem(key) ?? null; },
  setItem(key, value) { globalThis.localStorage?.setItem(key, value); globalThis.sessionStorage?.setItem(key, value); },
  removeItem(key) { globalThis.localStorage?.removeItem(key); globalThis.sessionStorage?.removeItem(key); },
};
export const sessionMealStorage = accountStorage(() => durableSessionStorage);
// Legacy unscoped data is intentionally preserved, but never assigned to a new
// account automatically because its original owner cannot be established.
