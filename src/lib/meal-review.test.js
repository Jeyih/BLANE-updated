import test from 'node:test';
import assert from 'node:assert/strict';
import { mealReviewBadge, mealReviewKey, storeMealReview, readMealReview, aiReviewBlocksMeal } from './meal-review.js';
import { accountStorage } from './account-storage.js';

test('a rule-only result and an AI safe verdict never imply medical clearance', () => {
  for (const verdict of [undefined, { verdict: 'safe' }, { verdict: 'unknown' }]) {
    assert.equal(mealReviewBadge([], verdict).className, 'review');
    assert.match(mealReviewBadge([], verdict).text, /Rule check only/);
  }
});

test('review identity ignores price and page decorations, retaining exact portions', () => {
  const a = { id: 'rice', kcal: 400, ingredients: [{ name: 'Rice', qty: '1 cup', grams: 150, cost: 10 }] };
  const b = { ...a, ingredients: [{ name: 'Rice', quantity: '1 cup', grams: '150', cost: 20, calories: 400, priceRecords: [{}] }] };
  assert.equal(mealReviewKey(a, {}), mealReviewKey(b, {}));
  assert.notEqual(mealReviewKey(a, {}), mealReviewKey({ ...b, ingredients: [{ name: 'Rice', quantity: '1 cup', grams: 200 }] }, {}));
});

test('current avoid reviews survive reloads but not profile, portion, account or expiry changes', () => {
  const values = new Map();
  const raw = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,v) };
  let account = 'A';
  const storage = accountStorage(() => raw, () => account);
  const meal = { id: 'rice', kcal: 400, ingredients: [{ name: 'Rice', grams: 100 }] };
  const profile = { allergies: ['egg'] };
  storeMealReview(meal, profile, [], { verdict: 'avoid' }, storage, 1000);
  assert.equal(aiReviewBlocksMeal(readMealReview(meal, profile, [], storage, 2000)), true);
  assert.equal(readMealReview(meal, { allergies: [] }, [], storage, 2000), null);
  assert.equal(readMealReview({ ...meal, kcal: 450 }, profile, [], storage, 2000), null);
  assert.equal(readMealReview(meal, profile, [], storage, 1000 + 86400000), null);
  account = 'B';
  assert.equal(readMealReview(meal, profile, [], storage, 2000), null);
  assert.equal(aiReviewBlocksMeal({ verdict: 'caution' }), false);
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
