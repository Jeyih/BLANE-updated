import { documentedPurchaseAmount } from './philippine-portions.js';
function ingredientKey(name, aliases = {}) {
  const key = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return aliases[key] || key;
}
const formatPrice = (v) =>
  Number.isFinite(v) && v > 0 ? `\u20B1${v.toFixed(2)}` : 'Price unavailable';
const formatEstimatedPrice = (v) =>
  Number.isFinite(v) && v > 0 ? `Est. ${formatPrice(v)}` : 'Estimate unavailable';
const RETAIL_HOSTS = new Set([
  'shopmetro.ph',
  'jelexie.ph',
  'pindotlang.com',
  'montereycommunityonlinemarket.com.ph',
  'shop.gerald.ph',
  'barrelsandbeyondph.com',
  'shop.monkeyspeakcoffee.com',
  'www.thesausageguy.shop',
]);
function isSourcedPrice(record) {
  if (
    (record.currency && record.currency !== 'PHP') ||
    (record.sourceCountry && record.sourceCountry !== 'PH')
  )
    return false;
  if (
    record.kind !== 'reference' ||
    !Number.isFinite(Number(record.price)) ||
    Number(record.price) <= 0
  )
    return false;
  try {
    const url = new URL(record.sourceUrl);
    if (url.protocol !== 'https:') return false;
    return (
      url.hostname === 'www.da.gov.ph' ||
      (record.sourceType === 'retailer' &&
        record.verified === true &&
        RETAIL_HOSTS.has(url.hostname))
    );
  } catch {
    return false;
  }
}
function matchingReferences(name, prices, referenceData = {}) {
  const aliases = referenceData.aliases || {};
  const key = ingredientKey(name, aliases);
  const sourced = prices.filter(isSourcedPrice);
  const direct = sourced.filter((p) => (p.key || ingredientKey(p.name, aliases)) === key);
  if (direct.length) {
    const official = direct.filter((p) => p.sourceType !== 'retailer');
    return [...official, ...direct.filter((p) => p.sourceType === 'retailer')];
  }
  const comparable = referenceData.comparablePriceMappings?.[name];
  if (comparable) {
    const benchmarks = sourced.filter(
      (p) => (p.key || ingredientKey(p.name, aliases)) === ingredientKey(comparable.name, aliases),
    );
    if (benchmarks.length)
      return benchmarks.map((p) => ({
        ...p,
        estimateType: 'comparable',
        benchmarkName: comparable.name,
        notes: `Comparable-product estimate: ${comparable.note} ${p.notes || ''}`.trim(),
      }));
  }
  const rawMapping = referenceData.rawDaMappings?.[name];
  const mapped = rawMapping || referenceData.daNameMappings?.[name];
  if (!mapped) return [];
  return sourced
    .filter((p) => (p.key || ingredientKey(p.name, aliases)) === ingredientKey(mapped, aliases))
    .map((p) => ({
      ...p,
      estimateType: rawMapping ? 'raw' : 'product reference',
      partial: referenceData.partialRawFoods?.has(name) || false,
      notes: rawMapping
        ? 'Raw-ingredient estimate; weight-based costs assume equal raw/cooked weight. Cooking yield, oil, sugar, wrappers, labour and fuel are excluded.'
        : `${mapped} reference used; the exact variety is not specified in the recipe.`,
    }));
}
function parsePriceQuantity(value) {
  if (typeof value === 'number') return value > 0 ? { amount: value / 1e3, unit: 'kg' } : null;
  const fractions = {
    '\xBD': '1/2',
    '\xBC': '1/4',
    '\xBE': '3/4',
    '\u2153': '1/3',
    '\u2154': '2/3',
  };
  const text = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(\d)([½¼¾⅓⅔])/g, '$1 $2')
    .replace(/[½¼¾⅓⅔]/g, (v) => fractions[v]);
  const match = text.match(
    /^(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(kg|kilograms?|g|grams?|ml|milliliters?|l|liters?|pc|pcs|pieces?|eggs?|tbsp|tsp)\.?$/,
  );
  if (!match) return null;
  const amount = match[1].split(/\s+/).reduce((sum, part) => {
    if (!part.includes('/')) return sum + Number(part);
    const [a, b] = part.split('/').map(Number);
    return sum + a / b;
  }, 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2];
  if (/^(g|grams?)$/.test(unit)) return { amount: amount / 1e3, unit: 'kg' };
  if (/^(kg|kilograms?)$/.test(unit)) return { amount, unit: 'kg' };
  if (/^(ml|milliliters?)$/.test(unit)) return { amount: amount / 1e3, unit: 'l' };
  if (/^(l|liters?)$/.test(unit)) return { amount, unit: 'l' };
  if (unit === 'tbsp' || unit === 'tsp')
    return { amount: amount * (unit === 'tbsp' ? 0.015 : 0.005), unit: 'l' };
  return { amount, unit: 'pc' };
}
function parseRecipeQuantity(value) {
  if (typeof value === 'number') {
    const amount = parsePriceQuantity(value);
    return amount ? { ...amount, estimated: false, note: '' } : null;
  }
  const original = String(value ?? '').trim();
  const approximate = /^(?:~|≈|about\b|approximately\b)|\bscant\b/i.test(original);
  const text = original
    .toLowerCase()
    .replace(/^(?:~|≈|about\b|approximately\b)\s*/, '')
    .replace(/^scant\s+/, '')
    .replace(/tablespoons?/g, 'tbsp')
    .replace(/teaspoons?/g, 'tsp')
    .replace(/\s+cooked$/, '');
  const parts = text.split(/\s*\+\s*/);
  const amounts = parts.map((part) => {
    const cup = part.match(/^(.+?)\s+cups?$/);
    if (!cup) return parsePriceQuantity(part);
    const count = parsePriceQuantity(`${cup[1]} pc`);
    return count ? { amount: count.amount * 0.24, unit: 'l' } : null;
  });
  if (!amounts.length || amounts.some((p) => !p) || amounts.some((p) => p.unit !== amounts[0].unit))
    return null;
  const household = /\b(?:cups?|tbsp|tsp)\b/.test(text);
  return {
    amount: amounts.reduce((sum, p) => sum + p.amount, 0),
    unit: amounts[0].unit,
    estimated: approximate || household,
    note: [
      approximate ? `Approximate recipe quantity: ${original}.` : '',
      household ? 'Budgeting measures: 1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml.' : '',
      /\bscant\b/i.test(original)
        ? 'Scant amount is priced at the stated full measure as an upper approximation.'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
function normalizeMarketPrices(rows, markets, referenceData = {}) {
  const aliases = referenceData.aliases || {};
  const byId = new Map(markets.map((m) => [String(m.id), m]));
  return rows.flatMap((row) => {
    const market = byId.get(String(row.market_id));
    if (
      !market ||
      row.status === 'unavail'
    )
      return [];
    const perKg = Number(row.price_per_kg) > 0;
    const basis = perKg ? { amount: 1, unit: 'kg' } : parsePriceQuantity(row.qty);
    const price = Number(perKg ? row.price_per_kg : row.price);
    if (!basis || !Number.isFinite(price) || price <= 0) return [];
    return [
      {
        name: row.name,
        key: ingredientKey(row.name, aliases),
        price: price / basis.amount,
        unit: basis.unit,
        kind: 'local',
        region: market.address || market.name || 'Local market',
        source: market.name,
        sourceUrl: null,
        observedAt: row.updated_at || null,
      },
    ];
  });
}
async function loadMarketIngredientPrices(supabase, referenceData = {}) {
  const [ingredients, markets] = await Promise.all([
    loadAllPriceRows(supabase, 'market_ingredients', '*', 'id'),
    loadAllPriceRows(supabase, 'markets', 'id,name,address', 'id'),
  ]);
  return normalizeMarketPrices(ingredients, markets, referenceData);
}
async function loadAllPriceRows(supabase, table, columns = '*', order = 'id') {
  const rows = [];
  for (let from = 0; ; from += 1e3) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + 999);
    if (error) throw new Error(`Could not load ${table}.`);
    rows.push(...(data || []));
    if ((data || []).length < 1e3) return rows;
  }
}
async function loadPriceCatalogue(supabase) {
  const [foods, recipeIngredients] = await Promise.all([
    loadAllPriceRows(supabase, 'fnri_food_composition', 'fct_id,food_name', 'fct_id'),
    loadAllPriceRows(supabase, 'recipe_ingredients', 'id,fct_id,name,grams,quantity'),
  ]);
  return { foods, recipeIngredients };
}
function ingredientQuote(name, prices, referenceData = {}) {
  const matches = matchingReferences(name, prices, referenceData);
  const official = matches.filter((p) => p.sourceType !== 'retailer');
  const selected = official.length ? official : matches;
  if (!selected.length) return null;
  const unit = selected.some((p) => p.unit === 'kg') ? 'kg' : selected[0].unit;
  const records = selected.filter((p) => p.unit === unit);
  return {
    unit,
    price: records.reduce((sum, p) => sum + Number(p.price), 0) / records.length,
    records,
  };
}
function marketIngredientPriceText(ingredient, records, referenceData = {}) {
  const quote = ingredientQuote(ingredient.name, records, referenceData);
  return quote
    ? `${quote.records[0].estimateType === 'comparable' ? 'Comparable estimate' : 'Estimated reference'} ${formatPrice(quote.price)} / ${quote.unit}`
    : 'Sourced price unavailable';
}
function priceEvidence(records = []) {
  if (!records.length)
    return {
      label: 'No source',
      needsReview: true,
      reason: 'A verified matching price is required.',
    };
  if (records.some((p) => p.partial))
    return {
      label: 'Partial-food assumption',
      needsReview: true,
      reason: 'Only a base ingredient is priced; other components are excluded.',
    };
  if (records.some((p) => p.estimateType === 'comparable'))
    return {
      label: 'Different-product assumption',
      needsReview: true,
      reason: 'A different species, cut or food supplies the price.',
    };
  if (records.some((p) => p.estimateType === 'raw'))
    return {
      label: 'Raw/cooked assumption',
      needsReview: true,
      reason: 'Raw and cooked weight or edible yield has not been verified.',
    };
  if (records.some((p) => p.notes || p.estimateType === 'product reference'))
    return {
      label: 'Variant/quantity assumption',
      needsReview: true,
      reason:
        'Product variety, drained weight, edible yield or household quantity needs confirmation.',
    };
  if (records.some((p) => p.estimateType === 'FNRI portion reference'))
    return {
      label: 'FNRI-supported portion estimate',
      needsReview: false,
      reason:
        'Uses published Philippine as-purchased / edible-portion weights. Actual preparation and store totals can differ.',
    };
  return {
    label: 'Matching source reference',
    needsReview: false,
    reason: 'A price for the matching listed product; local branch price may differ.',
  };
}
function ingredientPriceAudit(name, ingredients, records, referenceData = {}) {
  const aliases = referenceData.aliases || {};
  const quote = ingredientQuote(name, records, referenceData);
  const usages = ingredients
    .filter((i) => ingredientKey(i.name, aliases) === ingredientKey(name, aliases))
    .map((i) => priceIngredient(i, records, referenceData));
  const evidenceRecords = usages.length
    ? usages.flatMap((i) => i.priceRecords)
    : quote?.records || [];
  const evidence = priceEvidence(evidenceRecords);
  const verificationTasks = [];
  if (!quote || evidenceRecords.some((p) => p.estimateType === 'comparable'))
    verificationTasks.push(
      'Obtain a dated Philippine quote for this exact ingredient, species and cut, with PHP price and pack weight.',
    );
  if (evidenceRecords.some((p) => p.estimateType === 'raw'))
    verificationTasks.push(
      'Record measured raw purchase quantities and cooked output weight, or obtain a quote for the matching cooked product.',
    );
  if (evidenceRecords.some((p) => p.partial))
    verificationTasks.push(
      'Include every preparation ingredient (such as oil, sugar or wrappers) and its measured quantity.',
    );
  if (usages.some((i) => i.quantityEstimated || i.cost === null))
    verificationTasks.push(
      'Replace approximate quantities with measured grams, millilitres or exact piece counts matching the quoted unit.',
    );
  if (
    evidenceRecords.some(
      (p) => p.estimateType === 'product reference' || (p.notes && !p.quantityEstimated),
    )
  )
    verificationTasks.push(
      'Confirm the product variant and any drained, shelled or edible weight against the recipe.',
    );
  return {
    name,
    quote,
    evidence,
    recipeUsages: usages.length,
    verificationTasks,
    costedUsages: usages.filter((i) => i.cost !== null).length,
    assumptions: [...new Set(evidenceRecords.map((p) => p.notes).filter(Boolean))],
    conversionSources: [
      ...new Set(evidenceRecords.map((p) => p.conversionSourceUrl).filter(Boolean)),
    ],
    conversionNotes: [...new Set(evidenceRecords.map((p) => p.conversionNote).filter(Boolean))],
  };
}
function priceCoverage(foods, recipeIngredients, records, referenceData = {}) {
  const aliases = referenceData.aliases || {};
  const usedIds = new Set(recipeIngredients.map((i) => String(i.fct_id)).filter(Boolean));
  const usedNames = new Set(recipeIngredients.map((i) => ingredientKey(i.name, aliases)));
  const catalogue = foods.map((food) => ({
    ...food,
    ...ingredientPriceAudit(food.food_name, recipeIngredients, records, referenceData),
    inRecipes:
      usedIds.has(String(food.fct_id)) || usedNames.has(ingredientKey(food.food_name, aliases)),
  }));
  const recipeNames = [...new Set(recipeIngredients.map((i) => i.name).filter(Boolean))];
  return {
    catalogue,
    total: catalogue.length,
    priced: catalogue.filter((i) => i.quote).length,
    recipeUnique: recipeNames.length,
    recipePriced: recipeNames.filter((name) => ingredientQuote(name, records, referenceData)).length,
    recipeEntries: recipeIngredients.length,
    recipeEntriesPriced: recipeIngredients.filter(
      (i) => priceIngredient(i, records, referenceData).cost !== null,
    )
      .length,
  };
}
function priceIngredient(ingredient, prices, referenceData = {}) {
  const quantity = parseRecipeQuantity(ingredient.quantity || ingredient.qty);
  const grams = Number(ingredient.grams);
  const weight = Number.isFinite(grams) && grams > 0 ? { amount: grams / 1e3, unit: 'kg' } : null;
  const name = ingredient.name || ingredient.ingredient_name || ingredient.food_name;
  const references = matchingReferences(name, prices, referenceData);
  const matches = references.flatMap((p) => {
    const documented = documentedPurchaseAmount(
      name,
      grams,
      p,
      referenceData.fnriPortions,
      referenceData.fnriPortionMeta || {},
    );
    if (documented) {
      const notes = String(p.notes || '')
        .replace(
          'Raw-ingredient estimate; weight-based costs assume equal raw/cooked weight. Cooking yield, oil, sugar, wrappers, labour and fuel are excluded.',
          '',
        )
        .replace(
          'Same-weight raw ingredient estimate; cooking yield, labour and fuel are not included.',
          '',
        )
        .trim();
      return [
        {
          record: {
            ...p,
            notes,
            estimateType: 'FNRI portion reference',
            conversionSourceUrl: documented.sourceUrl,
            conversionDefinitionsUrl: referenceData.fnriPortionMeta?.definitionsUrl || null,
            conversionNote: `DOST-FNRI reference for ${documented.sourceName}: ${documented.apGrams} g as purchased / ${documented.epGrams} g edible portion. Recipe ${grams} g EP uses ${(documented.amount * 1e3).toFixed(2)} g AP for costing. Preparation costs are excluded.`,
            purchaseGrams: documented.amount * 1e3,
          },
          quantityEstimated: false,
          cost: Number(p.price) * documented.amount,
        },
      ];
    }
    const amount =
      p.unit === 'kg'
        ? weight || (quantity?.unit === 'kg' ? quantity : null)
        : quantity?.unit === p.unit
          ? quantity
          : null;
    return amount
      ? [
          {
            record:
              amount === quantity && quantity.estimated
                ? { ...p, notes: [p.notes, quantity.note].filter(Boolean).join(' ') }
                : p,
            quantityEstimated: amount === quantity && quantity.estimated,
            cost: Number(p.price) * amount.amount,
          },
        ]
      : [];
  });
  const official = matches.filter((p) => p.record.sourceType !== 'retailer');
  const candidates = official.length ? official : matches;
  const cost = candidates.length
    ? Math.round((candidates.reduce((sum, p) => sum + p.cost, 0) / candidates.length) * 100) / 100
    : null;
  return {
    ...ingredient,
    cost,
    quantityEstimated: candidates.some((p) => p.quantityEstimated),
    evidence: priceEvidence(candidates.length ? candidates.map((p) => p.record) : references),
    pricingSource: candidates.length ? 'reference' : 'unavailable',
    priceRecords: candidates.length ? candidates.map((p) => p.record) : references,
  };
}
function applyDynamicRecipePrices(recipes, prices, referenceData = {}) {
  return recipes.map((recipe) => {
    const ingredients = (recipe.ingredients || []).map((ing) =>
      priceIngredient(ing, prices || [], referenceData),
    );
    const complete = ingredients.length > 0 && ingredients.every((ing) => ing.cost !== null);
    const servings = Math.max(1, Number(recipe.servings) || 1);
    const cost = complete
      ? Math.round((ingredients.reduce((sum, ing) => sum + ing.cost, 0) / servings) * 100) / 100
      : null;
    const partial = ingredients.some((ing) => ing.priceRecords.some((p) => p.partial));
    const raw = ingredients.some((ing) => ing.priceRecords.some((p) => p.estimateType === 'raw'));
    const quantityEstimated = ingredients.some((ing) => ing.quantityEstimated);
    const comparableEstimate = ingredients.some((ing) =>
      ing.priceRecords.some((p) => p.estimateType === 'comparable'),
    );
    const fnriPortion = ingredients.some((ing) =>
      ing.priceRecords.some((p) => p.estimateType === 'FNRI portion reference'),
    );
    const needsVerification = ingredients.some((ing) => ing.evidence.needsReview);
    return {
      ...recipe,
      ingredients,
      savedCost: recipe.savedCost ?? recipe.cost,
      cost,
      pricedCount: ingredients.filter((ing) => ing.cost !== null).length,
      priceIncomplete: !complete || partial,
      budgetEligible: complete && !partial && !needsVerification,
      needsVerification,
      quantityEstimated,
      comparableEstimate,
      pricingSource: complete
        ? partial
          ? 'partial'
          : comparableEstimate
            ? 'comparable estimate'
            : raw
              ? 'raw estimate'
              : quantityEstimated
                ? 'quantity estimate'
                : fnriPortion
                  ? 'FNRI portion estimate'
                  : 'reference'
        : 'unavailable',
    };
  });
}
const pricingLabel = (r) =>
  r.pricingSource === 'partial'
    ? 'Base-ingredient subtotal / serving'
    : r.pricingSource === 'FNRI portion estimate'
      ? 'FNRI portion estimate / serving'
      : r.pricingSource === 'comparable estimate'
        ? 'Comparable-product estimate / serving'
        : r.pricingSource === 'raw estimate'
          ? r.quantityEstimated
            ? 'Raw / quantity estimate per serving'
            : 'Raw-ingredient estimate / serving'
          : r.pricingSource === 'quantity estimate'
            ? 'Approximate quantity estimate / serving'
            : r.pricingSource === 'reference'
              ? 'Sourced estimate / serving'
              : 'Needs sourced price or quantity';
export {
  applyDynamicRecipePrices,
  formatEstimatedPrice,
  formatPrice,
  ingredientKey,
  ingredientPriceAudit,
  ingredientQuote,
  isSourcedPrice,
  loadAllPriceRows,
  loadMarketIngredientPrices,
  loadPriceCatalogue,
  marketIngredientPriceText,
  normalizeMarketPrices,
  parsePriceQuantity,
  parseRecipeQuantity,
  priceCoverage,
  priceEvidence,
  priceIngredient,
  pricingLabel,
};
