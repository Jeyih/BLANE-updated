import test from 'node:test';
import assert from 'node:assert/strict';
import { isBudgetPriced, isAffordableMeal } from './meal-budget.js';
test('affordability excludes unknown, incomplete and assumption-based costs', () => {
  const meal = { budgetEligible: true, cost: 30 };
  assert.equal(isAffordableMeal(meal, 50), true);
  for (const changes of [
    { budgetEligible: false },
    { needsVerification: true },
    { priceIncomplete: true },
    { cost: null },
    { cost: NaN },
    { cost: Infinity },
    { cost: -1 },
  ]) {
    assert.equal(isBudgetPriced({ ...meal, ...changes }), false);
    assert.equal(isAffordableMeal({ ...meal, ...changes }, 50), false);
  }
});
test('exact daily allocation does not round an over-budget meal into affordable results', () => {
  const perMeal = 51 / 4;
  assert.equal(isAffordableMeal({ budgetEligible: true, cost: 12.75 }, perMeal), true);
  assert.equal(isAffordableMeal({ budgetEligible: true, cost: 12.76 }, perMeal), false);
  assert.equal(isAffordableMeal({ budgetEligible: true, cost: 13 }, perMeal), false);
  assert.equal(isAffordableMeal({ budgetEligible: true, cost: 10 }, NaN), false);
});
