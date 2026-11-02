import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceFeed } from './price-feed.js';
const daSnapshot = {
  report: { label: 'DA reference', observedAt: '2026-10-11' },
  records: [{ name: 'Tomato', price: 100 }],
};
const retailSnapshot = { records: [{ name: 'Bread', price: 35, observedAt: '2026-10-14' }] };

test('failed DA fetch retries after a minute instead of retaining a six-hour failed cache', async () => {
  let time = 100000, calls = 0;
  const get = createPriceFeed({daSnapshot,retailSnapshot,now:()=>time,
    loadDa:async()=>{ if(++calls === 1) throw Error('timeout'); return {...daSnapshot,records:[{name:'Tomato',price:110}]}; },
    loadRetail:async()=>retailSnapshot });
  const original=console.error;console.error=()=>{};
  try {
    assert.match((await get()).warning,/DA refresh unavailable/);
    time+=30000;await get();assert.equal(calls,1);
    time+=30000;const recovered=await get();assert.equal(calls,2);
    assert.equal(recovered.records[0].price,110);assert.equal(recovered.warning,'');
  } finally {console.error=original;}
});
test('a failed database save still serves fresh supplier prices and retries persistence', async () => {
  let fail = true, time = 100000;
  const get = createPriceFeed({ daSnapshot, retailSnapshot, now: () => time,
    loadDa: async () => daSnapshot,
    loadRetail: async () => ({ records: [{ name: 'Bread', price: 42 }] }),
    saveRetail: async () => { if (fail) throw Error('database offline'); },
  });
  const error = console.error; console.error = () => {};
  try {
    const first = await get();
    assert.equal(first.records[1].price, 42);
    assert.equal(first.persistenceFailed, true);
    assert.match(first.warning, /could not be saved/);
    fail = false; time += 30000;
    const recovered = await get();
    assert.equal(recovered.persistenceFailed, false);
    assert.equal(recovered.warning, '');
  } finally { console.error = error; }
});
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
  const originalError = console.error;
  console.error = () => {};
  let time = 1e5,
    fail = false;
  try {
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
  } finally {
    console.error = originalError;
  }
});

test('a failed database save exposes fresh quotes only with a persistence warning', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const get = createPriceFeed({
      daSnapshot,
      retailSnapshot,
      loadDa: async () => daSnapshot,
      loadRetail: async () => ({
        records: [{ ...retailSnapshot.records[0], price: 99 }],
      }),
      saveRetail: async () => {
        throw new Error('Database write failed');
      },
    });
    const result = await get();
    assert.equal(result.records[1].price, 99);
    assert.equal(result.status, 'cached');
    assert.equal(result.persistenceFailed, true);
    assert.match(result.warning, /could not be saved/);
  } finally {
    console.error = originalError;
  }
});
