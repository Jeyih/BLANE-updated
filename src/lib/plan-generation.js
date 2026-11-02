import { recipeEligible } from './constraint-rules.js';
import { isBudgetPriced } from './meal-budget.js';

export function emptyMealPlan() {
  const periods = [['Breakfast', '7:00 AM'], ['Lunch', '12:00 PM'], ['Snack', '3:00 PM'], ['Dinner', '6:30 PM']];
  return Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, periods.map(([type, time]) => ({ type, time, mealId: null }))]));
}

export function generateMealPlan(recipes, profile, definitions, { ready = true, random = false, rng = Math.random, calorieTarget = null, dailyBudget = null, slotsByDay = null } = {}) {
  const eligible = recipes.filter(recipe => recipeEligible(recipe, profile, definitions, ready));
  if (!eligible.length) return {};
  const periods = [['Breakfast', '7:00 AM'], ['Lunch', '12:00 PM'], ['Snack', '3:00 PM'], ['Dinner', '6:30 PM']];
  const plan = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, (slotsByDay?.[day] || periods.map(([type, time]) => ({ type, time }))).map(slot => {
    const { type, time } = slot;
    const pool = eligible.filter(recipe => recipe.type === type);
    const choice = pool.length ? pool[random ? Math.min(pool.length - 1, Math.floor(rng() * pool.length)) : day % pool.length] : null;
    return { ...slot, type, time, mealId: choice?.id ?? null };
  })]));
  // Coordinate search improves daily totals without claiming that an infeasible
  // catalogue can satisfy all targets. Dietary eligibility is never relaxed.
  const target = Number.isFinite(calorieTarget) && calorieTarget > 0 ? calorieTarget : null;
  const budget = Number.isFinite(dailyBudget) && dailyBudget >= 0 ? dailyBudget : null;
  if (!target && budget === null) return plan;
  const byId = new Map(eligible.map(recipe => [String(recipe.id), recipe]));
  function score(slots) {
    const meals = slots.map(slot => byId.get(String(slot.mealId)));
    let result = meals.filter(meal => !meal).length * 100;
    if (target) {
      result += meals.filter(meal => !Number.isFinite(meal?.kcal) || meal.kcal <= 0).length * 10;
      result += Math.abs(meals.reduce((sum, meal) => sum + (Number(meal?.kcal) || 0), 0) - target) / target;
    }
    if (budget !== null) {
      result += meals.filter(meal => !meal || !isBudgetPriced(meal)).length * 10;
      const cost = meals.reduce((sum, meal) => sum + (isBudgetPriced(meal || {}) ? meal.cost : 0), 0);
      result += Math.max(0, cost - budget) / Math.max(1, budget) * 3;
    }
    return result;
  }
  for (const [day, slots] of Object.entries(plan)) {
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      slots.forEach((slot, index) => {
        let best = score(slots), choice = slot.mealId;
        const typed = eligible.filter(recipe => recipe.type === slot.type);
        const pool = typed.length ? typed : eligible.filter(recipe => String(recipe.id) === String(slotsByDay?.[day]?.[index]?.mealId));
        for (const recipe of pool) {
          const trial = slots.map((entry, i) => i === index ? { ...entry, mealId: recipe.id } : entry);
          const candidate = score(trial);
          if (candidate + 1e-9 < best) { best = candidate; choice = recipe.id; improved = true; }
        }
        slot.mealId = choice;
      });
      if (!improved) break;
    }
  }
  return plan;
}
