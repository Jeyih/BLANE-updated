import { applyDynamicRecipePrices } from './pricing.js';

export function adminRecipePrices(recipes, ingredients, records, references = {}, query = '', direction = null) {
  const grouped = new Map();
  for (const ingredient of ingredients || []) {
    const key = String(ingredient.recipe_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ...ingredient, qty: ingredient.quantity });
  }
  const matches = applyDynamicRecipePrices(recipes.filter(recipe => recipe.name.toLowerCase().includes(query.toLowerCase().trim())).map(recipe => ({
    ...recipe, ingredients: grouped.get(String(recipe.id)) || [],
  })), records, references);
  if (!direction) return matches;
  return matches.sort((a, b) => {
    if (a.cost == null || b.cost == null) return a.cost === b.cost ? a.name.localeCompare(b.name) : a.cost == null ? 1 : -1;
    return (direction === 'asc' ? a.cost - b.cost : b.cost - a.cost) || a.name.localeCompare(b.name);
  });
}
