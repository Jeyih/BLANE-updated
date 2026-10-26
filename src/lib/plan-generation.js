import { recipeEligible } from './constraint-rules.js';

export function emptyMealPlan() {
  const periods = [['Breakfast', '7:00 AM'], ['Lunch', '12:00 PM'], ['Snack', '3:00 PM'], ['Dinner', '6:30 PM']];
  return Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, periods.map(([type, time]) => ({ type, time, mealId: null }))]));
}

export function generateMealPlan(recipes, profile, definitions, { ready = true, random = false, rng = Math.random } = {}) {
  const eligible = recipes.filter(recipe => recipeEligible(recipe, profile, definitions, ready));
  if (!eligible.length) return {};
  const periods = [['Breakfast', '7:00 AM'], ['Lunch', '12:00 PM'], ['Snack', '3:00 PM'], ['Dinner', '6:30 PM']];
  return Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, periods.map(([type, time]) => {
    const pool = eligible.filter(recipe => recipe.type === type);
    const choice = pool.length ? pool[random ? Math.min(pool.length - 1, Math.floor(rng() * pool.length)) : day % pool.length] : null;
    return { type, time, mealId: choice?.id ?? null };
  })]));
}
