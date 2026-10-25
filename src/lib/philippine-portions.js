function documentedPurchaseAmount(name, edibleGrams, record, portions = {}, metadata = {}) {
  const portion = portions[name];
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
    sourceUrl: metadata.sourceUrl || null,
    sourceName: portion.sourceName || name,
  };
}

export { documentedPurchaseAmount };
