import { RAW_DA_MAPPINGS, DA_NAME_MAPPINGS, PARTIAL_RAW_FOODS, COMPARABLE_PRICE_MAPPINGS } from './price-mappings.js';
import { documentedPurchaseAmount, FNRI_PORTION_DEFINITIONS } from './philippine-portions.js';

const ALIASES = {
  malunngay: 'malunggay leaves', malunggay: 'malunggay leaves', 'moringa leaves': 'malunggay leaves',
  bigas: 'white rice', rice: 'white rice', 'uncooked rice': 'white rice',
  munggo: 'mungbean', monggo: 'mungbean', 'mung beans': 'mungbean', milkfish: 'bangus',
  liempo: 'pork belly', kasim: 'pork shoulder', eggs: 'egg', 'chicken egg': 'egg',
  talong: 'eggplant', kamatis: 'tomato', tomatoes: 'tomato', kalabasa: 'squash',
  'bitter gourd': 'ampalaya', 'string beans': 'sitaw', 'yardlong beans': 'sitaw',
  carrots: 'carrot', sayote: 'chayote', potatoes: 'potato', 'white potato': 'potato', luya: 'ginger',
  saba: 'banana saba', 'native garlic': 'local garlic', 'white sugar': 'refined sugar',
};
export function ingredientKey(name) {
  const key = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return ALIASES[key] || key;
}
export const formatPrice = (v) => Number.isFinite(v) && v > 0 ? `₱${v.toFixed(2)}` : 'Price unavailable';
export const formatEstimatedPrice = (v) => Number.isFinite(v) && v > 0 ? `Est. ${formatPrice(v)}` : 'Estimate unavailable';

const RETAIL_HOSTS = new Set(['shopmetro.ph', 'jelexie.ph', 'pindotlang.com',
  'montereycommunityonlinemarket.com.ph', 'shop.gerald.ph', 'barrelsandbeyondph.com', 'shop.monkeyspeakcoffee.com', 'www.thesausageguy.shop']);
export function isSourcedPrice(record) {
  if (record.currency && record.currency !== 'PHP' || record.sourceCountry && record.sourceCountry !== 'PH') return false;
  if (record.kind !== 'reference' || !Number.isFinite(Number(record.price)) || Number(record.price) <= 0) return false;
  try {
    const url = new URL(record.sourceUrl);
    if (url.protocol !== 'https:') return false;
    return url.hostname === 'www.da.gov.ph' || record.sourceType === 'retailer' && record.verified === true && RETAIL_HOSTS.has(url.hostname);
  } catch { return false; }
}

function matchingReferences(name, prices) {
  const key = ingredientKey(name);
  const sourced = prices.filter(isSourcedPrice);
  // An exact ingredient quote must take precedence over a different-product benchmark.
  const direct = sourced.filter((p) => (p.key || ingredientKey(p.name)) === key);
  if (direct.length) {
    const official = direct.filter((p) => p.sourceType !== 'retailer');
    return [...official, ...direct.filter((p) => p.sourceType === 'retailer')];
  }
  const comparable = COMPARABLE_PRICE_MAPPINGS[name];
  if (comparable) {
    const benchmarks = sourced.filter((p) => (p.key || ingredientKey(p.name)) === ingredientKey(comparable.name));
    if (benchmarks.length) return benchmarks.map((p) => ({ ...p, estimateType: 'comparable',
      benchmarkName: comparable.name, notes: `Comparable-product estimate: ${comparable.note} ${p.notes || ''}`.trim() }));
  }
  const mapped = RAW_DA_MAPPINGS[name] || DA_NAME_MAPPINGS[name];
  if (!mapped) return [];
  return sourced.filter((p) => (p.key || ingredientKey(p.name)) === ingredientKey(mapped)).map((p) => ({
    ...p, estimateType: RAW_DA_MAPPINGS[name] ? 'raw' : 'product reference',
    partial: PARTIAL_RAW_FOODS.has(name),
    notes: RAW_DA_MAPPINGS[name] ? 'Raw-ingredient estimate; weight-based costs assume equal raw/cooked weight. Cooking yield, oil, sugar, wrappers, labour and fuel are excluded.'
      : `${mapped} reference used; the exact variety is not specified in the recipe.`,
  }));
}

