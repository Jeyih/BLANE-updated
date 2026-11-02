import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonalCleanupPlan, deleteSeasonalRows } from './seasonal-cleanup.js';
const quote = { name: 'Rice', kind: 'reference', verified: true, currency: 'PHP', sourceCountry: 'PH', price: 50, unit: 'kg', sourceUrl: 'https://www.da.gov.ph/rice.pdf' };
test('cleanup keeps only priced ingredients used in current recipes', () => {
  const seasons = [{ id: 'rice', ingredient_name: 'Rice' }, { id: 'unused', ingredient_name: 'Potato' }, { id: 'unpriced', ingredient_name: 'Carrot' }];
  const result = seasonalCleanupPlan(seasons, [{ name: 'Rice' }, { name: 'Carrot' }], [quote]);
  assert.deepEqual(result.keep.map(row => row.id), ['rice']);
  assert.deepEqual(result.remove.map(row => row.cleanupReason), ['Not used in current recipes', 'No matching price reference']);
  assert.equal(seasons.length, 3);
  assert.throws(() => seasonalCleanupPlan(seasons, [], [quote]), /Load recipe ingredients/);
});
test('deletion touches only seasonal rows and respects the reviewed IDs in batches', async () => {
  const calls = [];
  const client = { from(table) { assert.equal(table, 'ingredient_seasons'); return { delete() { return { in(column, ids) {
    assert.equal(column, 'id'); calls.push([...ids]); return { select: async () => ({ data: ids.map(id => ({ id })), error: null }) };
  } }; } }; } };
  const ids = Array.from({ length: 52 }, (_, i) => `season-${i}`);
  assert.equal(await deleteSeasonalRows(client, [...ids, ids[0]]), 52);
  assert.deepEqual(calls.map(batch => batch.length), [50, 2]);
  assert.deepEqual(calls.flat(), ids);
});
test('cleanup stops on deletion failure instead of reporting success', async () => {
  const client = { from: () => ({ delete: () => ({ in: () => ({ select: async () => ({ error: { message: 'Permission denied' } }) }) }) }) };
  await assert.rejects(deleteSeasonalRows(client, ['one']), /Removed 0.*Permission denied/);
});
