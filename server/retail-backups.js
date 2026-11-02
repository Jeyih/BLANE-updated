// Reviewed public alternative. No fixed prices: every use verifies the live
// product identity, PHP price and labelled pack weight before normalization.
const OKRA_BACKUP = {
  id: 9649, title: 'Q Okra', basis: '1 kg', names: ['Okra, boiled'],
  url: 'https://shopmetro.ph/product/okra-1kg/',
  source: 'Metro official online store', region: 'Philippines / online store',
  currency: 'PHP', sourceCountry: 'PH', requireNetWeight: true, raw: true,
};
export function reviewedMetroBackup(config) {
  if (config.host !== 'pindotlang.com') return null;
  if (config.names?.length === 1 && config.names[0] === 'Okra, boiled') return OKRA_BACKUP;
  const match = METRO_BACKUPS.find(b => JSON.stringify(b.names) === JSON.stringify(config.names));
  return match ? { ...OKRA_BACKUP, ...match } : null;
}
const METRO_BACKUPS = [
  { id: 9839, title: 'Smi Sugpo Large – Kilo', basis: '1 kg', names: ['Shrimp, giant tiger prawn'], url: 'https://shopmetro.ph/product/sugpo-large-1kg/', note: 'Whole fresh tiger prawns; edible portion and cooking yield must be recorded separately.' },
  { id: 7678, title: 'Harvesters Malagkit Rice 1kg', basis: '1 kg', names: ['Glutinous rice w/ mung bean & cocomilk'], url: 'https://shopmetro.ph/product/harvesters-malagkit-rice-1kg/', partial: true, note: 'Glutinous rice base only; excludes mung beans, coconut milk and cooking yield.' },
  { id: 10052, title: 'Frt Mango Ripe – Kilo', basis: '1 kg', names: ['Mango, Manila super, ripe'], url: 'https://shopmetro.ph/product/mango-ripe-1kg/', note: 'Comparable ripe mango; Manila super variety is not confirmed. Whole-fruit purchase weight requires edible-portion evidence.' },
];
const SHOPIFY_BACKUPS = [
  { host: 'www.albertosfreshmarket.com', handle: 'fresh-root-crops-cassava-kamoting-kahoy-1kg', title: 'FRESH ROOT CROPS (CASSAVA) KAMOTING KAHOY 1kg', basis: '1 kg', names: ['Cassava fritter', 'Cassava, suman'], partial: true, note: 'Cassava base only; excludes sugar, oil, coconut ingredients and cooking yield.' },
  { host: 'bagsakanbyedds.com', handle: 'peanut-local-with-shell-1kg', title: 'Peanut Local (With Shell) 1kg', basis: '1 kg', names: ['Peanut w/ shell, boiled'] },
  { host: 'deligoodph.com', handle: 'tamarind-sampalok-500g', title: 'Tamarind (Sampalok) 500g', basis: '500 g', names: ['Tamarind, unripe, boiled'], note: 'Ripeness is unspecified; raw-to-boiled quantity must be measured.' },
  { host: 'www.albertosfreshmarket.com', handle: 'fresh-seafoods-squid-pusit-500-grams', title: 'FRESH SEAFOODS SQUID ( PUSIT ) 500 grams', basis: '500 g', names: ['Squid, boiled'] },
  { host: 'www.albertosfreshmarket.com', handle: 'fresh-vegetables-banana-heart-chop-puso-ng-saging-gayat-500-grams', title: 'FRESH VEGETABLES BANANA HEART CHOP ( PUSO NG SAGING GAYAT) 500 grams', basis: '500 g', names: ['Banana heart, butuan, boiled'], note: 'Banana variety is unspecified; raw-to-boiled quantity must be measured.' },
];
export function reviewedShopifyBackup(config) {
  if (config.host !== 'pindotlang.com') return null;
  const match = SHOPIFY_BACKUPS.find(b => JSON.stringify(b.names) === JSON.stringify(config.names));
  return match ? { currency: 'PHP', sourceCountry: 'PH', region: 'Philippines / online store', source: match.host, raw: true, ...match } : null;
}

// These are whole tubs, never kg or individual slices. No weight is inferred
// from tray dimensions or shipping metadata.
const CAKE_BACKUPS = [
  { title: 'Bibingka Malagkit', names: ['Rice cake, bibingka'], variationId: 442, url: 'https://beasbibingka.com/product/bibingka-malagkit/' },
  { title: 'Cassava Cake', names: ['Cassava cake, bibingka'], variationId: 476, url: 'https://beasbibingka.com/product/cassava/' },
];
export function reviewedCakeBackup(config) {
  if (config.host !== 'pindotlang.com') return null;
  const match = CAKE_BACKUPS.find(b => JSON.stringify(b.names) === JSON.stringify(config.names));
  return match ? { ...match, source: "Bea's Bibingka official store", region: 'Philippines / online store',
    currency: 'PHP', sourceCountry: 'PH', basis: '1 pc', variantTitle: 'Solo (tub)',
    note: 'Price is for one whole Solo tub, not one slice or kilogram. Net weight and slice count are not declared. A measured tub fraction and matching product are required for the recipe’s 150 g portion.' } : null;
}