export function parsePriceQuantity(value) {
  if (typeof value === 'number') return value > 0 ? { amount: value / 1000, unit: 'kg' } : null;
  const fractions = { '½': '1/2', '¼': '1/4', '¾': '3/4', '⅓': '1/3', '⅔': '2/3' };
  const text = String(value || '').trim().toLowerCase().replace(/(\d)([½¼¾⅓⅔])/g, '$1 $2').replace(/[½¼¾⅓⅔]/g, (v) => fractions[v]);
  const match = text.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(kg|kilograms?|g|grams?|ml|milliliters?|l|liters?|pc|pcs|pieces?|eggs?|tbsp|tsp)\.?$/);
  if (!match) return null;
  const amount = match[1].split(/\s+/).reduce((sum, part) => {
    if (!part.includes('/')) return sum + Number(part);
    const [a, b] = part.split('/').map(Number);
    return sum + a / b;
  }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2];
  if (/^(g|grams?)$/.test(unit)) return { amount: amount / 1000, unit: 'kg' };
  if (/^(kg|kilograms?)$/.test(unit)) return { amount, unit: 'kg' };
  if (/^(ml|milliliters?)$/.test(unit)) return { amount: amount / 1000, unit: 'l' };
  if (/^(l|liters?)$/.test(unit)) return { amount, unit: 'l' };
  if (unit === 'tbsp' || unit === 'tsp') return { amount: amount * (unit === 'tbsp' ? .015 : .005), unit: 'l' };
  return { amount, unit: 'pc' };
}

// Recipe household measures use an explicit budgeting convention, not a
// density conversion from nutrition grams. Retail pack parsing stays strict.
export function parseRecipeQuantity(value) {
  if (typeof value === 'number') {
    const amount = parsePriceQuantity(value);
    return amount ? { ...amount, estimated: false, note: '' } : null;
  }
  const original = String(value ?? '').trim();
  const approximate = /^(?:~|≈|about\b|approximately\b)|\bscant\b/i.test(original);
  const text = original.toLowerCase().replace(/^(?:~|≈|about\b|approximately\b)\s*/, '').replace(/^scant\s+/, '')
    .replace(/tablespoons?/g, 'tbsp').replace(/teaspoons?/g, 'tsp').replace(/\s+cooked$/, '');
  const parts = text.split(/\s*\+\s*/);
  const amounts = parts.map((part) => {
    const cup = part.match(/^(.+?)\s+cups?$/);
    if (!cup) return parsePriceQuantity(part);
    const count = parsePriceQuantity(`${cup[1]} pc`);
    return count ? { amount: count.amount * .24, unit: 'l' } : null;
  });
  if (!amounts.length || amounts.some((p) => !p) || amounts.some((p) => p.unit !== amounts[0].unit)) return null;
  const household = /\b(?:cups?|tbsp|tsp)\b/.test(text);
  return { amount: amounts.reduce((sum, p) => sum + p.amount, 0), unit: amounts[0].unit,
    estimated: approximate || household,
    note: [approximate ? `Approximate recipe quantity: ${original}.` : '',
      household ? 'Budgeting measures: 1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml.' : '',
      /\bscant\b/i.test(original) ? 'Scant amount is priced at the stated full measure as an upper approximation.' : ''].filter(Boolean).join(' ') };
}

