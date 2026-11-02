// Prefer an empty matching slot; never guess between multiple occupied slots.
export function assignBudgetRecipe(slots, recipe, createSlotId) {
  const matches = slots.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.type === recipe.type);
  const empty = matches.filter(({ slot }) => !slot.mealId);
  const target = empty[0] || (matches.length === 1 ? matches[0] : null);
  if (!matches.length) throw new Error(`Add a ${recipe.type} slot to the selected day first, then use an existing recipe.`);
  if (!target) throw new Error(`This day has multiple ${recipe.type} slots. Use Swap meal on the slot you want to change.`);
  if (target.slot.mealId === recipe.id) return { slots, changed: false };
  const next = slots.map((slot, index) => index === target.index
    ? { ...slot, id: createSlotId(), mealId: recipe.id } : slot);
  return { slots: next, changed: true };
}
