import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../public/data/ingredient-prices.json' with { type: 'json' };
import retailSnapshot from '../public/data/retail-prices.json' with { type: 'json' };
import { reportLinks, parseDaRows } from './da-prices.js';
import { handler } from '../netlify/functions/ingredient-prices.mjs';

test('selects the newest completed report across month and year boundaries', () => {
  const link = (label) => `<a href="https://www.da.gov.ph/Weekly-Average-Prices-${label}.pdf">${label}</a>`;
  const result = reportLinks(link('October 5-11, 2026') + link('September 28-October 4, 2026') + link('October 12-18, 2026'), Date.parse('2026-10-14'));
  assert.equal(result[0].observedAt, '2026-10-11');
  assert.equal(result[1].observedAt, '2026-10-04');
  assert.equal(reportLinks(link('December 29, 2025 - January 3, 2026'), Date.parse('2026-10-14'))[0].observedAt, '2026-01-03');
});

test('imported snapshot preserves verified units, local rice section, and observation date', () => {
  assert.equal(snapshot.records.length, 36);
  assert.equal(snapshot.report.observedAt, '2026-10-11');
  const byName = new Map(snapshot.records.map((p) => [p.name, p]));
  assert.equal(byName.get('White rice').price, 48.42);
  assert.equal(byName.get('Egg').unit, 'pc');
  assert.equal(byName.get('Palm oil').price, 101.99);
  assert.equal(byName.get('Palm oil').unit, 'l');
  assert.ok(snapshot.records.every((p) => p.region === 'NCR' && p.price > 0 && p.sourceUrl === snapshot.report.url));
  const lines = ['LOCAL COMMERCIAL RICE', ...snapshot.records.map((p) => `${p.description} ${p.unit === 'l' ? 'L' : p.unit} ${p.price.toFixed(2)}`)];
  assert.equal(parseDaRows(lines, snapshot.report).length, 36);
});

test('changed PDF format fails closed; feed falls back with a visible warning', async () => {
  assert.throws(() => parseDaRows(['Tomato kg -'], snapshot.report));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Offline'); };
  try {
    const result = await handler({ httpMethod: 'GET' });
    const body = JSON.parse(result.body);
    assert.equal(result.statusCode, 200);
    assert.equal(body.status, 'cached');
    assert.ok(body.warning);
    assert.equal(body.records.length, snapshot.records.length + retailSnapshot.records.length);
    assert.deepEqual(body.records.filter((p) => p.sourceType !== 'retailer'), snapshot.records);
    assert.ok(body.records.filter((p) => p.sourceType === 'retailer').every((p) => p.verified && p.observedAt));
    assert.equal((await handler({ httpMethod: 'POST' })).statusCode, 405);
  } finally { globalThis.fetch = originalFetch; }
});
