import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortionPreview } from './manual-portions.js';
import { appliedMeal } from './portions.js';
const profile = { age: 25, sex: 'male', height_cm: 170, weight_kg: 70, goal: 'maintain', activity_level: 'moderate' };
const meal = { id: 'meal', kcal: 400, protein: 20, carbs: 50, fats: 10, cost: 31.25, ingredients: [{ name: 'Rice', quantity: '60 g before cooking', grams: 60 }] };
test('manual portion stays at the chosen scale regardless of calorie target', () => {
  const result = buildPortionPreview(meal, 4, profile, 0.75);
  assert.equal(result.scaleFactor, 0.75);
  assert.equal(result.optimizedKcal, 300);
  assert.equal(result.cost, 23.44);
  assert.equal(result.ingredients[0].optimized, '45 g before cooking');
  assert.equal(buildPortionPreview(meal, 2, { ...profile, weight_kg: 100 }, 0.75).scaleFactor, 0.75);
  assert.equal(buildPortionPreview(meal, 4, profile).scaleFactor, 1);
  assert.equal(meal.ingredients[0].grams, 60);
});
test('manual preview matches applied totals and preserves unavailable prices', () => {
  const result = buildPortionPreview(meal, 4, profile, 1.5);
  const applied = appliedMeal(meal, result);
  assert.equal(applied.kcal, result.optimizedKcal);
  assert.equal(applied.protein, result.optimized.protein);
  assert.equal(applied.cost, result.cost);
  assert.equal(applied.ingredients[0].grams, 90);
  assert.equal(buildPortionPreview({ ...meal, cost: null }, 4, profile, 2).cost, null);
});
test('manual portion bounds and missing values never produce an automatic target-based scale', () => {
  assert.equal(buildPortionPreview(meal, 4, profile, 10).scaleFactor, 2);
  assert.equal(buildPortionPreview(meal, 4, profile, 0.1).scaleFactor, 0.5);
  assert.equal(buildPortionPreview(meal, 4, profile, NaN).scaleFactor, 1);
});
