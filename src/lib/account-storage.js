// Account namespace prevents another sign-in from inheriting an earlier user's plan.
let activeAccount = null;
export function setActiveAccount(id) { activeAccount = id || null; }
export function accountStorage(getStorage, getAccount = () => activeAccount) {
  const keyFor = key => getAccount() ? `blane:account:${encodeURIComponent(getAccount())}:${key}` : null;
  return {
    keyFor,
    getItem(key) { try { const k = keyFor(key); return k ? getStorage()?.getItem(k) ?? null : null; } catch { return null; } },
    setItem(key, value) { const k = keyFor(key); if (k) getStorage()?.setItem(k, value); },
    removeItem(key) { const k = keyFor(key); if (k) getStorage()?.removeItem(k); },
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
export const sessionMealStorage = accountStorage(() => globalThis.sessionStorage);
// Legacy unscoped data is intentionally preserved, but never assigned to a new
// account automatically because its original owner cannot be established.
