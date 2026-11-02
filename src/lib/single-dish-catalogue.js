import changes from '../data/single-dish-recipes.js';
import { recipeDisplayName } from './recipe-names.js';

const byRecipe = new Map(changes.map(change => [change.id, change]));
const removedIngredients = new Set(changes.flatMap(change => change.removedIngredients));
const removedSteps = new Set(changes.flatMap(change => change.removedSteps));
const stepUpdates = new Map(changes.flatMap(change => change.stepUpdates.map(step => [step.id, step])));

// Compatibility for databases that have not applied the single-dish migration yet.
// Exact original names/row IDs avoid rewriting later administrator edits.
export function singleDishRecipeRows(rows = []) {
  return (rows || []).map(row => {
    const change = byRecipe.get(row.id);
    if (!change || row.name !== change.originalName) {
      const name = recipeDisplayName(row.name);
      return name === row.name ? row : { ...row, name };
    }
    const { name, kcal, protein_g, carbs_g, fats_g } = change;
    return { ...row, name: recipeDisplayName(name), kcal, protein_g, carbs_g, fats_g, cost: 0 };
  });
}
export function singleDishIngredientRows(rows = []) {
  return (rows || []).filter(row => !removedIngredients.has(row.id));
}
export function singleDishStepRows(rows = []) {
  return (rows || []).filter(row => !removedSteps.has(row.id)).map(row => {
    const update = stepUpdates.get(row.id);
    return update && row.description === update.expected
      ? { ...row, title: update.title, description: update.description, timer_seconds: update.timer_seconds }
      : row;
  });
}
