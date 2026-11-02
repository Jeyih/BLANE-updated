const PREFIX = 'blane_offline_v1:';
const PUBLIC_TABLES = new Set(['recipes', 'recipe_ingredients', 'recipe_steps', 'fnri_food_composition', 'price_reference_data', 'ingredient_seasons', 'constraint_definitions', 'option_lists', 'goal_ideals', 'markets', 'market_ingredients']);
const PRIVATE_TABLES = new Set(['profiles', 'health_logs']);
let cachedAt = null;

function announce(savedAt) {
  cachedAt = savedAt;
  globalThis.window?.dispatchEvent(new Event('blane-offline-data'));
}
export function lastOfflineSnapshot() { return cachedAt; }
function tokenAccount(headers) {
  try {
    const token = headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sub === 'string' && payload.role === 'authenticated' ? payload.sub : null;
  } catch { return null; }
}
export function clearOfflineAccount(account, storage = globalThis.localStorage) {
  try {
    for (const key of Object.keys(storage)) if (key.startsWith(`${PREFIX}${account}:`)) storage.removeItem(key);
  } catch { /* Storage may be unavailable. */ }
  announce(null);
}

// Only successful, explicitly allowed reads are persisted. Auth, RPCs, writes,
// administrator feedback and tokens never enter this cache.
export function createOfflineFetch({ baseUrl, fetcher = (...args) => fetch(...args), storage = () => globalThis.localStorage, online = () => globalThis.navigator?.onLine !== false, now = () => Date.now() } = {}) {
  const base = new URL(baseUrl);
  return async function offlineFetch(input, init = {}) {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || String(input), base);
    const method = (init.method || request?.method || 'GET').toUpperCase();
    const headers = new Headers(request?.headers);
    new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    const table = url.origin === base.origin && url.pathname.startsWith('/rest/v1/') ? url.pathname.slice('/rest/v1/'.length) : null;
    const priceFeed = url.origin === base.origin && url.pathname === '/.netlify/functions/ingredient-prices';
    const account = tokenAccount(headers);
    // Even catalogue requests are account-scoped: anonymous/RLS-filtered results
    // must never replace the catalogue captured by a signed-in user.
    const scope = PUBLIC_TABLES.has(table) ? (account || 'public') : priceFeed ? 'public' : PRIVATE_TABLES.has(table) && account ? account : null;
    if (method !== 'GET' || !scope) {
      if (!online()) throw new TypeError(method !== 'GET'
        ? 'You are offline. Reconnect before saving this change.'
        : 'No saved offline copy is available for this request.');
      const result = await fetcher(input, init);
      // Refresh existing private snapshots after a confirmed save, so an
      // immediate disconnect does not reopen the pre-edit profile/health log.
      if (result.ok && method !== 'GET' && account && PRIVATE_TABLES.has(table)) {
        try {
          const keys = Object.keys(storage()).filter(k => k.startsWith(`${PREFIX}${account}:`));
          await Promise.allSettled(keys.map(async key => {
            const [savedUrl, accept, range, prefer] = JSON.parse(key.slice(`${PREFIX}${account}:`.length));
            if (new URL(savedUrl).pathname !== url.pathname) return;
            const refreshedHeaders = new Headers({ authorization: headers.get('authorization') });
            for (const [name, value] of [['accept', accept], ['range', range], ['prefer', prefer]]) if (value) refreshedHeaders.set(name, value);
            await offlineFetch(savedUrl, { headers: refreshedHeaders, signal: AbortSignal.timeout(2500) });
          }));
        } catch { /* The server save succeeded even if recaching could not. */ }
      }
      return result;
    }
    const cacheUrl = new URL(url);
    if (priceFeed) cacheUrl.searchParams.delete('refresh');
    const key = `${PREFIX}${scope}:${JSON.stringify([cacheUrl.href, headers.get('accept'), headers.get('range'), headers.get('prefer')])}`;
    function fallback() {
      try {
        const saved = JSON.parse(storage().getItem(key));
        if (!saved || typeof saved.body !== 'string' || !saved.savedAt) return null;
        announce(saved.savedAt);
        return new Response(saved.body, { status: saved.status, headers: { ...saved.headers, 'x-blane-offline': 'true' } });
      } catch { return null; }
    }
    if (!online()) {
      const saved = fallback();
      if (saved) return saved;
      throw new TypeError('No saved offline copy. Open this page while online first.');
    }
    let response;
    try {
      const timeout = AbortSignal.timeout(10000);
      const originalSignal = init.signal || request?.signal;
      const signal = originalSignal ? AbortSignal.any([originalSignal, timeout]) : timeout;
      response = await fetcher(input, { ...init, signal });
    }
    catch (error) { const saved = fallback(); if (saved) return saved; throw error; }
    if (response.status >= 500) { const saved = fallback(); if (saved) return saved; }
    if (response.ok && response.status !== 204 && response.headers.get('content-type')?.includes('json')) {
      try {
        const body = await response.clone().text();
        if (body.length <= 1500000) {
          const safeHeaders = {};
          for (const name of ['content-type', 'content-range', 'range-unit']) if (response.headers.has(name)) safeHeaders[name] = response.headers.get(name);
          const value = JSON.stringify({ body, status: response.status, headers: safeHeaders, savedAt: now() });
          try { storage().setItem(key, value); }
          catch {
            // Evict only our oldest snapshots; never remove meal plans or other app data.
            const oldest = Object.keys(storage()).filter(k => k.startsWith(PREFIX)
              && !k.includes('/rest/v1/profiles?') && !k.includes('/rest/v1/health_logs?'))
              .sort((a, b) => JSON.parse(storage().getItem(a)).savedAt - JSON.parse(storage().getItem(b)).savedAt);
            for (const entry of oldest.slice(0, 8)) storage().removeItem(entry);
            storage().setItem(key, value);
          }
        }
      } catch { /* A full/disabled cache must not break online reads. */ }
    }
    return response;
  };
}
