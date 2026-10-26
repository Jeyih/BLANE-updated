import test from 'node:test';
import assert from 'node:assert/strict';
import { mealReviewBadge, mealReviewKey } from './meal-review.js';

test('a rule-only result and an AI safe verdict never imply medical clearance', () => {
  for (const verdict of [undefined, { verdict: 'safe' }, { verdict: 'unknown' }]) {
    assert.equal(mealReviewBadge([], verdict).className, 'review');
    assert.match(mealReviewBadge([], verdict).text, /Rule check only/);
  }
});
test('AI concerns appear on the card without erasing recorded dietary conflicts', () => {
  assert.match(mealReviewBadge([], { verdict: 'avoid' }).text, /AI: Avoid/);
  assert.match(mealReviewBadge([], { verdict: 'caution' }).text, /AI: Caution/);
  assert.equal(mealReviewBadge([{ severity: 'allergy' }], { verdict: 'safe' }), null);
});
test('reviews belong to the specific portion, profile and recorded warnings', () => {
  const meal = { id: 'bibingka', kcal: 351, carbs: 79.3, ingredients: [{ name: 'Rice cake', grams: 150 }] };
  const profile = { medical_conditions: ['diabetes'] };
  const original = mealReviewKey(meal, profile);
  assert.notEqual(original, mealReviewKey({ ...meal, kcal: 537, carbs: 121 }, profile));
  assert.notEqual(original, mealReviewKey(meal, { medical_conditions: [] }));
  assert.notEqual(original, mealReviewKey(meal, profile, [{ severity: 'medical' }]));
  assert.equal(original, mealReviewKey(meal, { ...profile, email: 'irrelevant@example.test' }));
});
