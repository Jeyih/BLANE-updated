import test from 'node:test';
import assert from 'node:assert/strict';
import { isProfileComplete, personalizedCalorieTarget } from './profile-readiness.js';
import { emptyMealPlan } from './plan-generation.js';
import { recipeEligible } from './constraint-rules.js';
const complete = { age:25, sex:'male', height_cm:165, weight_kg:65, activity_level:'light', goal:'maintain' };
test('personalized planning requires every calculation input, including activity and goal', () => {
  assert.equal(isProfileComplete(complete), true);
  for (const key of Object.keys(complete)) {
    const missing = { ...complete }; delete missing[key];
    assert.equal(isProfileComplete(missing), false, key);
  }
  assert.equal(isProfileComplete(null), false);
  assert.equal(isProfileComplete({ goal:'maintain' }), false);
});
test('invalid or unsupported values cannot silently use target defaults', () => {
  for (const [key,value] of [['age',1.5],['height_cm',0],['weight_kg',-1],['activity_level','unknown'],['goal','unknown'],['sex','unknown']]) {
    assert.equal(isProfileComplete({...complete,[key]:value}), false);
  }
});
test('browsing without complete details never gets a guessed personalized target', () => {
  assert.equal(personalizedCalorieTarget(null), null);
  assert.equal(personalizedCalorieTarget({ goal: 'maintain' }), null);
  assert.equal(personalizedCalorieTarget(complete), 2147);
});
test('manual planning starts with independent empty slots and retains known restrictions', () => {
  const week = emptyMealPlan();
  assert.equal(Object.keys(week).length, 7);
  assert.equal(week[0].length, 4);
  assert.equal(Object.values(week).flat().every(slot => slot.mealId === null), true);
  week[0][0].mealId = 'manual-choice';
  assert.equal(week[1][0].mealId, null);
  const meal = { name: 'Egg rice', ingredients: [{ name: 'Egg' }] };
  const incomplete = { allergies: ['egg_allergy'] };
  const rules = { egg_allergy: { label: 'Egg allergy', severity: 'allergy', blocked: ['egg'] } };
  assert.equal(recipeEligible(meal, incomplete, rules), false);
});
