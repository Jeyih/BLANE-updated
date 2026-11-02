import { computeDailyTargets as sharedDailyTargets } from '../../supabase/functions/_shared/nutrition.js';
export function buildPortionPreview(meal, totalMealsToday, profile, selectedScale = 1) {
  const daily = sharedDailyTargets(profile);
  totalMealsToday = Math.max(1, Number(totalMealsToday) || 4);
  const perMealKcal = Math.round(daily.calories / totalMealsToday);
  const originalKcal = meal.kcal;
  const value = Number(selectedScale);
  const scaleFactor = Number.isFinite(value) ? Math.max(0.5, Math.min(2, value)) : 1;
  const optimizedKcal = Math.round(originalKcal * scaleFactor);
  const optimizedProtein = Math.round(meal.protein * scaleFactor);
  const optimizedCarbs = Math.round(meal.carbs * scaleFactor);
  const optimizedFats = Math.round(meal.fats * scaleFactor);
  const mealProteinTarget = Math.round(daily.protein / totalMealsToday);
  const mealCarbsTarget = Math.round(daily.carbs / totalMealsToday);
  const mealFatsTarget = Math.round(daily.fats / totalMealsToday);
  const scaledIngredients = meal.ingredients.map((ing) => scaleIngredient(ing, scaleFactor));
  return {
    scaleFactor,
    perMealKcal,
    originalKcal,
    optimizedKcal,
    cost: meal.cost == null || !Number.isFinite(Number(meal.cost)) ? null : Math.round(Number(meal.cost) * scaleFactor * 100) / 100,
    original: { protein: meal.protein, carbs: meal.carbs, fats: meal.fats },
    optimized: { protein: optimizedProtein, carbs: optimizedCarbs, fats: optimizedFats },
    targets: {
      protein: mealProteinTarget,
      carbs: mealCarbsTarget,
      fats: mealFatsTarget,
      calories: perMealKcal,
    },
    ingredients: scaledIngredients,
    daily,
  };
}
function scaleIngredient(ing, factor) {
  const original = ing.quantity ?? ing.qty;
  const optimized = scaleQtyString(original, factor);
  return {
    name: ing.name,
    status: ing.status,
    original,
    optimized,
    factor,
    changed: Math.abs(factor - 1) > 0.05,
    increased: factor > 1.05,
    decreased: factor < 0.95,
  };
}
function scaleQtyString(qtyStr, factor) {
  if (!qtyStr || qtyStr === 'to taste') return qtyStr;
  const normalizedQty = String(qtyStr).trim();
  const match = normalizedQty.match(
    /^(\s*~?\s*)(?:scant\s+)?(\d+(?:\s+\d+\/\d+|\/\d+)?|[½¼¾⅓⅔])\s*(.*)$/i,
  );
  if (!match) return qtyStr;
  const [, estimatePrefix, amount, unit] = match;
  const num = parseFraction(amount);
  if (isNaN(num) || num === 0) return qtyStr;
  if (factor === 1) return qtyStr;
  if (/^(?:g|grams?|kg|ml|l|liters?)\b/i.test(unit)) {
    return estimatePrefix + Number((num * factor).toFixed(2)) + ' ' + unit;
  }
  const countUnit =
    /\b(?:pc|pcs|piece|pieces|clove|cloves|slice|slices|stalk|stalks|pod|pods|link|links|egg|eggs|banana|tomato|onion|carrot|potato|shrimp|sachet|sachets|can|cans|disc|discs|portion|serving|breast|gourd|fish|squid|puto|saba)\b/i.test(
      unit,
    );
  const denominator = countUnit ? 2 : 4;
  const scaled = Math.max(1 / denominator, Math.round(num * factor * denominator) / denominator);
  const formatted = formatQuantityNumber(scaled, denominator);
  return estimatePrefix + formatted + (unit ? ' ' + unit : '');
}
function parseFraction(str) {
  const fracts = { '\xBD': 0.5, '\xBC': 0.25, '\xBE': 0.75, '\u2153': 0.333, '\u2154': 0.667 };
  if (fracts[str]) return fracts[str];
  if (str.includes(' ')) {
    const [whole, fraction] = str.split(/\s+/, 2);
    return parseFloat(whole) + parseFraction(fraction);
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str);
}
function formatQuantityNumber(value, denominator) {
  const rounded = Math.round(value * denominator) / denominator;
  const whole = Math.floor(rounded);
  const numerator = Math.round((rounded - whole) * denominator);
  const fraction = denominator === 2 ? { 1: '1/2' } : { 1: '1/4', 2: '1/2', 3: '3/4' };
  if (!numerator) return String(whole);
  return whole ? `${whole} ${fraction[numerator]}` : fraction[numerator];
}
