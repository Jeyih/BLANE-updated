// FAO/INFOODS Density Database v2.0: printed pp. 11, 12 and 19.
// Generic food reference values, not measurements of a particular brand.
const DENSITY_SOURCE = 'https://www.fao.org/docrep/017/ap815e/ap815e.pdf';
const DENSITIES = {
  'Soy sauce': { density: 1.12, page: 19, food: 'Sauce, soy' },
  'Oil, corn': { density: 0.922, page: 12, food: 'Oil, vegetable, corn' },
  'Milk, cow': { density: 1.03, page: 11, food: 'Milk, liquid' },
};

function densityPurchaseAmount(name, grams, record) {
  const entry = DENSITIES[name];
  if (!entry || record.unit !== 'l' || record.partial || record.notes ||
      (record.estimateType && record.estimateType !== 'product') ||
      !Number.isFinite(Number(grams)) || Number(grams) <= 0) return null;
  return {
    amount: Number(grams) / entry.density / 1000,
    sourceUrl: DENSITY_SOURCE,
    note: `FAO/INFOODS ${entry.food}: ${entry.density} g/ml (printed page ${entry.page}). ${grams} g / ${entry.density} = ${(Number(grams) / entry.density).toFixed(2)} ml. Generic density estimate; actual brand density can differ.`,
  };
}

function validCostBasis(basis) {
  return Boolean(basis && typeof basis.name === 'string' && basis.name.trim() &&
    Number.isFinite(Number(basis.grams)) && Number(basis.grams) > 0 &&
    Number.isFinite(Number(basis.amount)) && Number(basis.amount) > 0 &&
    ['kg', 'l', 'pc'].includes(basis.unit) &&
    /^https:\/\/[^\s]+$/i.test(basis.sourceUrl || '') &&
    typeof basis.evidence === 'string' && basis.evidence.trim().length >= 20 &&
    /^\d{4}-\d{2}-\d{2}$/.test(basis.measuredAt || '') && basis.confirmed === true);
}

function measuredPurchaseAmount(ingredient, record, bases = {}) {
  const basis = bases[String(ingredient.id)];
  // Editing recipe quantities or changing the quoted product invalidates old evidence.
  // Partial dishes and substitute products need a recipe/source revision, not an override.
  if (!ingredient.id || !validCostBasis(basis) || record.partial ||
      record.estimateType === 'comparable' || basis.name !== ingredient.name ||
      Number(basis.grams) !== Number(ingredient.grams) ||
      String(basis.quantity || '') !== String(ingredient.quantity ?? ingredient.qty ?? '') ||
      basis.sourceUrl !== record.sourceUrl || basis.unit !== record.unit) return null;
  return { amount: Number(basis.amount), sourceUrl: basis.sourceUrl,
    note: `Recorded purchase quantity: ${basis.amount} ${basis.unit} for this ingredient's ${basis.grams} g nutrition portion. Recorded ${basis.measuredAt}. ${basis.evidence}` };
}

export { DENSITIES, DENSITY_SOURCE, densityPurchaseAmount, measuredPurchaseAmount, validCostBasis };
