import { isBudgetPriced } from './meal-budget.js';

// Generate priorities once when the picker opens, so typing never reshuffles cards.
export function createRecipeOrder(recipes, random = Math.random) {
  return Object.fromEntries(recipes.map(recipe => [recipe.id, random()]));
}

export function mealChoicePriceBand(recipe, budget) {
  if (!isBudgetPriced(recipe)) return 'unverified';
  return recipe.cost <= budget ? 'within' : 'over';
}

export function mealChoicePriceText(recipe, budget) {
  const amount = Number.isFinite(recipe.cost) && recipe.cost > 0 ? `₱${recipe.cost.toFixed(2)}` : null;
  if (!amount) return { amount: 'Estimate unavailable', detail: 'Ingredient price or quantity is missing' };
  if (recipe.priceIncomplete || recipe.pricingSource === 'partial') {
    return { amount: `Subtotal ${amount}`, detail: 'Partial cost only — some ingredients are not fully priced' };
  }
  if (!isBudgetPriced(recipe)) {
    return { amount: `Provisional ${amount}`, detail: 'Estimated using quantities or product matches that need verification' };
  }
  return { amount: `Est. ${amount}`, detail: `${recipe.cost <= budget ? 'Within' : 'Above'} ₱${budget.toFixed(2)} meal budget` };
}

export function groupMealChoices(recipes, { mealType, budget, order = {} }) {
  const rank = { within: 0, over: 1, unverified: 2 };
  const ordered = [...recipes].sort((a, b) =>
    rank[mealChoicePriceBand(a, budget)] - rank[mealChoicePriceBand(b, budget)] ||
    (order[a.id] ?? 0) - (order[b.id] ?? 0) || String(a.id).localeCompare(String(b.id)));
  const matching = ordered.filter(recipe => recipe.type === mealType);
  const others = ordered.filter(recipe => recipe.type !== mealType);
  return [
    { key: 'matching', title: `${mealType} recipes`, recipes: matching },
    { key: 'within', title: 'Other meals within your meal budget', recipes: others.filter(recipe => mealChoicePriceBand(recipe, budget) === 'within') },
    { key: 'over', title: 'Other meals above your meal budget', recipes: others.filter(recipe => mealChoicePriceBand(recipe, budget) === 'over') },
    { key: 'unverified', title: 'Other meals with prices needing review', recipes: others.filter(recipe => mealChoicePriceBand(recipe, budget) === 'unverified') },
  ].filter(group => group.key === 'matching' || group.recipes.length);
}
