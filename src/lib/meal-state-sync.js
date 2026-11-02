export const SYNC_KEYS = ['blane_meal_plan_weeks_v1', 'blane_completed_meals_v2', 'blane_slot_optimizations_v1', 'blane_grocery_v2'];
const META_KEY = 'blane_meal_sync_v1';
function parse(raw, fallback = {}) { try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } }
function validValue(key, value) { return Boolean(value && typeof value === 'object' && (key === 'blane_grocery_v2' ? Array.isArray(value) : !Array.isArray(value))); }

// Each controller is bound to one account's fixed storage adapters. An in-flight
// request from a signed-out account can never write another account's cache.
export function createMealStateSync({ account, client, local, session, subscribe, onStatus = () => {}, onHydrate = () => {} }) {
  const savedMeta = parse(local.getItem(META_KEY));
  const meta = savedMeta && typeof savedMeta === 'object' && !Array.isArray(savedMeta) ? savedMeta : {};
  if (!meta.revisions || typeof meta.revisions !== 'object' || Array.isArray(meta.revisions)) meta.revisions = {};
  if (!meta.pending || typeof meta.pending !== 'object' || Array.isArray(meta.pending)) meta.pending = {};
  let stopped = false, applying = false, running = null;
  let conflicts = {};
  let unsubscribe;
  const store = key => ['blane_grocery_v2', 'blane_slot_optimizations_v1'].includes(key) ? session : local;
  function remember() { local.setItem(META_KEY, JSON.stringify(meta)); }
  function report(status) { if (!stopped) onStatus({ status, pending: Object.keys(meta.pending).length, conflicts: Object.keys(conflicts) }); }
  function apply(key, value) {
    applying = true;
    try { store(key).setItem(key, JSON.stringify(value)); } finally { applying = false; }
  }
  function changed(event) {
    if (stopped || applying || event.account !== account || !SYNC_KEYS.includes(event.key)) return;
    const value = parse(event.value, event.key === 'blane_grocery_v2' ? [] : {});
    if (!validValue(event.key, value)) return;
    meta.pending[event.key] = value;
    remember();
    report('pending');
    void sync();
  }
  async function run() {
    if (globalThis.navigator?.onLine === false) { report('offline'); return; }
    report('saving');
    try {
      const result = await client.from('private_meal_state').select('state_key,value,revision').eq('user_id', account).abortSignal(AbortSignal.timeout(8000));
      if (result.error) throw result.error;
      if (stopped) return;
      const rows = Object.fromEntries((result.data || []).map(row => [row.state_key, row]));
      let hydrated = false;
      for (const key of SYNC_KEYS) {
        const row = rows[key];
        const raw = store(key).getItem(key);
        const localValue = parse(raw, null);
        if (row && (!validValue(key, row.value) || !Number.isSafeInteger(row.revision) || row.revision < 1)) throw Error('Invalid saved state');
        const revision = meta.revisions[key] || 0;
        if (!Object.hasOwn(meta.pending, key) && row && raw !== null && revision === 0 && JSON.stringify(localValue) !== JSON.stringify(row.value)) {
          // First connection on an already-used device: preserve both versions.
          meta.pending[key] = localValue;
        }
        if (Object.hasOwn(meta.pending, key)) {
          if (row && row.revision !== revision) {
            if (JSON.stringify(meta.pending[key]) === JSON.stringify(row.value)) {
              meta.revisions[key] = row.revision;
              delete meta.pending[key];
              delete conflicts[key];
            } else conflicts[key] = row;
          }
        } else if (row) {
          meta.revisions[key] = row.revision;
          if (JSON.stringify(localValue) !== JSON.stringify(row.value)) { apply(key, row.value); hydrated = true; }
        } else if (raw !== null && validValue(key, localValue)) {
          meta.pending[key] = localValue;
        }
      }
      remember();
      if (hydrated && !stopped) onHydrate();
      for (const key of Object.keys(meta.pending)) {
        if (stopped) return;
        if (!SYNC_KEYS.includes(key) || conflicts[key]) continue;
        const value = meta.pending[key];
        const snapshot = JSON.stringify(value);
        const saved = await client.rpc('save_private_meal_state', { p_account: account, p_key: key, p_value: value, p_expected_revision: meta.revisions[key] || 0 }).abortSignal(AbortSignal.timeout(8000));
        if (saved.error) throw saved.error;
        if (stopped) return;
        if (!saved.data?.saved) {
          const latest = await client.from('private_meal_state').select('state_key,value,revision').eq('user_id', account).abortSignal(AbortSignal.timeout(8000));
          if (latest.error) throw latest.error;
          if (stopped) return;
          const row = latest.data?.find(entry => entry.state_key === key);
          if (row) conflicts[key] = row;
          report(row ? 'conflict' : 'offline');
          return;
        }
        if (!Number.isSafeInteger(saved.data.revision) || saved.data.revision <= (meta.revisions[key] || 0)) throw Error('Invalid saved revision');
        meta.revisions[key] = saved.data.revision;
        if (JSON.stringify(meta.pending[key]) === snapshot) delete meta.pending[key];
        remember();
      }
      report(Object.keys(conflicts).length ? 'conflict' : Object.keys(meta.pending).length ? 'pending' : 'saved');
    } catch { report('offline'); }
  }
  function sync() {
    if (stopped) return Promise.resolve();
    if (running) return running;
    running = run().finally(() => { running = null; });
    return running;
  }
  async function resolve(choice) {
    let hydrated = false;
    for (const [key, row] of Object.entries(conflicts)) {
      meta.revisions[key] = row.revision;
      if (choice === 'account') { apply(key, row.value); delete meta.pending[key]; hydrated = true; }
      delete conflicts[key];
    }
    remember();
    if (hydrated) onHydrate();
    await sync();
  }
  return {
    start() { unsubscribe = subscribe?.(changed); return sync(); },
    sync, resolve,
    stop() { stopped = true; unsubscribe?.(); },
  };
}
