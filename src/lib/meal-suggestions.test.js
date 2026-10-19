import test from 'node:test';
import assert from 'node:assert/strict';
import { createSuggestionService, selectRecipeFallback } from './meal-suggestions.js';
const meal = { id: 'rice', name: 'Rice meal', type: 'Lunch', cost: 25, budgetEligible: true };
test('fallback uses only the requested type, sourced affordable prices and allowed ingredients', () => {
  const candidates = [
    { ...meal, id: 'allergen', cost: 1 },
    { ...meal, id: 'unknown', budgetEligible: false, cost: 2 },
    { ...meal, id: 'partial', priceIncomplete: true, cost: 3 },
    { ...meal, id: 'assumption', needsVerification: true, cost: 4 },
    { ...meal, id: 'breakfast', type: 'Breakfast', cost: 5 },
    { ...meal, id: 'expensive', cost: 60 },
    meal,
  ];
  const options = { mealType: 'Lunch', budget: 50, isAllowed: (m) => m.id !== 'allergen' };
  assert.equal(selectRecipeFallback(candidates, options).id, 'rice');
  assert.equal(selectRecipeFallback(candidates, { ...options, budget: 0 }), null);
  assert.equal(candidates[0].id, 'allergen', 'Stored catalogue order is unchanged');
});
test('cache expires, coalesces concurrent calls and keeps users and budgets separate', async () => {
  let time = 100;
  let calls = 0;
  const service = createSuggestionService({ now: () => time, ttl: 1e3 });
  const options = {
    key: 'user-1-budget-50',
    request: async () => {
      calls++;
      return meal;
    },
    validate: () => true,
    fallback: () => null,
  };
  const results = await Promise.all([service.get(options), service.get(options)]);
  assert.equal(calls, 1);
  assert.equal(results[0].delivery, 'ai');
  assert.equal((await service.get(options)).delivery, 'cached');
  time = 1100;
  await service.get(options);
  assert.equal(calls, 2);
  await service.get({ ...options, key: 'user-2-budget-50' });
  await service.get({ ...options, key: 'user-1-budget-100' });
  assert.equal(calls, 4);
});
test('429 cooldown avoids repeated AI calls and honors the provider retry delay', async () => {
  let time = 0;
  let calls = 0;
  let fallbackCalls = 0;
  const service = createSuggestionService({ now: () => time });
  const options = {
    key: 'one',
    validate: () => true,
    fallback: () => {
      fallbackCalls++;
      return meal;
    },
    request: async () => {
      calls++;
      throw new Error('RESOURCE_EXHAUSTED {"retryDelay":"22209s"}');
    },
  };
  assert.equal((await service.get(options)).delivery, 'fallback');
  assert.equal((await service.get({ ...options, key: 'two' })).delivery, 'fallback');
  assert.equal(calls, 1);
  assert.equal(fallbackCalls, 2, 'Fallback recalculates from current recipes each time');
  time = 22209 * 1e3;
  await service.get(options);
  assert.equal(calls, 2);
});
test('changed prices invalidate a cached meal instead of returning an over-budget suggestion', async () => {
  const service = createSuggestionService();
  let allowed = true;
  let calls = 0;
  const fallback = { ...meal, id: 'cheaper' };
  const options = {
    key: 'same',
    validate: (m) => m.id === 'cheaper' || allowed,
    request: async () => {
      calls++;
      return meal;
    },
    fallback: () => fallback,
  };
  await service.get(options);
  allowed = false;
  assert.equal((await service.get(options)).meal.id, 'cheaper');
  assert.equal(calls, 2);
});
test('offline or timed-out AI uses fallback; no suitable fallback gives a concise error', async () => {
  const service = createSuggestionService();
  const options = {
    key: 'offline',
    request: async () => {
      throw new Error('Failed to fetch');
    },
    validate: () => true,
    fallback: () => meal,
  };
  assert.equal((await service.get(options)).delivery, 'fallback');
  await assert.rejects(
    service.get({ ...options, key: 'no-meal', fallback: () => null }),
    /no existing recipe/,
  );
});
test('fallback is independently validated and cannot label an unsafe meal as suitable', async () => {
  const service = createSuggestionService();
  await assert.rejects(
    service.get({
      key: 'unsafe',
      request: async () => meal,
      validate: () => false,
      fallback: () => meal,
    }),
    /no existing recipe/,
  );
});
