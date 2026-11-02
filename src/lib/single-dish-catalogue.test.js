import test from 'node:test';
import assert from 'node:assert/strict';
import changes from '../data/single-dish-recipes.js';
import { singleDishRecipeRows, singleDishIngredientRows, singleDishStepRows } from './single-dish-catalogue.js';
test('single-dish changes keep recipe IDs, use recalculated nutrition and remove exact side rows', () => {
  for (const c of changes) {
    const original = { id: c.id, name: c.originalName, kcal: 999, cost: 100 };
    const [updated] = singleDishRecipeRows([original]);
    assert.equal(updated.id, original.id);
    assert.equal(updated.name, c.name);
    assert.equal(updated.kcal, c.kcal);
    assert.ok(c.kcal > 0);
    assert.equal(original.kcal, 999);
    assert.equal(singleDishIngredientRows(c.removedIngredients.map(id => ({ id }))).length, 0);
    const kept = { id: 'new-main-ingredient', recipe_id: c.id };
    assert.equal(singleDishIngredientRows([kept])[0], kept);
  }
});
test('cooking instructions lose side preparation without overwriting later administrator edits', () => {
  const c = changes.find(c => c.id === 'rcp-pandesal-margarine-coffee');
  const step = c.stepUpdates[0];
  const updated = singleDishStepRows([{ id: step.id, description: step.expected }])[0];
  assert.equal(updated.description, step.description);
  assert.doesNotMatch(updated.description, /coffee/i);
  const edited = { id: step.id, description: 'Later administrator instructions' };
  assert.equal(singleDishStepRows([edited])[0], edited);
  const renamed = { id: c.id, name: 'Administrator custom bread', kcal: 400 };
  assert.equal(singleDishRecipeRows([renamed])[0], renamed);
});
