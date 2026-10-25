import { ingredientStatus, recipeSeasonScore } from './seasonal-core.js';
import { supabase } from './supabase';
const DRY_MONTHS = [11, 12, 1, 2, 3, 4, 5];
function getCurrentMonth() {
  return new Date().getMonth() + 1;
}
function getCurrentSeason() {
  return DRY_MONTHS.includes(getCurrentMonth()) ? 'dry' : 'wet';
}
const INGREDIENT_DB = {};
async function loadIngredientSeasons() {
  const { data, error } = await supabase
    .from('ingredient_seasons')
    .select('*')
    .order('ingredient_name');
  if (error) {
    console.error('Failed to load ingredient seasons:', error);
    return false;
  }
  Object.keys(INGREDIENT_DB).forEach((key) => delete INGREDIENT_DB[key]);
  (data || []).forEach((row) => {
    if (!row.ingredient_name) return;
    const key = row.ingredient_name.toLowerCase().trim();
    INGREDIENT_DB[key] = { season: row.season || 'unknown', alt: row.alt || null };
  });
  return true;
}
function getIngredientStatus(name) { return ingredientStatus(name, INGREDIENT_DB, getCurrentMonth()); }
function scoreRecipe(ingredients) { return recipeSeasonScore(ingredients, getIngredientStatus); }
export {
  getCurrentMonth,
  getCurrentSeason,
  getIngredientStatus,
  loadIngredientSeasons,
  scoreRecipe,
};
