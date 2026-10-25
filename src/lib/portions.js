export function appliedMeal(meal, applied) {
  if (!meal) return meal;
  const scale = Number(applied?.scaleFactor);
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 2) return meal;
  const scaled = { ...meal };
  for (const key of ['kcal', 'protein', 'carbs', 'fats']) scaled[key] = Math.round((Number(meal[key]) || 0) * scale);
  if (Number.isFinite(Number(meal.cost))) scaled.cost = Math.round(Number(meal.cost) * scale * 100) / 100;
  scaled.ingredients = (meal.ingredients || []).map(ing => ({ ...ing, qty: applied.ingredients?.find(i => i.name === ing.name)?.optimized || ing.qty, quantity: applied.ingredients?.find(i => i.name === ing.name)?.optimized || ing.quantity, grams: ing.grams == null ? null : Number(ing.grams) * scale }));
  return scaled;
}
