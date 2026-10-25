import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPriceReferenceRows } from './price-reference.js';

test('groups database price rows and restores structured mapping and portion data', () => {
  const data = groupPriceReferenceRows([
    {
      catalogue: 'da_price',
      entry_key: '001:Tomato',
      data: { name: 'Tomato', price: 80 },
    },
    {
      catalogue: 'da_report',
      entry_key: 'latest',
      data: { observedAt: '2026-10-11' },
    },
    {
      catalogue: 'price_alias',
      entry_key: 'kamatis',
      data: { target: 'tomato' },
    },
    {
      catalogue: 'partial_raw_food',
      entry_key: 'Rice, well-milled, fried',
      data: {},
    },
    {
      catalogue: 'fnri_portion',
      entry_key: 'Carrot, boiled',
      data: { apGrams: 51, epGrams: 45 },
    },
    {
      catalogue: 'fnri_portion_meta',
      entry_key: 'source',
      data: { sourceUrl: 'https://fnri.example/portion' },
    },
  ]);

  assert.deepEqual(data.daSnapshot, {
    records: [{ name: 'Tomato', price: 80 }],
    report: { observedAt: '2026-10-11' },
  });
  assert.deepEqual(data.aliases, { kamatis: 'tomato' });
  assert.equal(data.partialRawFoods.has('Rice, well-milled, fried'), true);
  assert.deepEqual(data.fnriPortions['Carrot, boiled'], { apGrams: 51, epGrams: 45 });
  assert.equal(data.fnriPortionMeta.sourceUrl, 'https://fnri.example/portion');
});
