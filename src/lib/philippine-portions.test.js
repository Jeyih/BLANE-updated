import test from 'node:test';
import assert from 'node:assert/strict';
import { documentedPurchaseAmount } from './philippine-portions.js';
import { applyDynamicRecipePrices, ingredientPriceAudit } from './pricing.js';

const da = (name, price) => ({ name, price, unit: 'kg', kind: 'reference', sourceUrl: 'https://www.da.gov.ph/report.pdf' });
test('published FNRI portion weights replace equal raw/cooked weight for exactly matched foods', () => {
  const recipe = { servings: 1, ingredients: [{ name: 'Carrot, boiled', grams: 45, quantity: '~1/2 cup' }] };
  const [priced] = applyDynamicRecipePrices([recipe], [da('Carrot', 100)]);
  assert.equal(priced.cost, 5.1, '45g edible carrot uses FNRI 51g as-purchased reference');
  assert.equal(priced.budgetEligible, true);
  assert.equal(priced.pricingSource, 'FNRI portion estimate');
  assert.equal(priced.ingredients[0].priceRecords[0].purchaseGrams, 51);
  assert.match(priced.ingredients[0].priceRecords[0].conversionSourceUrl, /^https:\/\/marfel.fnri.dost.gov.ph\//);
  assert.equal(applyDynamicRecipePrices([recipe], [da('Carrot', 200)])[0].cost, 10.2);
  const audit = ingredientPriceAudit('Carrot, boiled', recipe.ingredients, [da('Carrot', 100)]);
  assert.equal(audit.evidence.label, 'FNRI-supported portion estimate');
  assert.equal(audit.conversionSources.length, 1);
});
test('FNRI conversion does not invent absent weights, cooked dishes, pieces or seafood yields', () => {
  const raw = { unit: 'kg', estimateType: 'raw' };
  for (const name of ['Rice, well-milled, boiled', 'Potato, boiled', 'Eggplant, boiled', 'Crab, blue swimming, w/o fat, boiled']) {
    assert.equal(documentedPurchaseAmount(name, 100, raw), null);
  }
  assert.equal(documentedPurchaseAmount('Carrot, boiled', 100, { ...raw, partial: true }), null);
  assert.equal(documentedPurchaseAmount('Carrot, boiled', 100, { ...raw, unit: 'pc' }), null);
  assert.equal(documentedPurchaseAmount('Carrot, boiled', NaN, raw), null);
  assert.equal(documentedPurchaseAmount('Carrot, boiled', 0, raw), null);
});
test('FNRI portion support does not erase product identity or other unresolved notes', () => {
  const quote = { ...da('Cabbage, green, boiled', 100), estimateType: 'raw', notes: 'Unknown cultivar and edible portion.' };
  const [meal] = applyDynamicRecipePrices([{ ingredients: [{ name: quote.name, grams: 45 }] }], [quote]);
  assert.equal(meal.cost, 6.4);
  assert.equal(meal.budgetEligible, false);
});
