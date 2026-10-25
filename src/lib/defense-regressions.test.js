import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDailyTargets, normalizePortionResult, nutritionProfile, mealForAi, validateMeasurements } from '../../supabase/functions/_shared/nutrition.js';
import { ingredientMatches, recipeEligible, recipeViolations, activeConstraintKeys } from './constraint-rules.js';
import { appliedMeal } from './portions.js';
import { accountStorage, readStoredJson } from './account-storage.js';
import { ingredientStatus, recipeSeasonScore } from './seasonal-core.js';
import { parseHealthLog } from './health-log-inputs.js';
import { generateMealPlan } from './plan-generation.js';

const profile = { age: 25, sex: 'male', height_cm: 165, weight_kg: 65, activity_level: 'light', goal: 'maintain' };
const vegan = { ...profile, dietary_restrictions: ['vegan'] };
const definitions = { vegan: { label: 'Vegan', blocked: [] }, vegetarian: { label: 'Vegetarian', blocked: [] } };
const meal = { id: 'test-meal', name: 'Rice bowl', kcal: 412, protein: 20, carbs: 65, fats: 8, cost: 40, ingredients: [{ name: 'Rice', grams: 100, qty: '1 cup' }] };

test('activity selection changes the daily estimate, without a hidden moderate assumption', () => {
  assert.equal(computeDailyTargets(profile).calories, 2147);
  assert.equal(computeDailyTargets({ ...profile, activity_level: 'moderate' }).calories, 2420);
});
test('condition management does not impose a separate hidden calorie deficit', () => {
  assert.equal(computeDailyTargets({ ...profile, goal: 'manage_condition' }).calories, computeDailyTargets(profile).calories);
  assert.equal(computeDailyTargets({ ...profile, goal: 'lose_weight' }).calories, 1825);
});
test('invalid profile measurements are rejected before saving', () => {
  assert.equal(validateMeasurements(profile), '');
  for (const change of [{ age: 0 }, { age: 25.5 }, { height_cm: -165 }, { height_cm: Infinity }, { weight_kg: 'bad' }, { weight_kg: '' }]) assert.ok(validateMeasurements({ ...profile, ...change }));
});
test('negative or impossible health logs are rejected without discarding valid zero entries', () => {
  for (const inputs of [{ weight: '-1' }, { sleep: '25' }, { waterCups: '-2' }, { calories: 'bad' }, {}]) assert.throws(() => parseHealthLog(inputs));
  assert.deepEqual(parseHealthLog({ sleep: '0', waterCups: '1.5', calories: '0' }), { weight_kg: null, sleep_hours: 0, calories_burned: 0, water_ml: 450 });
});
test('BB08: an AI per-meal value cannot replace the daily target', () => {
  const result = normalizePortionResult({ scaleFactor: 537 / 412, daily: { calories: 537 }, optimized: { protein: 999 } }, meal, profile, 4);
  assert.equal(result.daily.calories, 2147);
  assert.equal(result.perMealKcal, 537);
  assert.equal(result.optimizedKcal, 537);
  assert.equal(result.optimized.protein, 26);
});
test('invalid AI scales and meal counts are rejected', () => {
  for (const scaleFactor of [NaN, Infinity, 0, 0.49, 2.01]) assert.throws(() => normalizePortionResult({ scaleFactor }, meal, profile, 4));
  for (const count of [0, -1, 2.5, 25]) assert.throws(() => normalizePortionResult({ scaleFactor: 1 }, meal, profile, count));
});
test('BB08: cards and day totals derive the applied calories from the same scale', () => {
  const scaled = appliedMeal(meal, { scaleFactor: 537 / 412 });
  assert.equal(scaled.kcal, 537);
  assert.equal(1482 - meal.kcal + scaled.kcal, 1607);
  assert.equal(scaled.protein, 26);
  assert.equal(meal.kcal, 412);
  assert.equal(meal.ingredients[0].grams, 100);
});
test('restoring an original portion returns the base data', () => {
  assert.equal(appliedMeal(meal, undefined), meal);
  assert.equal(appliedMeal(meal, { scaleFactor: NaN }), meal);
  assert.equal(appliedMeal(meal, { scaleFactor: 3 }), meal);
});
test('applied ingredient quantities and prices follow the saved scale', () => {
  const scaled = appliedMeal(meal, { scaleFactor: 1.5, ingredients: [{ name: 'Rice', optimized: '1 1/2 cups' }] });
  assert.equal(scaled.ingredients[0].grams, 150);
  assert.equal(scaled.ingredients[0].qty, '1 1/2 cups');
  assert.equal(scaled.cost, 60);
});
test('BB07: prepared polvoron without component disclosure is excluded for vegan profiles', () => {
  const polvoron = { ...meal, name: 'Polvoron', ingredients: [{ name: 'Polvoron, plain' }] };
  assert.equal(recipeEligible(polvoron, vegan, definitions), false);
  assert.ok(recipeViolations(polvoron, ['vegan'], true, definitions).some(v => v.ingredient === 'Prepared-food composition needs review'));
});
test('meat, egg and milk components are blocked for vegan selections', () => {
  for (const name of ['Pugo', 'Quail meat', 'Egg, chicken, whole', 'Milk powder', 'Whey', 'Sardines, in tomato sce, cnd', 'Shrimps', 'Oysters']) assert.equal(recipeEligible({ ...meal, ingredients: [{ name }] }, vegan, definitions), false, name);
  assert.equal(recipeEligible(meal, vegan, definitions), true);
});
test('word matching avoids unrelated food-name substrings', () => {
  for (const [name, blocked] of [['Eggplant', 'egg'], ['Champorado', 'ham'], ['Coconut milk', 'dairy'], ['Peanut butter', 'dairy'], ['Oyster mushroom', 'seafood']]) assert.equal(ingredientMatches(name, blocked), false, name);
});
test('plant milk exceptions preserve the underlying plant allergy', () => {
  for (const name of ['Coconut milk', 'Soy milk', 'Almond milk']) assert.equal(ingredientMatches(name, name.split(' ')[0]), true);
  assert.equal(ingredientMatches('Coconut cream', 'dairy'), false);
});
test('vegetarian eggs are allowed while vegan eggs are excluded', () => {
  const eggMeal = { ...meal, name: 'Egg rice', ingredients: [{ name: 'Egg, chicken, whole' }] };
  assert.equal(recipeEligible(eggMeal, { ...profile, dietary_restrictions: ['vegetarian'] }, definitions), true);
  assert.equal(recipeEligible(eggMeal, vegan, definitions), false);
});
test('missing metadata or unknown profile restrictions cannot silently pass selection', () => {
  assert.equal(recipeEligible(meal, vegan, {}, false), false);
  assert.equal(recipeEligible(meal, vegan, {}), false);
  assert.equal(recipeEligible(meal, { ...profile, allergies: ['unmapped allergy'] }, definitions), false);
  assert.equal(recipeEligible({ ...meal, ingredients: [] }, vegan, definitions), false);
});
test('weekly generation filters conflicts and leaves an unmatched meal type empty', () => {
  const rice = { ...meal, type: 'Lunch' };
  const fish = { ...meal, id: 'fish', type: 'Lunch', name: 'Sardines', ingredients: [{ name: 'Sardines' }] };
  for (const random of [false, true]) {
    const plan = generateMealPlan([rice, fish], vegan, definitions, { random, rng: () => 0.99 });
    assert.equal(Object.keys(plan).length, 7);
    for (const slots of Object.values(plan)) {
      assert.equal(slots.find(s => s.type === 'Lunch').mealId, rice.id);
      assert.equal(slots.find(s => s.type === 'Dinner').mealId, null);
      assert.equal(slots.some(s => s.mealId === 'fish'), false);
    }
  }
  assert.deepEqual(generateMealPlan([rice], vegan, {}, { ready: false }), {});
});
test('JSON-encoded and label-based restrictions resolve to loaded rules', () => {
  assert.deepEqual(activeConstraintKeys({ dietary_restrictions: '["Vegan"]' }, definitions), ['vegan']);
});
test('configured medical macro thresholds remain enforceable', () => {
  const defs = { low_carb: { label: 'Low carb', warnHighCarb: true, carbThreshold: 40 } };
  assert.equal(recipeEligible(meal, { ...profile, medical_conditions: ['low_carb'] }, defs), false);
});
test('browser meal state is isolated between accounts and legacy data stays untouched', () => {
  const data = new Map([['blane_meal_plan', 'legacy']]);
  const store = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  let account = 'A';
  const scoped = accountStorage(() => store, () => account);
  assert.equal(scoped.getItem('blane_meal_plan'), null);
  scoped.setItem('blane_meal_plan', 'A plan');
  const keyA = scoped.keyFor('blane_meal_plan');
  account = 'B';
  assert.equal(scoped.getItem('blane_meal_plan'), null);
  assert.equal(scoped.matches(keyA, 'blane_meal_plan'), false);
  scoped.setItem('blane_meal_plan', 'B plan');
  account = 'A';
  assert.equal(scoped.getItem('blane_meal_plan'), 'A plan');
  account = null;
  assert.equal(scoped.getItem('blane_meal_plan'), null);
  assert.equal(data.get('blane_meal_plan'), 'legacy');
});
test('AI payload allowlists omit identity and unrelated profile records', () => {
  const safe = nutritionProfile({ ...profile, id: 'private-id', email: 'private@example.test', full_name: 'Private name', access_token: 'secret', health_logs: ['private'] });
  assert.deepEqual(safe, profile);
  assert.equal('privateNotes' in mealForAi({ ...meal, privateNotes: 'private' }), false);
});
test('malformed browser state does not crash grocery or optimization screens', () => {
  for (const raw of ['broken JSON', 'null', '"text"', '{}']) assert.deepEqual(readStoredJson({ getItem: () => raw }, 'grocery', []), []);
  assert.deepEqual(readStoredJson({ getItem: () => '[]' }, 'optimizer', {}), {});
  assert.deepEqual(readStoredJson({ getItem: () => '[{"name":"rice"}]' }, 'grocery', []), [{ name: 'rice' }]);
});
test('unrecorded seasons stay unknown rather than borrowing a partial food-name match', () => {
  const db = { rice: { season: 'both' }, potato: { season: 'dry' } };
  assert.equal(ingredientStatus('Sweet potato', db, 10).status, 'unknown');
  assert.equal(ingredientStatus('Rice', db, 10).status, 'year_round');
  assert.equal(ingredientStatus('Potato', db, 10).status, 'out_of_season');
  assert.equal(ingredientStatus('Potato', db, 11).status, 'in_season');
});
test('incomplete seasonal evidence cannot produce a misleading numeric score', () => {
  const score = recipeSeasonScore([{ name: 'Rice' }, { name: 'Unknown' }], name => ingredientStatus(name, { rice: { season: 'both' } }, 10));
  assert.equal(score.score, null);
  assert.equal(score.unknownCount, 1);
  assert.equal(recipeSeasonScore([], () => ({})).label, 'Season unknown');
});
