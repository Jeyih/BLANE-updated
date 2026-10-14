export function isBudgetPriced(meal) {
  return meal.budgetEligible === true && !meal.priceIncomplete && !meal.needsVerification
    && Number.isFinite(meal.cost) && meal.cost >= 0;
}

export function isAffordableMeal(meal, perMealBudget) {
  return Number.isFinite(perMealBudget) && perMealBudget >= 0
    && isBudgetPriced(meal) && meal.cost <= perMealBudget;
}
