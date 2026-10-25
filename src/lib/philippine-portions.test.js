import test from 'node:test';
import assert from 'node:assert/strict';
import { documentedPurchaseAmount } from './philippine-portions.js';
import { applyDynamicRecipePrices, ingredientPriceAudit } from './pricing.js';
const da = (name, price) => ({
  name,
  price,
  unit: 'kg',
  kind: 'reference',
  sourceUrl: 'https://www.da.gov.ph/report.pdf',
});
const referenceData = {
  rawDaMappings: {
    'Carrot, boiled': 'Carrot',
    'Cabbage, green, boiled': 'Cabbage',
    'Squash fruit, boiled': 'Squash',
    'String/Yard long bean pod, green, boiled': 'Sitaw',
  },
  fnriPortions: {
    'Carrot, boiled': { apGrams: 51, epGrams: 45 },
    'Cabbage, green, boiled': { apGrams: 64, epGrams: 45 },
    'Squash fruit, boiled': { apGrams: 52, epGrams: 45, sourceName: 'Squash, fruit, boiled' },
    'String/Yard long bean pod, green, boiled': { apGrams: 42, epGrams: 45 },
  },
  fnriPortionMeta: {
    sourceUrl: 'https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=1',
    definitionsUrl: 'https://marfel.fnri.dost.gov.ph/marfel-faqs',
  },
};
test('published FNRI portion weights replace equal raw/cooked weight for exactly matched foods', () => {
  const recipe = {
    servings: 1,
    ingredients: [{ name: 'Carrot, boiled', grams: 45, quantity: '~1/2 cup' }],
  };
  const [priced] = applyDynamicRecipePrices([recipe], [da('Carrot', 100)], referenceData);
  assert.equal(priced.cost, 5.1, '45g edible carrot uses FNRI 51g as-purchased reference');
  assert.equal(priced.budgetEligible, true);
  assert.equal(priced.pricingSource, 'FNRI portion estimate');
  assert.equal(priced.ingredients[0].priceRecords[0].purchaseGrams, 51);
  assert.match(
    priced.ingredients[0].priceRecords[0].conversionSourceUrl,
    /^https:\/\/marfel.fnri.dost.gov.ph\//,
  );
  assert.equal(
    applyDynamicRecipePrices([recipe], [da('Carrot', 200)], referenceData)[0].cost,
    10.2,
  );
  const audit = ingredientPriceAudit(
    'Carrot, boiled',
    recipe.ingredients,
    [da('Carrot', 100)],
    referenceData,
  );
  assert.equal(audit.evidence.label, 'FNRI-supported portion estimate');
  assert.equal(audit.conversionSources.length, 1);
});
test('FNRI conversion does not invent absent weights, cooked dishes, pieces or seafood yields', () => {
  const raw = { unit: 'kg', estimateType: 'raw' };
  for (const name of [
    'Rice, well-milled, boiled',
    'Potato, boiled',
    'Eggplant, boiled',
    'Crab, blue swimming, w/o fat, boiled',
  ]) {
    assert.equal(documentedPurchaseAmount(name, 100, raw, referenceData.fnriPortions), null);
  }
  assert.equal(
    documentedPurchaseAmount(
      'Carrot, boiled',
      100,
      { ...raw, partial: true },
      referenceData.fnriPortions,
    ),
    null,
  );
  assert.equal(
    documentedPurchaseAmount(
      'Carrot, boiled',
      100,
      { ...raw, unit: 'pc' },
      referenceData.fnriPortions,
    ),
    null,
  );
  assert.equal(
    documentedPurchaseAmount('Carrot, boiled', NaN, raw, referenceData.fnriPortions),
    null,
  );
  assert.equal(
    documentedPurchaseAmount('Carrot, boiled', 0, raw, referenceData.fnriPortions),
    null,
  );
});
test('FNRI portion support does not erase product identity or other unresolved notes', () => {
  const quote = {
    ...da('Cabbage, green, boiled', 100),
    estimateType: 'raw',
    notes: 'Unknown cultivar and edible portion.',
  };
  const [meal] = applyDynamicRecipePrices(
    [{ ingredients: [{ name: quote.name, grams: 45 }] }],
    [quote],
    referenceData,
  );
  assert.equal(meal.cost, 6.4);
  assert.equal(meal.budgetEligible, false);
});
