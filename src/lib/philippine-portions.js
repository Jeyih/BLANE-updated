const FNRI_PORTIONS = {
  'Carrot, boiled': { apGrams: 51, epGrams: 45 },
  'Cabbage, green, boiled': { apGrams: 64, epGrams: 45 },
  'Squash fruit, boiled': { apGrams: 52, epGrams: 45, sourceName: 'Squash, fruit, boiled' },
  'String/Yard long bean pod, green, boiled': { apGrams: 42, epGrams: 45 },
};
const FNRI_PORTION_URL =
  'https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=1';
const FNRI_PORTION_DEFINITIONS = 'https://marfel.fnri.dost.gov.ph/marfel-faqs';
function documentedPurchaseAmount(name, edibleGrams, record) {
  const portion = FNRI_PORTIONS[name];
  if (
    !portion ||
    record.unit !== 'kg' ||
    record.estimateType !== 'raw' ||
    record.partial ||
    !Number.isFinite(Number(edibleGrams)) ||
    Number(edibleGrams) <= 0
  )
    return null;
  return {
    amount: ((Number(edibleGrams) / 1e3) * portion.apGrams) / portion.epGrams,
    unit: 'kg',
    apGrams: portion.apGrams,
    epGrams: portion.epGrams,
    sourceUrl: FNRI_PORTION_URL,
    sourceName: portion.sourceName || name,
  };
}
export { FNRI_PORTIONS, FNRI_PORTION_DEFINITIONS, FNRI_PORTION_URL, documentedPurchaseAmount };
