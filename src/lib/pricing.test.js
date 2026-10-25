import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDynamicRecipePrices as applyRecipes,
  normalizeMarketPrices,
  parsePriceQuantity,
  parseRecipeQuantity,
  priceIngredient as priceIngredientImpl,
  loadAllPriceRows,
  priceCoverage as priceCoverageImpl,
  marketIngredientPriceText as marketIngredientPriceTextImpl,
  ingredientQuote as ingredientQuoteImpl,
  priceEvidence,
  ingredientPriceAudit as ingredientPriceAuditImpl,
} from './pricing.js';
const reference = (name, price, unit = 'kg') => ({
  name,
  price,
  unit,
  kind: 'reference',
  region: 'NCR',
  sourceUrl: 'https://www.da.gov.ph/report.pdf',
});
const referenceData = {
  aliases: {
    malunngay: 'malunggay leaves',
    malunggay: 'malunggay leaves',
    'moringa leaves': 'malunggay leaves',
    kamatis: 'tomato',
    eggs: 'egg',
  },
  rawDaMappings: {
    'Egg, chicken, whole, boiled': 'Egg',
    'Carrot, boiled': 'Carrot',
    'Potato, boiled': 'Potato',
    'Rice, well-milled, boiled': 'White rice',
    'Rice, well-milled, fried': 'White rice',
  },
  daNameMappings: { 'Onion, Bombay bulb': 'Red onion', 'Garlic bulb': 'Local garlic' },
  comparablePriceMappings: {
    'Pork, suckling, leg': {
      name: 'Pork shoulder',
      note: 'Regular pork shoulder (kasim) benchmark; not a verified suckling-pig leg price.',
    },
    'Duck liver': {
      name: 'Chicken liver',
      note: 'Ordinary chicken-liver benchmark; not a verified duck-liver price.',
    },
    'Lima bean pod, boiled': {
      name: 'Baguio beans',
      note: 'Fresh green-bean pod benchmark; not a verified lima-bean pod price. Cooking yield is excluded.',
    },
    'Quail meat': {
      name: 'Whole chicken',
      note: 'Local poultry benchmark using whole chicken; not a verified quail price. Species and edible yields differ.',
    },
    'Duck breast': {
      name: 'Whole duck',
      note: 'Whole-duck benchmark including bone and other cuts; not a verified boneless breast price. Edible yield is excluded.',
    },
  },
  partialRawFoods: new Set(['Rice, well-milled, fried']),
  fnriPortions: {
    'Carrot, boiled': { apGrams: 51, epGrams: 45 },
  },
  fnriPortionMeta: {
    sourceUrl: 'https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=1',
    definitionsUrl: 'https://marfel.fnri.dost.gov.ph/marfel-faqs',
  },
};
function applyDynamicRecipePrices(recipes, prices, references = referenceData) {
  return applyRecipes(recipes, prices, references);
}
function priceIngredient(ingredient, prices, references = referenceData) {
  return priceIngredientImpl(ingredient, prices, references);
}
function priceCoverage(foods, recipeIngredients, prices, references = referenceData) {
  return priceCoverageImpl(foods, recipeIngredients, prices, references);
}
function marketIngredientPriceText(ingredient, prices, references = referenceData) {
  return marketIngredientPriceTextImpl(ingredient, prices, references);
}
function ingredientQuote(name, prices, references = referenceData) {
  return ingredientQuoteImpl(name, prices, references);
}
function ingredientPriceAudit(name, ingredients, prices, references = referenceData) {
  return ingredientPriceAuditImpl(name, ingredients, prices, references);
}
test('exact ingredient quotes supersede comparable benchmarks and remain dynamic', () => {
  const benchmark = reference('Whole duck', 598);
  const actual = {
    ...reference('Duck breast', 900),
    sourceType: 'retailer',
    verified: true,
    sourceUrl: 'https://www.thesausageguy.shop/panglao/poultry',
    estimateType: 'product',
    currency: 'PHP',
    sourceCountry: 'PH',
  };
  const recipe = { ingredients: [{ name: 'Duck breast', grams: 100 }], servings: 1 };
  const [priced] = applyDynamicRecipePrices([recipe], [benchmark, actual]);
  assert.equal(priced.cost, 90);
  assert.equal(priced.budgetEligible, true);
  assert.equal(priced.comparableEstimate, false);
  assert.equal(ingredientQuote('Duck breast', [benchmark, actual]).price, 900);
  assert.equal(
    applyDynamicRecipePrices([recipe], [benchmark, { ...actual, price: 950 }])[0].cost,
    95,
  );
  const [fallback] = applyDynamicRecipePrices([recipe], [benchmark]);
  assert.equal(fallback.cost, 59.8);
  assert.equal(fallback.budgetEligible, false);
});
test('market cards and scanner resolve the recorded malunggay typo and update prices', () => {
  const quote = {
    name: 'Malunggay leaves',
    price: 110,
    unit: 'kg',
    kind: 'reference',
    sourceType: 'retailer',
    verified: true,
    sourceUrl: 'https://shopmetro.ph/product/malunggay',
  };
  for (const name of ['Malunngay', 'Malunggay', 'Malunggay leaves', 'Moringa leaves']) {
    assert.equal(
      marketIngredientPriceText({ name }, [quote]),
      'Estimated reference \u20B1110.00 / kg',
    );
    assert.equal(ingredientQuote(name, [quote]).price, 110);
  }
  assert.equal(
    marketIngredientPriceText({ name: 'Malunngay' }, [{ ...quote, price: 120 }]),
    'Estimated reference \u20B1120.00 / kg',
  );
  assert.equal(
    ingredientQuote('Malunggay leaves powder, dry', [quote]),
    null,
    'Fresh leaves must not price dry powder',
  );
  assert.equal(
    marketIngredientPriceText({ name: 'Unknown ingredient' }, [quote]),
    'Sourced price unavailable',
  );
});
test('converts weight, liquids, pieces, and fractions without guessing cup weights', () => {
  assert.deepEqual(parsePriceQuantity('250 g'), { amount: 0.25, unit: 'kg' });
  assert.deepEqual(parsePriceQuantity('1/2 kg'), { amount: 0.5, unit: 'kg' });
  assert.deepEqual(parsePriceQuantity('1\xBD kg'), { amount: 1.5, unit: 'kg' });
  assert.deepEqual(parsePriceQuantity('350 ml'), { amount: 0.35, unit: 'l' });
  assert.deepEqual(parsePriceQuantity('2 pcs'), { amount: 2, unit: 'pc' });
  for (const value of ['1 cup', 'to taste', '0 g', '1/0 kg', '', null])
    assert.equal(parsePriceQuantity(value), null);
});
test('reads admin price/qty rows and excludes unavailable and zero quotes in every location', () => {
  const rows = normalizeMarketPrices(
    [
      { market_id: 1, name: 'Tomato', qty: '500 g', price: 60, status: 'avail' },
      { market_id: 1, name: 'Tomato', qty: '1 kg', price: 0 },
      { market_id: 1, name: 'Tomato', qty: '1 kg', price: 20, status: 'unavail' },
      { market_id: 2, name: 'Tomato', qty: '1 kg', price: 30 },
    ],
    [
      { id: 1, name: 'Public Market', address: 'Tarlac City' },
      { id: 2, name: 'Capas Grocery', address: 'Capas, Tarlac' },
    ],
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, 120);
  assert.equal(rows[0].unit, 'kg');
  assert.equal(rows[1].price, 30);
  assert.equal(rows[1].region, 'Capas, Tarlac');
});
test('approximate household recipe quantities support cups, compound spoons, and pieces', () => {
  assert.equal(parseRecipeQuantity('~scant 1/2 cup').amount, 0.12);
  assert.match(parseRecipeQuantity('~scant 1/2 cup').note, /upper approximation/);
  assert.equal(parseRecipeQuantity('~1 tbsp + 1 tsp').amount, 0.02);
  assert.equal(parseRecipeQuantity('~2 teaspoons').amount, 0.01);
  assert.equal(parseRecipeQuantity('~2 eggs').amount, 2);
  assert.equal(parseRecipeQuantity('~1 piece').unit, 'pc');
  assert.equal(parseRecipeQuantity(100).amount, 0.1);
  for (const qty of [
    '~3 quail portions',
    '~1 small breast portion',
    '1 cup + 2 eggs',
    'scant 1/0 cup',
    'to taste',
    '-1 cup',
  ]) {
    assert.equal(parseRecipeQuantity(qty), null);
  }
  assert.equal(
    parsePriceQuantity('1 cup'),
    null,
    'Recipe cups must not become a retail pack weight',
  );
});
test('chicken curry is costable with its recorded scant cup quantity and updates with the feed', () => {
  const recipe = {
    servings: 2,
    ingredients: [
      { name: 'Chicken, white meat, boiled', grams: 150 },
      { name: 'Potato, boiled', grams: 100 },
      { name: 'Carrot, boiled', grams: 50 },
      { name: 'Coconut milk', grams: 100, quantity: '~scant 1/2 cup' },
      { name: 'Onion, Bombay bulb', grams: 20 },
      { name: 'Garlic bulb', grams: 5 },
    ],
  };
  const prices = [
    reference('Chicken, white meat, boiled', 400),
    reference('Potato', 100),
    reference('Carrot', 100),
    reference('Coconut milk', 200, 'l'),
    reference('Red onion', 100),
    reference('Local garlic', 200),
  ];
  const [meal] = applyDynamicRecipePrices([recipe], prices);
  assert.equal(
    meal.cost,
    51.34,
    'Carrot uses the documented FNRI purchase portion rather than equal raw/cooked weight',
  );
  assert.equal(
    meal.ingredients[3].cost,
    24,
    'Uses recipe volume, not an assumed 100g = 100ml density',
  );
  assert.equal(meal.quantityEstimated, true);
  assert.match(meal.ingredients[3].priceRecords[0].notes, /240 ml/);
  const [updated] = applyDynamicRecipePrices(
    [recipe],
    prices.map((p) => (p.name === 'Coconut milk' ? { ...p, price: 300 } : p)),
  );
  assert.equal(updated.cost, 57.34);
});
test('unverified local quotes are excluded; sourced costs are calculated per serving', () => {
  const prices = [
    { name: 'tomato', price: 120, unit: 'kg', kind: 'local' },
    reference('tomato', 80),
    reference('egg', 8.25, 'pc'),
  ];
  const [recipe] = applyDynamicRecipePrices(
    [
      {
        cost: 999,
        servings: 2,
        ingredients: [
          { name: 'Kamatis', grams: 250 },
          { name: 'Eggs', quantity: '2 pcs', grams: 120 },
        ],
      },
    ],
    prices,
  );
  assert.equal(recipe.ingredients[0].cost, 20);
  assert.equal(recipe.ingredients[1].cost, 16.5);
  assert.equal(recipe.cost, 18.25);
  assert.equal(recipe.pricingSource, 'reference');
});
test('price refresh changes meal cost and original records remain untouched', () => {
  const recipes = [{ servings: 1, ingredients: [{ name: 'tomato', grams: 250 }] }];
  const [first] = applyDynamicRecipePrices(recipes, [reference('tomato', 100)]);
  const [second] = applyDynamicRecipePrices(recipes, [reference('tomato', 200)]);
  assert.equal(first.cost, 25);
  assert.equal(second.cost, 50);
  assert.equal(recipes[0].ingredients[0].cost, void 0);
});
test('missing prices never fall back to an unverified saved total', () => {
  const [meal] = applyDynamicRecipePrices(
    [
      {
        cost: 100,
        ingredients: [
          { name: 'Tomato', grams: 250 },
          { name: 'Mystery', grams: 100 },
        ],
      },
    ],
    [reference('tomato', 120)],
  );
  assert.equal(meal.cost, null);
  assert.equal(meal.ingredients[0].cost, 30);
  assert.equal(meal.ingredients[1].cost, null);
  assert.equal(meal.pricingSource, 'unavailable');
  assert.equal(meal.budgetEligible, false);
  const [unknown] = applyDynamicRecipePrices(
    [{ cost: 0, ingredients: [{ name: 'Mystery', grams: 100 }] }],
    [],
  );
  assert.equal(unknown.cost, null);
});
test('approved raw references are labeled and base-only costs are not budget eligible', () => {
  const [boiled, fried] = applyDynamicRecipePrices(
    [
      { ingredients: [{ name: 'Rice, well-milled, boiled', grams: 100 }] },
      { ingredients: [{ name: 'Rice, well-milled, fried', grams: 100 }] },
    ],
    [reference('White rice', 50)],
  );
  assert.equal(boiled.cost, 5);
  assert.equal(boiled.pricingSource, 'raw estimate');
  assert.equal(fried.cost, 5);
  assert.equal(fried.pricingSource, 'partial');
  assert.equal(fried.budgetEligible, false);
});
test('grams do not become invented piece counts or liquid volumes', () => {
  const priced = priceIngredient({ name: 'Egg, chicken, whole, boiled', grams: 60 }, [
    reference('Egg', 8.25, 'pc'),
  ]);
  assert.equal(priced.cost, null);
  assert.equal(priced.priceRecords[0].unit, 'pc');
  assert.equal(
    priceIngredient({ name: 'Milk', grams: 100 }, [reference('Milk', 100, 'l')]).cost,
    null,
  );
  const [invalid] = applyDynamicRecipePrices(
    [{ cost: 40, ingredients: [{ name: 'Tomato', grams: 100 }] }],
    [{ name: 'Tomato', kind: 'reference', price: 100, unit: 'kg' }],
  );
  assert.equal(invalid.cost, null);
});
test('does not price chicken breast as whole chicken or cooked rice as uncooked rice', () => {
  assert.equal(
    priceIngredient({ name: 'Chicken breast', grams: 100 }, [reference('whole chicken', 200)]).cost,
    null,
  );
  assert.equal(
    priceIngredient({ name: 'Cooked rice', grams: 100 }, [reference('white rice', 50)]).cost,
    null,
  );
  assert.equal(
    priceIngredient({ name: 'Tomato', grams: 100 }, [reference('tomato', Infinity)]).cost,
    null,
  );
});
test('rare ingredient budgeting uses labeled comparable local products and live prices', () => {
  const foods = [
    'Pork, suckling, leg',
    'Duck liver',
    'Lima bean pod, boiled',
    'Quail meat',
    'Duck breast',
  ];
  const prices = [
    reference('Pork shoulder', 300),
    reference('Chicken liver', 219),
    reference('Baguio beans', 100),
    reference('Whole chicken', 200),
    reference('Whole duck', 598),
  ];
  const recipes = foods.map((name) => ({ ingredients: [{ name, grams: 100 }] }));
  const meals = applyDynamicRecipePrices(recipes, prices);
  assert.deepEqual(
    meals.map((r) => r.cost),
    [30, 21.9, 10, 20, 59.8],
  );
  assert.ok(meals.every((r) => r.pricingSource === 'comparable estimate'));
  assert.ok(
    meals.every((r) => !r.budgetEligible),
    'A different-product benchmark must not certify affordability',
  );
  assert.ok(meals.every((r) => /not a verified/.test(r.ingredients[0].priceRecords[0].notes)));
  assert.deepEqual(
    meals.map((r) => r.ingredients[0].name),
    foods,
    'Price comparison never changes recipe or nutritional identity',
  );
  const [updated] = applyDynamicRecipePrices(
    [recipes[0]],
    prices.map((p) => (p.name === 'Pork shoulder' ? { ...p, price: 350 } : p)),
  );
  assert.equal(updated.cost, 35);
  assert.equal(
    priceIngredient({ name: 'Duck liver', grams: 100 }, []).cost,
    null,
    'No benchmark means no invented price',
  );
});
test('Philippine raw rice/oat references remain labeled assumptions without foreign yield factors', () => {
  const recipes = [
    {
      ingredients: [
        { name: 'Rice, well-milled, boiled', grams: 200, quantity: '~1 1/4 cups cooked' },
      ],
    },
  ];
  const [meal] = applyDynamicRecipePrices(recipes, [reference('White rice', 60)]);
  assert.equal(meal.cost, 12);
  assert.equal(meal.pricingSource, 'raw estimate');
  assert.equal(meal.budgetEligible, false);
  assert.equal(meal.ingredients[0].priceRecords[0].conversionSourceUrl, void 0);
  const oats = priceIngredient(
    { name: 'Oats, quick-cooking, ckd', grams: 200, quantity: '~1 cup cooked' },
    [{ ...reference('Oats, quick-cooking, ckd', 200), estimateType: 'raw' }],
  );
  assert.equal(oats.cost, 40);
  assert.equal(oats.evidence.label, 'Raw/cooked assumption');
});
test('foreign prices and currencies cannot enter Philippine recipe costs', () => {
  for (const row of [
    { ...reference('Tomato', 100), currency: 'USD' },
    { ...reference('Tomato', 100), sourceCountry: 'US' },
    { ...reference('Tomato', 100), sourceUrl: 'https://www.usda.gov/prices' },
  ]) {
    assert.equal(priceIngredient({ name: 'Tomato', grams: 100 }, [row]).cost, null);
  }
  assert.equal(
    priceIngredient({ name: 'Tomato', grams: 100 }, [
      { ...reference('Tomato', 100), currency: 'PHP', sourceCountry: 'PH' },
    ]).cost,
    10,
  );
});
test('a verified product source does not erase mapping or preparation assumptions', () => {
  assert.equal(priceEvidence([reference('Tomato', 100)]).needsReview, false);
  assert.equal(
    priceEvidence([{ ...reference('Rice', 50), estimateType: 'raw' }]).needsReview,
    true,
  );
  assert.equal(
    priceEvidence([{ ...reference('Crab', 500), notes: 'Shell-on weight; edible yield unknown.' }])
      .needsReview,
    true,
  );
  const row = ingredientPriceAudit(
    'Quail meat',
    [{ name: 'Quail meat', grams: 100 }],
    [reference('Whole chicken', 200)],
  );
  assert.equal(row.evidence.label, 'Different-product assumption');
  assert.match(row.assumptions[0], /not a verified quail price/);
});
test('loads every database page, including prices beyond the default 1000-row limit', async () => {
  const source = Array.from({ length: 3031 }, (_, id) => ({ id }));
  const calls = [];
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          range: async (start, end) => {
            calls.push(start);
            return { data: source.slice(start, end + 1), error: null };
          },
        }),
      }),
    }),
  };
  const result = await loadAllPriceRows(client, 'market_ingredients');
  assert.equal(result.length, 3031);
  assert.deepEqual(calls, [0, 1e3, 2e3, 3e3]);
  const failing = {
    from: () => ({
      select: () => ({ order: () => ({ range: async () => ({ data: null, error: {} }) }) }),
    }),
  };
  await assert.rejects(loadAllPriceRows(failing, 'market_ingredients'));
});
test('distinguishes full catalogue coverage, unique recipe ingredients, and repeated quantities', () => {
  const result = priceCoverage(
    [
      { fct_id: '1', food_name: 'Tomato' },
      { fct_id: '2', food_name: 'Mystery' },
      { fct_id: '3', food_name: 'Carrot' },
    ],
    [
      { name: 'Tomato', fct_id: '1', grams: 100 },
      { name: 'Tomato', fct_id: '1', grams: 200 },
      { name: 'Mystery', fct_id: '2', grams: 100 },
    ],
    [reference('Tomato', 100)],
  );
  assert.equal(result.total, 3);
  assert.equal(result.priced, 1);
  assert.equal(result.recipeUnique, 2);
  assert.equal(result.recipePriced, 1);
  assert.equal(result.recipeEntries, 3);
  assert.equal(result.recipeEntriesPriced, 2);
  assert.equal(result.catalogue.filter((f) => f.inRecipes).length, 2);
});
