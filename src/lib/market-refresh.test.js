import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMarketSnapshot,
  getMealPlanRecipeIds,
  mealPlanMarketIngredients,
  marketDistanceKm,
} from './market-refresh.js';
function clientFor(tables, failures = {}, seen = []) {
  return {
    from(table) {
      let first = 0;
      let last = 999;
      let recipeIds;
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        range(a, b) {
          first = a;
          last = b;
          return this;
        },
        in(column, ids) {
          assert.equal(column, 'recipe_id');
          recipeIds = ids;
          return this;
        },
        async abortSignal(signal) {
          seen.push({ table, first, last });
          if (signal?.aborted) return { error: new Error('aborted') };
          return failures[table]
            ? { error: new Error('unavailable') }
            : {
                data: (tables[table] || [])
                  .filter((row) => !recipeIds || recipeIds.includes(String(row.recipe_id)))
                  .slice(first, last + 1),
              };
        },
      };
    },
  };
}
test('market refresh retrieves later pages of the underlying ingredient catalogue', async () => {
  const ingredients = Array.from({ length: 1003 }, (_, id) => ({
    id,
    market_id: 1,
    status: 'avail',
  }));
  const seen = [];
  const snapshot = await fetchMarketSnapshot(
    clientFor({ markets: [{ id: 1 }], market_ingredients: ingredients }, {}, seen),
  );
  assert.equal(snapshot.ingredients.length, 1003);
  assert.equal(snapshot.markets.length, 1);
  assert.ok(seen.some((call) => call.table === 'market_ingredients' && call.first === 1e3));
});
test('market refresh retrieves every market and filters store ingredients by selected-day recipes', async () => {
  const markets = [
    { id: 1, name: 'Tarlac City Market', address: 'Tarlac City' },
    { id: 2, name: 'Capas Grocery', address: 'Capas, Tarlac' },
  ];
  const ingredients = [
    { id: 1, market_id: 1, name: 'Bangus' },
    { id: 2, market_id: 1, name: 'Carrot' },
    { id: 3, market_id: 2, name: 'Rice' },
    { id: 4, market_id: 2, name: 'Pork' },
  ];
  const recipeIds = ['fish-meal', 'rice-meal'];
  const seen = [];
  const snapshot = await fetchMarketSnapshot(
    clientFor({
      markets,
      market_ingredients: ingredients,
      recipe_ingredients: [
        { id: 1, recipe_id: 'fish-meal', name: ' Bangus ' },
        { id: 2, recipe_id: 'rice-meal', name: 'Rice' },
        { id: 3, recipe_id: 'other-day', name: 'Pork' },
      ],
    }, {}, seen),
    undefined,
    recipeIds,
  );
  assert.deepEqual(snapshot.markets, markets);
  assert.deepEqual(snapshot.recipeIngredients.map((row) => row.recipe_id), recipeIds);
  const matchedIngredients = mealPlanMarketIngredients(
    snapshot.ingredients,
    snapshot.recipeIngredients,
  );
  assert.deepEqual(
    matchedIngredients.map((row) => `${row.market_id}:${row.name}`),
    ['1:Bangus', '2:Rice'],
  );
  assert.deepEqual(
    [...new Set(seen.map((call) => call.table))].sort(),
    ['market_ingredients', 'markets', 'recipe_ingredients'],
  );
});
test('meal plan recipe IDs are read for the selected day and malformed plans are ignored', () => {
  const values = {
    blane_meal_plan_day: '1',
    blane_meal_plan: JSON.stringify({
      0: [{ mealId: 'breakfast' }],
      1: [{ mealId: 'lunch' }, { mealId: 'lunch' }, { type: 'Snack' }],
    }),
  };
  assert.deepEqual(getMealPlanRecipeIds({ getItem: (key) => values[key] }), ['lunch']);
  assert.deepEqual(getMealPlanRecipeIds({ getItem: () => '{invalid' }), []);
  assert.deepEqual(mealPlanMarketIngredients([{ name: 'Rice' }], []), []);
});
test('a later refresh retrieves changed prices, quantities, availability and market closures', async () => {
  const tables = {
    markets: [{ id: 1, is_open: true }],
    market_ingredients: [{ id: 2, price: 20, qty: '1 kg', status: 'avail' }],
  };
  const client = clientFor(tables);
  const original = await fetchMarketSnapshot(client);
  tables.markets = [{ id: 1, is_open: false }];
  tables.market_ingredients = [{ id: 2, price: 25, qty: '0 kg', status: 'unavail' }];
  const updated = await fetchMarketSnapshot(client);
  assert.equal(updated.markets[0].is_open, false);
  assert.deepEqual(updated.ingredients[0], { id: 2, price: 25, qty: '0 kg', status: 'unavail' });
  assert.equal(original.ingredients[0].price, 20);
});
test('a partial source failure rejects the snapshot instead of publishing empty ingredients', async () => {
  const client = clientFor({ markets: [{ id: 1 }] }, { market_ingredients: true });
  await assert.rejects(fetchMarketSnapshot(client), /market_ingredients/);
});
test('aborted refreshes cannot publish a snapshot after unmount or timeout', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchMarketSnapshot(clientFor({}), controller.signal), /Unable to refresh/);
});
test('market distances use the current origin rather than stored database distance', () => {
  const market = { lat: 15.4858, lng: 120.597 };
  assert.equal(marketDistanceKm(market, market), 0);
  assert.ok(marketDistanceKm({ lat: 15.3333, lng: 120.5894 }, market) > 15);
});
