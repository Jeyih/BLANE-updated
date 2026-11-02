// USDA SR Legacy April 2018 CSV; food_nutrient amounts per 100 g.
// Nutrient IDs: protein 1003 (g), P 1091, K 1092, Na 1093 (mg),
// phenylalanine 1217 (g), converted here to mg. Not FNRI measurements.
export const NUTRIENT_REFERENCE_SOURCE = {
  url: 'https://fdc.nal.usda.gov/download-datasets/',
  archive: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  release: 'USDA SR Legacy, April 2018',
  checked: '2026-11-02',
};

export const SPECIAL_DIET_NUTRIENTS = {
  '0178': { name: 'Potato', fdcId: '170026', description: 'Potatoes, flesh and skin, raw',
    caveat: 'Includes skin; BLANE preparation calls for peeling. Reference proxy, not an exact prepared-food match.',
    protein: 2.05, phenylalanine: 81, potassium: 425, phosphorus: 57, sodium: 6 },
  '0312': { name: 'Carrot', fdcId: '170393', description: 'Carrots, raw',
    caveat: 'US generic raw carrot reference; local variety and cooking retention are unverified.',
    protein: 0.93, phenylalanine: 61, potassium: 320, phosphorus: 35, sodium: 69 },
  '0308': { name: 'Cabbage, green', fdcId: '169975', description: 'Cabbage, raw',
    caveat: 'US generic raw cabbage reference; local variety and cooking retention are unverified.',
    protein: 1.28, phenylalanine: 32, potassium: 170, phosphorus: 26, sodium: 18 },
  '0491': { name: 'Squash fruit', fdcId: '170489', description: 'Squash, winter, all varieties, raw',
    caveat: 'Winter squash is a proxy; the Philippine squash variety has not been matched.',
    protein: 0.95, phenylalanine: 57, potassium: 350, phosphorus: 23, sodium: 4 },
  '1226': { name: 'Oil, coconut', fdcId: '171412', description: 'Oil, coconut',
    caveat: 'Generic oil composition does not establish the brand ingredient list or cross-contact controls.',
    protein: 0, phenylalanine: 0, potassium: 0, phosphorus: 0, sodium: 0 },
};
