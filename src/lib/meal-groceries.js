import { priceIngredient } from './pricing.js';

export function replaceGrocerySources(previous, sources) {
  const keys = new Set(sources.map(source => source.key));
  const recipes = new Set(sources.map(source => source.meal.id));
  const retained = previous.filter(item => !keys.has(item.sourceKey) && (item.sourceKey || !recipes.has(item.mealId)));
  return [...retained, ...sources.flatMap(source => (source.meal.ingredients || []).map((ingredient, index) => ({
    sourceKey: source.key, sourceLabel: source.label, mealId: source.meal.id,
    lineKey: `${source.key}:${index}`, name: ingredient.name,
    qty: shoppingQuantity(ingredient.qty ?? ingredient.quantity ?? '—', source.meal.servings), checked: false,
    pricingIngredient: pricingBasis(source.baseMeal?.ingredients?.[index] || ingredient),
    priceScale: (Number(source.meal.portionScale) || 1) / Math.max(1, Number(source.meal.servings) || 1),
  })))];
}
function pricingBasis(ingredient) {
  return { id: ingredient.id, name: ingredient.name, grams: ingredient.grams,
    quantity: ingredient.quantity ?? ingredient.qty };
}
function shoppingQuantity(value, servings) {
  const count = Math.max(1, Number(servings) || 1);
  if (count === 1) return value;
  const parsed = quantity(value);
  return parsed ? `${Number((parsed.number / count).toFixed(3))} ${parsed.unit}` : `(${value}) ÷ ${count} servings`;
}

// Cost only the entries actually added to the list; never reuse the whole day's total.
// Reprice against current references instead of trusting a saved cost snapshot.
export function groceryCost(items, records = [], references = {}) {
  const priced = items.map(item => ({ item,
    ingredient: priceIngredient(item.pricingIngredient || { name: item.name, quantity: item.qty }, records, references),
  }));
  const known = priced.filter(({ ingredient }) => ingredient.cost !== null);
  const missing = priced.length - known.length;
  const needsReview = priced.filter(({ ingredient }) => ingredient.cost !== null && ingredient.evidence.needsReview).length;
  return {
    cost: known.length ? Math.round(known.reduce((sum, { item, ingredient }) => sum + ingredient.cost *
      (Number.isFinite(item.priceScale) && item.priceScale > 0 ? item.priceScale : 1), 0) * 100) / 100 : null,
    incomplete: missing > 0 || needsReview > 0,
    missing, needsReview,
  };
}

const UNITS = { g:'g', gram:'g', grams:'g', kg:'kg', kilogram:'kg', kilograms:'kg', ml:'ml', l:'l', liter:'l', liters:'l', cup:'cup', cups:'cup', tsp:'tsp', tbsp:'tbsp', pc:'pc', pcs:'pc', piece:'pc', pieces:'pc' };
function quantity(value) {
  const match = String(value ?? '').trim().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*([a-z]+)\.?$/i);
  const unit = match && UNITS[match[2].toLowerCase()];
  if (!unit) return null;
  const number = match[1].split(/\s+/).reduce((sum, part) => {
    const [top, bottom] = part.split('/').map(Number);
    return sum + (bottom === undefined ? top : top / bottom);
  }, 0);
  return Number.isFinite(number) ? { number, unit } : null;
}

export function groceryRows(items) {
  const rows = new Map();
  items.forEach((item, index) => {
    const parsed = quantity(item.qty);
    // Combine only known, compatible units. Never invent conversions or missing quantities.
    const key = parsed ? `${String(item.name).trim().toLowerCase()}:${parsed.unit}` : `uncombined:${index}`;
    let row = rows.get(key);
    if (!row) {
      row = { key, name: item.name, qty: item.qty, amount: 0, unit: parsed?.unit, checked: true, indices: [], sourceLabels: [] };
      rows.set(key, row);
    }
    row.indices.push(index);
    row.checked = row.checked && Boolean(item.checked);
    if (item.sourceLabel && !row.sourceLabels.includes(item.sourceLabel)) row.sourceLabels.push(item.sourceLabel);
    if (parsed) { row.amount += parsed.number; row.qty = `${Number(row.amount.toFixed(3))} ${parsed.unit}`; }
  });
  return [...rows.values()];
}
