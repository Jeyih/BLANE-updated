export async function loadMarketIngredientPrices(supabase) {
  const { data, error } = await supabase
    .from('market_ingredients')
    .select('name, price_per_kg, status');

  if (error) {
    console.warn('Market price quotes are unavailable:', error.message);
    return [];
  }

  return data || [];
}

function normalizeIngredientName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function applyDynamicRecipePrices(recipes, marketPrices) {
  const pricesByIngredient = new Map();

  (marketPrices || []).forEach((item) => {
    const key = normalizeIngredientName(item.name);
    const price = Number(item.price_per_kg);
    if (!key || !Number.isFinite(price) || price <= 0 || item.status === 'unavail') return;
    if (!pricesByIngredient.has(key)) pricesByIngredient.set(key, []);
    pricesByIngredient.get(key).push(price);
  });

  return (recipes || []).map((recipe) => {
    const ingredients = recipe.ingredients || [];
    if (!ingredients.length) return { ...recipe, pricingSource: 'recipe' };

    const baseIngredientCost = (Number(recipe.cost) || 0) / ingredients.length;
    let hasMarketPrice = false;
    const pricedIngredients = ingredients.map((ingredient) => {
      const matches = pricesByIngredient.get(normalizeIngredientName(ingredient.name)) || [];
      const grams = Number(ingredient.grams);
      if (!matches.length || !Number.isFinite(grams) || grams <= 0) {
        return { ...ingredient, cost: Number(baseIngredientCost.toFixed(2)), pricingSource: 'recipe' };
      }

      hasMarketPrice = true;
      const averagePricePerKg = matches.reduce((sum, price) => sum + price, 0) / matches.length;
      return {
        ...ingredient,
        cost: Number((averagePricePerKg * grams / 1000).toFixed(2)),
        pricingSource: 'market',
      };
    });

    const cost = hasMarketPrice
      ? Math.round(pricedIngredients.reduce((sum, ingredient) => sum + ingredient.cost, 0))
      : Number(recipe.cost) || 0;

    return {
      ...recipe,
      cost,
      ingredients: pricedIngredients,
      pricingSource: hasMarketPrice ? 'market' : 'recipe',
    };
  });
}