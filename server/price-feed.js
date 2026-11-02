import {
  PRICE_POLL_MS,
  RETAIL_CACHE_MS,
  DA_CACHE_MS,
  FORCE_REFRESH_COOLDOWN_MS,
} from '../src/lib/price-refresh-policy.js';
function createPriceFeed({
  daSnapshot,
  retailSnapshot,
  loadDa,
  loadRetail,
  saveDa,
  saveRetail,
  now = Date.now,
}) {
  const da = { data: daSnapshot, checkedAt: null, pending: null, failed: false, save: saveDa };
  const retail = {
    data: retailSnapshot,
    checkedAt: null,
    pending: null,
    failed: false,
    save: saveRetail,
  };
  async function update(slot, loader, ttl, force) {
    if (slot.pending) return slot.pending;
    const age = slot.checkedAt === null ? Infinity : now() - slot.checkedAt;
    if (slot.saveFailed && age < ttl && now() - slot.persistAttemptAt >= FORCE_REFRESH_COOLDOWN_MS) {
      slot.persistAttemptAt = now();
      slot.pending = Promise.resolve().then(() => slot.save(slot.data))
        .then(() => { slot.saveFailed = false; return slot.data; })
        .catch(() => slot.data)
        .finally(() => { slot.pending = null; });
      return slot.pending;
    }
    // A failed DA request must not suppress recovery for the full six-hour
    // successful-report cache window. Retry failures after one minute.
    const refreshAfter = slot.failed ? Math.min(ttl, 60000) : ttl;
    if (age < refreshAfter && !(force && age >= FORCE_REFRESH_COOLDOWN_MS)) return slot.data;
    slot.pending = Promise.resolve()
      .then(() => loader(slot.data.records))
      .then((data) => {
        if (!Array.isArray(data.records) || !data.records.length)
          throw new Error('Empty source response');
        slot.data = data;
        slot.failed = false;
        slot.persistAttemptAt = now();
        return Promise.resolve(slot.save?.(data)).then(() => {
          slot.saveFailed = false;
          return data;
        }).catch(error => {
          // A database outage must not discard a successful supplier check.
          slot.saveFailed = true;
          console.error('Price reference persistence failed:', error);
          return data;
        });
      })
      .catch((error) => {
        slot.failed = true;
        console.error('Price reference refresh failed:', error);
        return slot.data;
      })
      .finally(() => {
        slot.checkedAt = now();
        slot.pending = null;
      });
    return slot.pending;
  }
  return async function getPrices({ force = false } = {}) {
    const [report, products] = await Promise.all([
      update(da, loadDa, DA_CACHE_MS, force),
      update(retail, loadRetail, RETAIL_CACHE_MS, force),
    ]);
    const warning = [
      da.failed ? 'DA refresh unavailable; showing the last verified report.' : '',
      retail.failed
        ? 'Retail refresh unavailable; showing the last verified retailer prices.'
        : products.warning || '',
      da.saveFailed || retail.saveFailed ? 'New source prices are available, but some could not be saved. They will be checked and saved again on the next refresh.' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return {
      ...report,
      records: [...report.records, ...products.records],
      warning,
      status: warning ? 'cached' : 'updated',
      persistenceFailed: Boolean(da.saveFailed || retail.saveFailed),
      lastCheckedAt: new Date(Math.max(da.checkedAt ?? 0, retail.checkedAt ?? 0)).toISOString(),
      refreshPolicy: {
        browserPollSeconds: PRICE_POLL_MS / 1e3,
        retailerCacheSeconds: RETAIL_CACHE_MS / 1e3,
        daCacheSeconds: DA_CACHE_MS / 1e3,
        instantSupplierPush: false,
      },
    };
  };
}
export { createPriceFeed };
