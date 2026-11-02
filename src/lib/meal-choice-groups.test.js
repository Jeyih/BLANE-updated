import test from 'node:test';
import assert from 'node:assert/strict';
import { groupMealChoices, createRecipeOrder, mealChoicePriceText } from './meal-choice-groups.js';
const recipe = (id, type, cost, extra = {}) => ({ id, type, cost, budgetEligible: true, ...extra });
test('display distinguishes provisional estimates and partial subtotals from complete prices', () => {
  assert.deepEqual(mealChoicePriceText(recipe('a', 'Lunch', 40), 50), { amount: 'Est. ₱40.00', detail: 'Within ₱50.00 meal budget' });
  assert.match(mealChoicePriceText(recipe('a', 'Lunch', 40, { needsVerification: true }), 50).amount, /^Provisional/);
  assert.match(mealChoicePriceText(recipe('a', 'Lunch', 40, { priceIncomplete: true }), 50).amount, /^Subtotal/);
  assert.equal(mealChoicePriceText(recipe('a', 'Lunch', null), 50).amount, 'Estimate unavailable');
});
test('selected meal type comes first, with affordable choices before over-budget or incomplete prices', () => {
  const recipes = [recipe('snack', 'Snack', 5), recipe('lunch-over', 'Lunch', 90), recipe('lunch', 'Lunch', 40), recipe('dinner', 'Dinner', 30), recipe('unknown', 'Breakfast', null, { budgetEligible: false })];
  const groups = groupMealChoices(recipes, { mealType: 'Lunch', budget: 50 });
  assert.deepEqual(groups[0].recipes.map(r => r.id), ['lunch', 'lunch-over']);
  assert.deepEqual(groups[1].recipes.map(r => r.id), ['dinner', 'snack']);
  assert.equal(groups.at(-1).key, 'unverified');
  assert.equal(recipes[0].id, 'snack');
});
test('random priorities vary alternatives but stay stable while filtering a search', () => {
  const recipes = [recipe('a', 'Dinner', 10), recipe('b', 'Snack', 20)];
  const priorities = [0.9, 0.1];
  const order = createRecipeOrder(recipes, () => priorities.shift());
  const options = { mealType: 'Lunch', budget: 50, order };
  assert.deepEqual(groupMealChoices(recipes, options)[1].recipes.map(r => r.id), ['b', 'a']);
  assert.deepEqual(groupMealChoices([...recipes].reverse(), options)[1].recipes.map(r => r.id), ['b', 'a']);
});
test('an empty matching section stays explicit instead of mislabelling other meal types', () => {
  const groups = groupMealChoices([recipe('dinner', 'Dinner', 10)], { mealType: 'Lunch', budget: 50 });
  assert.equal(groups[0].title, 'Lunch recipes');
  assert.equal(groups[0].recipes.length, 0);
  assert.equal(groups[1].recipes[0].type, 'Dinner');
});
