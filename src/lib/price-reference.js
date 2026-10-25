const PRICE_REFERENCE_CATEGORIES = [
  'da_price',
  'retail_price',
  'da_report',
  'da_catalog',
  'metro_source',
  'shopify_source',
  'retail_special',
  'price_alias',
  'raw_da_mapping',
  'da_name_mapping',
  'comparable_price_mapping',
  'partial_raw_food',
  'fnri_portion',
  'fnri_portion_meta',
];

function groupPriceReferenceRows(rows) {
  const grouped = Object.fromEntries(PRICE_REFERENCE_CATEGORIES.map((category) => [category, []]));
  for (const row of rows || []) {
    if (grouped[row.catalogue]) grouped[row.catalogue].push(row);
  }
  const values = (catalogue) => grouped[catalogue].map((row) => row.data);
  const mapValues = (catalogue, project) =>
    Object.fromEntries(grouped[catalogue].map((row) => [row.entry_key, project(row.data)]));
  return {
    daSnapshot: {
      records: values('da_price'),
      report: values('da_report')[0] || null,
    },
    retailSnapshot: { records: values('retail_price') },
    daCatalog: values('da_catalog'),
    metroSources: values('metro_source'),
    shopifySources: values('shopify_source'),
    retailSpecials: mapValues('retail_special', (data) => data),
    aliases: mapValues('price_alias', (data) => data.target),
    rawDaMappings: mapValues('raw_da_mapping', (data) => data.target),
    daNameMappings: mapValues('da_name_mapping', (data) => data.target),
    comparablePriceMappings: mapValues('comparable_price_mapping', (data) => data),
    partialRawFoods: new Set(grouped.partial_raw_food.map((row) => row.entry_key)),
    fnriPortions: mapValues('fnri_portion', (data) => data),
    fnriPortionMeta: values('fnri_portion_meta')[0] || null,
  };
}

async function loadPriceReferenceData(client) {
  const { data, error } = await client
    .from('price_reference_data')
    .select('catalogue,entry_key,data')
    .order('catalogue')
    .order('entry_key');
  if (error) throw new Error(`Could not load price reference data: ${error.message}`);
  return groupPriceReferenceRows(data);
}

export { groupPriceReferenceRows, loadPriceReferenceData };
