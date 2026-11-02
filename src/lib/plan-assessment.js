import { isBudgetPriced } from './meal-budget.js';

export function assessPlanDay(slots, getMeal, calorieTarget, budget) {
  const meals = slots.map(slot => getMeal(slot));
  const assigned = meals.filter(Boolean);
  const caloriesKnown = meals.length > 0 && meals.every(meal => meal && Number.isFinite(meal.kcal) && meal.kcal > 0);
  const pricesKnown = meals.length > 0 && meals.every(meal => meal && isBudgetPriced(meal));
  const calories = assigned.reduce((sum, meal) => sum + (Number(meal.kcal) || 0), 0);
  const cost = pricesKnown ? meals.reduce((sum, meal) => sum + meal.cost, 0) : null;
  const issues = [];
  if (!Number.isFinite(calorieTarget) || calorieTarget <= 0) issues.push('A personalized calorie target is unavailable; calorie suitability has not been checked.');
  if (assigned.length !== slots.length || !slots.length) issues.push('Assign a recipe to every meal slot.');
  if (!caloriesKnown) issues.push('Some calorie values are missing.');
  else if (Number.isFinite(calorieTarget) && calorieTarget > 0 && Math.abs(calories - calorieTarget) > calorieTarget * 0.1) issues.push(calories < calorieTarget ? 'Calories are below the daily target range.' : 'Calories are above the daily target range.');
  if (!pricesKnown) issues.push('The full-day price cannot be verified.');
  else if (Number.isFinite(budget) && cost > budget) issues.push('The estimated cost exceeds the daily budget.');
  return { calories, cost, issues, caloriesKnown, pricesKnown };
}
