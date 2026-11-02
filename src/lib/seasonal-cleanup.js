import { ingredientKey, ingredientQuote } from './pricing.js';

export function seasonalCleanupPlan(seasons, recipeIngredients, priceRecords, referenceData = {}) {
  if (!recipeIngredients?.length || !priceRecords?.length) {
    throw new Error('Load recipe ingredients and price references before reviewing seasonal cleanup.');
  }
  const used = new Set(recipeIngredients.map(item => ingredientKey(item.name || item.ingredient_name || item.food_name)).filter(Boolean));
  const keep = [], remove = [];
  for (const row of seasons || []) {
    const inRecipes = used.has(ingredientKey(row.ingredient_name));
    const quote = inRecipes ? ingredientQuote(row.ingredient_name, priceRecords, referenceData) : null;
    if (inRecipes && quote && Number.isFinite(quote.price) && quote.price > 0) keep.push(row);
    else remove.push({ ...row, cleanupReason: inRecipes ? 'No matching price reference' : 'Not used in current recipes' });
  }
  return { keep, remove };
}

export async function deleteSeasonalRows(client, ids) {
  const unique = [...new Set(ids)];
  let deleted = 0;
  for (let offset = 0; offset < unique.length; offset += 50) {
    const batch = unique.slice(offset, offset + 50);
    const { data, error } = await client.from('ingredient_seasons').delete().in('id', batch).select('id');
    if (error) throw new Error(`Removed ${deleted} seasonal records before the operation stopped: ${error.message}`);
    if (data?.length !== batch.length) throw new Error(`Removed ${deleted + (data?.length || 0)} seasonal records. Some records could not be deleted; reload before retrying.`);
    deleted += data.length;
  }
  return deleted;
}