export function normalizeMarketPrices(rows, markets) {
  const byId = new Map(markets.map((m) => [String(m.id), m]));
  return rows.flatMap((row) => {
    const market = byId.get(String(row.market_id));
    if (!market || !/tarlac/i.test(`${market.address || ''} ${market.name || ''}`) || row.status === 'unavail') return [];
    const perKg = Number(row.price_per_kg) > 0;
    const basis = perKg ? { amount: 1, unit: 'kg' } : parsePriceQuantity(row.qty);
    const price = Number(perKg ? row.price_per_kg : row.price);
    if (!basis || !Number.isFinite(price) || price <= 0) return [];
    return [{ name: row.name, key: ingredientKey(row.name), price: price / basis.amount, unit: basis.unit,
      kind: 'local', region: 'Tarlac', source: market.name, sourceUrl: null, observedAt: row.updated_at || null }];
  });
}

export async function loadMarketIngredientPrices(supabase) {
  const [ingredients, markets] = await Promise.all([
    loadAllPriceRows(supabase, 'market_ingredients', '*', 'id'),
    loadAllPriceRows(supabase, 'markets', 'id,name,address', 'id'),
  ]);
  return normalizeMarketPrices(ingredients, markets);
}

export async function loadAllPriceRows(supabase, table, columns = '*', order = 'id') {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(from, from + 999);
    if (error) throw new Error(`Could not load ${table}.`);
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

export async function loadPriceCatalogue(supabase) {
  const [foods, recipeIngredients] = await Promise.all([
    loadAllPriceRows(supabase, 'fnri_food_composition', 'fct_id,food_name', 'fct_id'),
    loadAllPriceRows(supabase, 'recipe_ingredients', 'id,fct_id,name,grams,quantity'),
  ]);
  return { foods, recipeIngredients };
}

export function ingredientQuote(name, prices) {
  const matches = matchingReferences(name, prices);
  const official = matches.filter((p) => p.sourceType !== 'retailer');
  const selected = official.length ? official : matches;
  if (!selected.length) return null;
  const unit = selected.some((p) => p.unit === 'kg') ? 'kg' : selected[0].unit;
  const records = selected.filter((p) => p.unit === unit);
  return { unit, price: records.reduce((sum, p) => sum + Number(p.price), 0) / records.length, records };
}

export function marketIngredientPriceText(ingredient, records) {
  const quote = ingredientQuote(ingredient.name, records);
  return quote ? `${quote.records[0].estimateType === 'comparable' ? 'Comparable estimate' : 'Estimated reference'} ${formatPrice(quote.price)} / ${quote.unit}` : 'Sourced price unavailable';
}

export function priceEvidence(records = []) {
  if (!records.length) return { label: 'No source', needsReview: true, reason: 'A verified matching price is required.' };
  if (records.some((p) => p.partial)) return { label: 'Partial-food assumption', needsReview: true, reason: 'Only a base ingredient is priced; other components are excluded.' };
  if (records.some((p) => p.estimateType === 'comparable')) return { label: 'Different-product assumption', needsReview: true, reason: 'A different species, cut or food supplies the price.' };
  if (records.some((p) => p.estimateType === 'raw')) return { label: 'Raw/cooked assumption', needsReview: true, reason: 'Raw and cooked weight or edible yield has not been verified.' };
  if (records.some((p) => p.notes || p.estimateType === 'product reference')) return { label: 'Variant/quantity assumption', needsReview: true, reason: 'Product variety, drained weight, edible yield or household quantity needs confirmation.' };
  if (records.some((p) => p.estimateType === 'FNRI portion reference')) return { label: 'FNRI-supported portion estimate', needsReview: false, reason: 'Uses published Philippine as-purchased / edible-portion weights. Actual preparation and store totals can differ.' };
  return { label: 'Matching source reference', needsReview: false, reason: 'A price for the matching listed product; local branch price may differ.' };
}

export function ingredientPriceAudit(name, ingredients, records) {
  const quote = ingredientQuote(name, records);
  const usages = ingredients.filter((i) => ingredientKey(i.name) === ingredientKey(name)).map((i) => priceIngredient(i, records));
  const evidenceRecords = usages.length ? usages.flatMap((i) => i.priceRecords) : quote?.records || [];
  const evidence = priceEvidence(evidenceRecords);
  const verificationTasks = [];
  if (!quote || evidenceRecords.some((p) => p.estimateType === 'comparable')) verificationTasks.push('Obtain a dated Philippine quote for this exact ingredient, species and cut, with PHP price and pack weight.');
  if (evidenceRecords.some((p) => p.estimateType === 'raw')) verificationTasks.push('Record measured raw purchase quantities and cooked output weight, or obtain a quote for the matching cooked product.');
  if (evidenceRecords.some((p) => p.partial)) verificationTasks.push('Include every preparation ingredient (such as oil, sugar or wrappers) and its measured quantity.');
  if (usages.some((i) => i.quantityEstimated || i.cost === null)) verificationTasks.push('Replace approximate quantities with measured grams, millilitres or exact piece counts matching the quoted unit.');
  if (evidenceRecords.some((p) => p.estimateType === 'product reference' || p.notes && !p.quantityEstimated)) verificationTasks.push('Confirm the product variant and any drained, shelled or edible weight against the recipe.');
  return { name, quote, evidence, recipeUsages: usages.length,
    verificationTasks,
    costedUsages: usages.filter((i) => i.cost !== null).length,
    assumptions: [...new Set(evidenceRecords.map((p) => p.notes).filter(Boolean))],
    conversionSources: [...new Set(evidenceRecords.map((p) => p.conversionSourceUrl).filter(Boolean))],
    conversionNotes: [...new Set(evidenceRecords.map((p) => p.conversionNote).filter(Boolean))] };
}

export function priceCoverage(foods, recipeIngredients, records) {
  const usedIds = new Set(recipeIngredients.map((i) => String(i.fct_id)).filter(Boolean));
  const usedNames = new Set(recipeIngredients.map((i) => ingredientKey(i.name)));
  const catalogue = foods.map((food) => ({ ...food, ...ingredientPriceAudit(food.food_name, recipeIngredients, records),
    inRecipes: usedIds.has(String(food.fct_id)) || usedNames.has(ingredientKey(food.food_name)) }));
  const recipeNames = [...new Set(recipeIngredients.map((i) => i.name).filter(Boolean))];
  return { catalogue, total: catalogue.length, priced: catalogue.filter((i) => i.quote).length,
    recipeUnique: recipeNames.length, recipePriced: recipeNames.filter((name) => ingredientQuote(name, records)).length,
    recipeEntries: recipeIngredients.length,
    recipeEntriesPriced: recipeIngredients.filter((i) => priceIngredient(i, records).cost !== null).length };
}

export function priceIngredient(ingredient, prices) {
  const quantity = parseRecipeQuantity(ingredient.quantity || ingredient.qty);
  const grams = Number(ingredient.grams);
  const weight = Number.isFinite(grams) && grams > 0 ? { amount: grams / 1000, unit: 'kg' } : null;
  const name = ingredient.name || ingredient.ingredient_name || ingredient.food_name;
  const references = matchingReferences(name, prices);
  const matches = references.flatMap((p) => {
    const documented = documentedPurchaseAmount(name, grams, p);
    if (documented) {
      const notes = String(p.notes || '').replace('Raw-ingredient estimate; weight-based costs assume equal raw/cooked weight. Cooking yield, oil, sugar, wrappers, labour and fuel are excluded.', '')
        .replace('Same-weight raw ingredient estimate; cooking yield, labour and fuel are not included.', '').trim();
      return [{ record: { ...p, notes, estimateType: 'FNRI portion reference',
        conversionSourceUrl: documented.sourceUrl, conversionDefinitionsUrl: FNRI_PORTION_DEFINITIONS,
        conversionNote: `DOST-FNRI reference for ${documented.sourceName}: ${documented.apGrams} g as purchased / ${documented.epGrams} g edible portion. Recipe ${grams} g EP uses ${(documented.amount * 1000).toFixed(2)} g AP for costing. Preparation costs are excluded.`,
        purchaseGrams: documented.amount * 1000 }, quantityEstimated: false, cost: Number(p.price) * documented.amount }];
    }
    const amount = p.unit === 'kg' ? weight || (quantity?.unit === 'kg' ? quantity : null)
      : quantity?.unit === p.unit ? quantity : null;
    return amount ? [{ record: amount === quantity && quantity.estimated ? { ...p, notes: [p.notes, quantity.note].filter(Boolean).join(' ') } : p,
      quantityEstimated: amount === quantity && quantity.estimated, cost: Number(p.price) * amount.amount }] : [];
  });
  const official = matches.filter((p) => p.record.sourceType !== 'retailer');
  const candidates = official.length ? official : matches;
  const cost = candidates.length ? Math.round(candidates.reduce((sum, p) => sum + p.cost, 0) / candidates.length * 100) / 100 : null;
  return { ...ingredient, cost, quantityEstimated: candidates.some((p) => p.quantityEstimated),
    evidence: priceEvidence(candidates.length ? candidates.map((p) => p.record) : references),
    pricingSource: candidates.length ? 'reference' : 'unavailable', priceRecords: candidates.length ? candidates.map((p) => p.record) : references };
}

export function applyDynamicRecipePrices(recipes, prices) {
  return recipes.map((recipe) => {
    const ingredients = (recipe.ingredients || []).map((ing) => priceIngredient(ing, prices || []));
    const complete = ingredients.length > 0 && ingredients.every((ing) => ing.cost !== null);
    const servings = Math.max(1, Number(recipe.servings) || 1);
    const cost = complete ? Math.round(ingredients.reduce((sum, ing) => sum + ing.cost, 0) / servings * 100) / 100
      : null;
    const partial = ingredients.some((ing) => ing.priceRecords.some((p) => p.partial));
    const raw = ingredients.some((ing) => ing.priceRecords.some((p) => p.estimateType === 'raw'));
    const quantityEstimated = ingredients.some((ing) => ing.quantityEstimated);
    const comparableEstimate = ingredients.some((ing) => ing.priceRecords.some((p) => p.estimateType === 'comparable'));
    const fnriPortion = ingredients.some((ing) => ing.priceRecords.some((p) => p.estimateType === 'FNRI portion reference'));
    const needsVerification = ingredients.some((ing) => ing.evidence.needsReview);
    return { ...recipe, ingredients, savedCost: recipe.savedCost ?? recipe.cost, cost, pricedCount: ingredients.filter((ing) => ing.cost !== null).length,
      priceIncomplete: !complete || partial, budgetEligible: complete && !partial && !needsVerification,
      needsVerification, quantityEstimated, comparableEstimate,
      pricingSource: complete ? partial ? 'partial' : comparableEstimate ? 'comparable estimate' : raw ? 'raw estimate' : quantityEstimated ? 'quantity estimate' : fnriPortion ? 'FNRI portion estimate' : 'reference' : 'unavailable' };
  });
}
export const pricingLabel = (r) => r.pricingSource === 'partial' ? 'Base-ingredient subtotal / serving'
  : r.pricingSource === 'FNRI portion estimate' ? 'FNRI portion estimate / serving'
  : r.pricingSource === 'comparable estimate' ? 'Comparable-product estimate / serving'
  : r.pricingSource === 'raw estimate' ? r.quantityEstimated ? 'Raw / quantity estimate per serving' : 'Raw-ingredient estimate / serving'
    : r.pricingSource === 'quantity estimate' ? 'Approximate quantity estimate / serving'
    : r.pricingSource === 'reference' ? 'Sourced estimate / serving' : 'Needs sourced price or quantity';
