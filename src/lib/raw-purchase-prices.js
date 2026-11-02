// These mappings apply only to the uncooked FNRI ingredient names below.
// They never convert a cooked portion into a raw purchase weight.
const RAW_PURCHASES = {
  'Rice, well-milled': {
    name: 'White rice',
    matches: record => record.sourceType !== 'retailer' && /^Well Milled\b/i.test(record.description || ''),
  },
  'Oats, quick-cooking': {
    name: 'Oats, quick-cooking, ckd',
    matches: record => record.sourceUrl === 'https://shopmetro.ph/product/quaker-quick-cooking-oats-800g/' && /quick.?cooking oats/i.test(record.description || ''),
  },
  'Cabbage, green': {
    name: 'Cabbage, green, boiled',
    matches: record => record.sourceUrl === 'https://shopmetro.ph/product/lvd-cb-cabbage-1kg/' && /cabbage/i.test(record.description || ''),
  },
  'Chicken breast': {
    name: 'Chicken, white meat, boiled',
    matches: record => record.sourceUrl === 'https://shopmetro.ph/product/q-chicken-breast-fillet-1kg/' && /breast fillet/i.test(record.description || ''),
  },
  'Chayote fruit': {
    name: 'Chayote',
    matches: record => record.sourceType !== 'retailer' && /^Chayote\b/i.test(record.description || ''),
  },
  'Squash fruit': {
    name: 'Squash',
    matches: record => record.sourceType !== 'retailer' && /^Squash\b/i.test(record.description || ''),
  },
};

export function rawPurchaseReferences(name, records) {
  const mapping = RAW_PURCHASES[name];
  if (!mapping) return [];
  return records.filter(record => record.name === mapping.name && record.unit === 'kg' && !record.partial && mapping.matches(record)).map(record => ({
    ...record, name, estimateType: 'raw purchase reference', notes: '',
    conversionNote: 'Price matched to the listed uncooked ingredient. Quantities are raw purchase inputs; no cooked-to-raw yield conversion is used. Cooking water, fuel and preparation costs are excluded.',
  }));
}
