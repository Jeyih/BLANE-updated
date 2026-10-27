import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../netlify/functions/ingredient-prices.mjs';
import { createPriceFeedAccess, createReferenceDataClient } from './reference-data.js';

const rows = [
  { catalogue: 'da_price', entry_key: 'tomato', data: { name: 'Tomato', price: 50, observedAt: '2026-10-11' } },
  { catalogue: 'retail_price', entry_key: 'bread', data: { name: 'Bread', price: 35, observedAt: '2026-10-11' } },
];
function database(writes = []) {
  return {
    from() { return { select() { return this; }, order() { return this; }, range() { return this; },
      async abortSignal() { return { data: rows }; } }; },
    async rpc(name, payload) { writes.push({ name, payload }); return { error: null }; },
  };
}
const loaders = {
  loadDa: async () => ({ records: [{ name: 'Tomato', price: 65, observedAt: '2026-10-25' }] }),
  loadRetail: async () => ({ records: [{ name: 'Bread', price: 40, observedAt: '2026-10-27' }] }),
};
test('public catalogue access can serve newer source prices without a privileged write key', async () => {
  const writes = [];
  const handler = createHandler({ ...loaders, access: () => ({ client: database(writes), canPersist: false }) });
  const response = await handler({ httpMethod: 'GET' });
  const data = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(data.records[1].price, 40);
  assert.equal(data.records[1].observedAt, '2026-10-27');
  assert.equal(data.persistence, 'memory');
  assert.match(data.warning, /not saved to the database/);
  assert.equal(writes.length, 0);
});
test('configured writer persists both refreshed sources using the restricted RPC', async () => {
  const writes = [];
  const handler = createHandler({ ...loaders, access: () => ({ client: database(writes), canPersist: true }) });
  const data = JSON.parse((await handler({ httpMethod: 'GET' })).body);
  assert.equal(data.persistence, 'database');
  assert.equal(data.warning, '');
  assert.equal(writes.length, 2);
  assert.ok(writes.every(w => w.name === 'replace_price_reference_data'));
  assert.equal(writes.find(w => w.payload.p_catalogues.includes('retail_price')).payload.p_entries[0].data.price, 40);
});
test('initial configuration errors are retryable and do not leak credentials in responses', async () => {
  let failed = true;
  const handler = createHandler({ ...loaders, access: () => {
    if (failed) throw new Error('private diagnostic');
    return { client: database(), canPersist: false };
  } });
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handler({ httpMethod: 'GET' });
    assert.equal(response.statusCode, 503);
    assert.doesNotMatch(response.body, /private diagnostic/);
    failed = false;
    assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 200);
    assert.equal((await handler({ httpMethod: 'POST' })).statusCode, 405);
  } finally { console.error = originalError; }
});
test('read-only feed access does not relax write-script credential requirements', () => {
  const options = { url: 'https://example.supabase.co', serviceKey: '', publicKey: 'public-read-key' };
  assert.equal(createPriceFeedAccess(options).canPersist, false);
  assert.equal(createPriceFeedAccess({ ...options, serviceKey: 'server-key' }).canPersist, true);
  assert.throws(() => createPriceFeedAccess({ ...options, publicKey: '' }), /read key/);
  assert.throws(() => createReferenceDataClient({ url: options.url, key: '' }), /service role key/);
});
