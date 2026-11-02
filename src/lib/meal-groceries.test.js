import test from 'node:test';
import assert from 'node:assert/strict';
import { groceryRecipeGroups, groceryRows, replaceGrocerySources, groceryText } from './meal-groceries.js';

test('shared groceries retain recipe names and per-recipe actions use original indices', () => {
  const items = replaceGrocerySources([], [
    { key: 'monday-lunch', label: 'Monday Lunch', meal: { id: 1, name: 'Vegetable Soup', ingredients: [{ name: 'Carrot', qty: '100 g' }] } },
    { key: 'tuesday-dinner', label: 'Tuesday Dinner', meal: { id: 2, name: 'Carrot Stew', ingredients: [{ name: 'Carrot', qty: '50 g' }] } },
  ]);
  assert.equal(groceryRows(items)[0].qty, '150 g');
  assert.deepEqual(groceryRows(items)[0].recipeNames, ['Vegetable Soup', 'Carrot Stew']);
  const groups = groceryRecipeGroups(items);
  assert.deepEqual(groups[1].items[0].indices, [1]);
  assert.equal(groups[1].name, 'Carrot Stew');
  const legacy = groceryRecipeGroups([{ mealId: 1, name: 'Carrot', qty: '100 g' }], [{ id: 1, name: 'Vegetable Soup' }]);
  assert.equal(legacy[0].name, 'Vegetable Soup');
});

test('grocery download puts each recipe before its ingredients and removes Adapted', () => {
  assert.equal(groceryText([
    { sourceKey: 'lunch', recipeName: 'Vegetable Oat Porridge (Adapted)', name: 'Oats', qty: '60 g before cooking' },
    { sourceKey: 'lunch', recipeName: 'Vegetable Oat Porridge (Adapted)', name: 'Carrot', qty: '100 g before cooking', checked: true },
  ]), 'For: Vegetable Oat Porridge\n[ ] Oats (60 g before cooking)\n[x] Carrot (100 g before cooking)');
});
