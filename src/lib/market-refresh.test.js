import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchMarketSnapshot,
  isTarlacCityMarket,
  getMealPlanRecipeIds,
  mealPlanMarketIngredients,
  marketDistanceKm,
} from './market-refresh.js';
test('market coverage includes explicit Tarlac City records and excludes other municipalities', () => {
  const rows = [
    { id: 'city', address: 'San Roque, Tarlac City, Tarlac' },
    { id: 'city-variant', address: 'City of Tarlac, Philippines' },
    { id: 'structured', city: '  TARLAC CITY ', address: 'San Vicente' },
    { id: 'capas', address: 'Capas, Tarlac' },
    { id: 'paniqui', address: 'Paniqui, Tarlac' },
    { id: 'concepcion', address: 'Concepcion, Tarlac' },
    { id: 'unknown', address: 'Tarlac' },
    { id: 'brand-only', name: 'Tarlac City Grocery', address: 'Capas, Tarlac' },
    { id: 'outside-with-reference', municipality: 'Capas', address: 'Road to Tarlac City' },
    { id: 'missing' },
  ];
  assert.deepEqual(rows.filter(isTarlacCityMarket).map(row => row.id), ['city', 'city-variant', 'structured']);
});
function clientFor(tables, failures = {}, seen = []) {
  return {
    from(table) {
      let first = 0;
      let last = 999;
      let mealIds;
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
          mealIds = ids;
          return this;
        },
        async abortSignal(signal) {
          seen.push({ table, first, last });
          if (signal?.aborted) return { error: new Error('aborted') };
          return failures[table]
            ? { error: new Error('unavailable') }
            : {
                data: (tables[table] || [])
                  .filter((row) => !mealIds || mealIds.includes(String(row.recipe_id)))
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
test('only selected-day recipes determine which market ingredients are displayed', async () => {
  const values = {
    blane_meal_plan_day: '1',
    blane_meal_plan: JSON.stringify({
      0: [{ mealId: 'rice-meal' }],
      1: [{ mealId: 'fish-meal' }, { mealId: 'fish-meal' }],
    }),
  };
  const ids = getMealPlanRecipeIds({ getItem: (key) => values[key] });
  assert.deepEqual(ids, ['fish-meal']);
  const snapshot = await fetchMarketSnapshot(
    clientFor({
      recipe_ingredients: [
        { id: 1, recipe_id: 'fish-meal', name: ' Bangus ' },
        { id: 2, recipe_id: 'rice-meal', name: 'Rice' },
      ],
      market_ingredients: [
        { id: 1, name: 'BANGUS', status: 'limited' },
        { id: 2, name: 'Rice', status: 'avail' },
      ],
    }),
    void 0,
    ids,
  );
  assert.deepEqual(
    mealPlanMarketIngredients(snapshot.ingredients, snapshot.recipeIngredients).map(
      (row) => row.name,
    ),
    ['BANGUS'],
  );
});
test('an empty, invalid or unplanned day never falls back to displaying every ingredient', () => {
  const ingredients = [{ name: 'Rice' }];
  assert.deepEqual(mealPlanMarketIngredients(ingredients, []), []);
  assert.deepEqual(getMealPlanRecipeIds({ getItem: () => '{invalid' }), []);
  const values = { blane_meal_plan_day: '2', blane_meal_plan: '{"0":[{"mealId":"other-day"}]}' };
  assert.deepEqual(getMealPlanRecipeIds({ getItem: (key) => values[key] }), []);
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
