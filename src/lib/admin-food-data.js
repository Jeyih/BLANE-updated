import { ingredientQuote } from './pricing.js';

// Missing values always stay last, including when sorting descending.
export function sortFoodData(items, sort, records = [], references = {}) {
  const value = (item) => sort.key === 'price'
    ? ingredientQuote(item.food_name, records, references)?.price ?? null
    : item[sort.key];
  // Resolve each sourced quote once, rather than on every sort comparison.
  return items.map(item => ({ item, value: value(item) })).sort((a, b) => {
    const av = a.value, bv = b.value;
    const missing = (v) => v == null || v === '' || !Number.isFinite(Number(v));
    if (sort.key !== 'food_name') {
      if (missing(av) !== missing(bv)) return missing(av) ? 1 : -1;
      if (!missing(av) && Number(av) !== Number(bv))
        return (Number(av) - Number(bv)) * (sort.direction === 'desc' ? -1 : 1);
    }
    return String(a.item.food_name || '').localeCompare(String(b.item.food_name || '')) ||
      String(a.item.fct_id).localeCompare(String(b.item.fct_id));
  }).map(entry => entry.item);
}
