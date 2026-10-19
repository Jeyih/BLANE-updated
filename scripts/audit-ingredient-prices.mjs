import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { normalizeMarketPrices, priceCoverage, ingredientQuote } from '../src/lib/pricing.js';
import reference from '../public/data/ingredient-prices.json';
import retail from '../public/data/retail-prices.json';
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const value = (name) =>
  env
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith(name + '='))
    ?.slice(name.length + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
const client = createClient(value('VITE_SUPABASE_URL'), value('VITE_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false },
  global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(1e4) }) },
});
async function all(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1e3) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(order)
      .range(from, from + 999);
    if (error) throw new Error(`Could not read ${table}: ${error.code || 'network/access'}`);
    rows.push(...data);
    if (data.length < 1e3) return rows;
  }
}
const [foods, recipeIngredients, marketIngredients, markets] = await Promise.all([
  all('fnri_food_composition', 'fct_id'),
  all('recipe_ingredients', 'id'),
  all('market_ingredients', 'id'),
  all('markets', 'id'),
]);
const quotes = normalizeMarketPrices(marketIngredients, markets);
const prices = [...reference.records, ...retail.records];
const recipeNames = [
  ...new Set(recipeIngredients.map((ing) => ing.name || ing.ingredient_name || ing.food_name)),
];
const coverage = priceCoverage(foods, recipeIngredients, prices);
const marketNames = [...new Set(marketIngredients.map((i) => i.name).filter(Boolean))];
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../tmp/ingredient-pricing-audit.json', import.meta.url),
  JSON.stringify({ foods, recipeIngredients, marketIngredients, markets, quotes }, null, 2),
);
console.log(
  JSON.stringify(
    {
      foods: foods.length,
      recipeEntries: recipeIngredients.length,
      recipeUnique: recipeNames.length,
      marketRows: marketIngredients.length,
      unverifiedHistoricalQuotes: quotes.length,
      catalogMatched: coverage.priced,
      uniqueMarketIngredients: marketNames.length,
      missingMarketPrices: marketNames.filter((name) => !ingredientQuote(name, prices)),
      marketFields: Object.keys(marketIngredients[0] || {}),
      markets: markets.map((m) => ({ name: m.name, address: m.address })),
      sampleMarketRows: marketIngredients.slice(0, 5),
      verifiedRecipeIngredients: coverage.recipePriced,
      foodSamples: foods.slice(0, 12).map((f) => ({ id: f.fct_id, name: f.food_name })),
      pricedRecipeEntries: coverage.recipeEntriesPriced,
    },
    null,
    2,
  ),
);
