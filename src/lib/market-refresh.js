const MARKET_REFRESH_MS = 15e3;
function isTarlacCityMarket(market) {
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const locality = normalize(market.city || market.municipality);
  if (locality) return locality === 'tarlac city' || locality === 'city of tarlac';
  return /\btarlac city\b|\bcity of tarlac\b/.test(normalize(market.address));
}
async function readRows(client, table, signal, recipeIds) {
  const rows = [];
  for (let start = 0; ; start += 1e3) {
    let query = client
      .from(table)
      .select('*')
      .order('id')
      .range(start, start + 999);
    if (recipeIds) query = query.in('recipe_id', recipeIds);
    const { data, error } = await query.abortSignal(signal);
    if (error) throw new Error(`Unable to refresh ${table}.`);
    rows.push(...(data || []));
    if (!data || data.length < 1e3) return rows;
  }
}
async function fetchMarketSnapshot(client, signal, recipeIds = []) {
  const [markets, ingredients, recipeIngredients] = await Promise.all([
    readRows(client, 'markets', signal),
    readRows(client, 'market_ingredients', signal),
    recipeIds.length
      ? readRows(client, 'recipe_ingredients', signal, recipeIds)
      : Promise.resolve([]),
  ]);
  return { markets, ingredients, recipeIngredients };
}
function getMealPlanRecipeIds(storage) {
  try {
    const plan = JSON.parse(storage.getItem('blane_meal_plan') || '{}');
    const day = Number(storage.getItem('blane_meal_plan_day') || 0);
    const slots = Number.isInteger(day) && Array.isArray(plan?.[day]) ? plan[day] : [];
    return [
      ...new Set(
        slots
          .map((slot) => slot?.mealId)
          .filter(Boolean)
          .map(String),
      ),
    ];
  } catch {
    return [];
  }
}
function mealPlanMarketIngredients(marketIngredients, recipeIngredients) {
  const normalize = (name) =>
    String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  const planned = new Set(
    recipeIngredients
      .map((row) => normalize(row.name || row.ingredient_name || row.food_name))
      .filter(Boolean),
  );
  return marketIngredients.filter((row) => planned.has(normalize(row.name)));
}
function marketDistanceKm(origin, destination) {
  const radians = (value) => (value * Math.PI) / 180;
  const a =
    Math.sin(radians(destination.lat - origin.lat) / 2) ** 2 +
    Math.cos(radians(origin.lat)) *
      Math.cos(radians(destination.lat)) *
      Math.sin(radians(destination.lng - origin.lng) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
export {
  MARKET_REFRESH_MS,
  isTarlacCityMarket,
  fetchMarketSnapshot,
  getMealPlanRecipeIds,
  mealPlanMarketIngredients,
  marketDistanceKm,
};
