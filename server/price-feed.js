import {
  PRICE_POLL_MS,
  RETAIL_CACHE_MS,
  DA_CACHE_MS,
  FORCE_REFRESH_COOLDOWN_MS,
} from '../src/lib/price-refresh-policy.js';
function createPriceFeed({ daSnapshot, retailSnapshot, loadDa, loadRetail, now = Date.now }) {
  const da = { data: daSnapshot, checkedAt: null, pending: null, failed: false };
  const retail = { data: retailSnapshot, checkedAt: null, pending: null, failed: false };
  async function update(slot, loader, ttl, force) {
    if (slot.pending) return slot.pending;
    const age = slot.checkedAt === null ? Infinity : now() - slot.checkedAt;
    if (age < ttl && !(force && age >= FORCE_REFRESH_COOLDOWN_MS)) return slot.data;
    slot.pending = Promise.resolve()
      .then(() => loader(slot.data.records))
      .then((data) => {
        if (!Array.isArray(data.records) || !data.records.length)
          throw new Error('Empty source response');
        slot.data = data;
        slot.failed = false;
        return data;
      })
      .catch(() => {
        slot.failed = true;
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
    ]
      .filter(Boolean)
      .join(' ');
    return {
      ...report,
      records: [...report.records, ...products.records],
      warning,
      status: warning ? 'cached' : 'updated',
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
