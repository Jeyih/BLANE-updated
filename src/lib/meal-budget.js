function isBudgetPriced(meal) {
  return (
    meal.budgetEligible === true &&
    !meal.priceIncomplete &&
    !meal.needsVerification &&
    Number.isFinite(meal.cost) &&
    meal.cost >= 0
  );
}
function isAffordableMeal(meal, perMealBudget) {
  return (
    Number.isFinite(perMealBudget) &&
    perMealBudget >= 0 &&
    isBudgetPriced(meal) &&
    meal.cost <= perMealBudget
  );
}
export { isAffordableMeal, isBudgetPriced };

export function isReviewEstimate(meal) {
  return isBudgetPriced(meal) || (meal.priceIncomplete === false &&
    Number.isFinite(meal.cost) && meal.cost >= 0 && meal.pricingSource !== 'partial' &&
    meal.ingredients?.length > 0 && meal.ingredients.every(ingredient =>
      Number.isFinite(ingredient.cost) && ingredient.cost >= 0 && ingredient.priceRecords?.length > 0 &&
      !ingredient.priceRecords.some(record => record.partial)));
}

export function mealBudget(dailyBudget, slots = []) {
  const count = slots.length;
  return count && Number.isFinite(dailyBudget) && dailyBudget >= 0 ? dailyBudget / count : null;
}

// Unknown custom categories use their assigned recipe; never silently substitute
// an unrelated meal type. Repeated slots each contribute to the full-day cost.
export function cheapestPlannedDay(meals, slots = [], { includeEstimates = false } = {}) {
  const missing = [];
  const choices = slots.map((slot, index) => {
    const typed = meals.filter(meal => meal.type === slot.type);
    const pool = typed.length ? typed : meals.filter(meal => String(meal.id) === String(slot.mealId));
    const valid = pool.filter(includeEstimates ? isReviewEstimate : isBudgetPriced).sort((a, b) => a.cost - b.cost);
    if (!valid.length) missing.push({ index, type: slot.type, recipes: pool });
    return valid[0] || null;
  });
  const pricedChoices = choices.filter(Boolean);
  const subtotal = pricedChoices.length ? Math.round(pricedChoices.reduce((sum, meal) => sum + meal.cost, 0) * 100) / 100 : null;
  return { cost: slots.length && !missing.length ? subtotal : null, subtotal, pricedSlots: pricedChoices.length, totalSlots: slots.length, missing, choices };
}

export function recipePriceGaps(recipe) {
  const gaps = (recipe.ingredients || []).flatMap(ingredient => {
    const records = ingredient.priceRecords || [];
    const reasons = [];
    if (ingredient.cost == null) reasons.push(records.length ? 'quantity or unit conversion missing' : 'source price missing');
    if (records.some(record => record.partial)) reasons.push('prepared-food components incomplete');
    if (ingredient.quantityEstimated || ingredient.evidence?.needsReview) reasons.push('quantity or product match needs verification');
    return reasons.length ? [`${ingredient.name || 'Ingredient'}: ${reasons.join('; ')}`] : [];
  });
  return gaps.length ? gaps : isBudgetPriced(recipe) ? [] : ['Complete ingredient prices and matching quantities are required.'];
}
