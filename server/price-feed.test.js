import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceFeed } from './price-feed.js';
const daSnapshot = {
  report: { label: 'DA reference', observedAt: '2026-10-11' },
  records: [{ name: 'Tomato', price: 100 }],
};
const retailSnapshot = { records: [{ name: 'Bread', price: 35, observedAt: '2026-10-14' }] };
test('retailer changes appear after 30 seconds without re-fetching a weekly DA report', async () => {
  let time = Date.parse('2026-10-14T00:00:00Z');
  let daCalls = 0,
    retailCalls = 0;
  const get = createPriceFeed({
    daSnapshot,
    retailSnapshot,
    now: () => time,
    loadDa: async () => {
      daCalls++;
      return daSnapshot;
    },
    loadRetail: async () => {
      retailCalls++;
      return { records: [{ ...retailSnapshot.records[0], price: retailCalls === 1 ? 35 : 40 }] };
    },
  });
  assert.equal((await get()).records[1].price, 35);
  time += 15e3;
  assert.equal((await get()).records[1].price, 35);
  assert.equal(retailCalls, 1);
  time += 15e3;
  const changed = await get();
  assert.equal(changed.records[1].price, 40);
  assert.equal(daCalls, 1);
  assert.equal(changed.refreshPolicy.instantSupplierPush, false);
});
test('manual checks bypass normal caches, coalesce concurrent requests and enforce cooldown', async () => {
  let time = 1e5;
  let calls = 0;
  const get = createPriceFeed({
    daSnapshot,
    retailSnapshot,
    now: () => time,
    loadDa: async () => daSnapshot,
    loadRetail: async () => {
      calls++;
      await Promise.resolve();
      return retailSnapshot;
    },
  });
  await Promise.all([get(), get(), get()]);
  assert.equal(calls, 1);
  time += 5e3;
  await get({ force: true });
  assert.equal(calls, 1);
  time += 5e3;
  await Promise.all([get({ force: true }), get({ force: true })]);
  assert.equal(calls, 2);
});
test('a failed check retains the latest successful price and its original observation date', async () => {
  let time = 1e5,
    fail = false;
  const get = createPriceFeed({
    daSnapshot,
    retailSnapshot,
    now: () => time,
    loadDa: async () => daSnapshot,
    loadRetail: async () => {
      if (fail) throw Error('Offline');
      return { records: [{ ...retailSnapshot.records[0], price: 45 }] };
    },
  });
  await get();
  fail = true;
  time += 3e4;
  const fallback = await get();
  assert.equal(fallback.records[1].price, 45);
  assert.equal(fallback.records[1].observedAt, '2026-10-14');
  assert.equal(fallback.status, 'cached');
  assert.match(fallback.warning, /Retail refresh unavailable/);
});
