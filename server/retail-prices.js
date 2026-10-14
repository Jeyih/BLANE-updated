import { ingredientKey, parsePriceQuantity } from '../src/lib/pricing.js';
import { METRO_SOURCES, SHOPIFY_SOURCES } from './retail-source-config.js';

export const TOCINO_URL = 'https://montereycommunityonlinemarket.com.ph/product/beef-tocino-500g/';
export const DUCK_URL = 'https://shop.gerald.ph/whole-duck';
export const DUCK_BREAST_URL = 'https://www.thesausageguy.shop/panglao/poultry';

export function parseDuckBreastPrice(html) {
  const products = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'Product') products.push(value);
    Object.values(value).forEach((child) => { if (Array.isArray(child)) child.forEach(walk); else walk(child); });
  }
  for (const [, json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(json)); } catch { /* Reject if no valid matching product remains. */ }
  }
  const product = products.find((p) => p.name === 'Duck Breast (Dalee)');
  const offer = product?.offers;
  const spec = offer?.priceSpecification;
  if (offer?.priceCurrency !== 'PHP' || spec?.priceCurrency !== 'PHP'
    || spec.referenceQuantity?.unitCode !== 'KGM' || Number(spec.referenceQuantity?.value) !== 1
    || offer.seller?.name !== 'The Sausage Guy Panglao' || Number(offer.price) !== Number(spec.price)
    || !Number.isFinite(Number(spec.price)) || Number(spec.price) <= 0) {
    throw new Error('Duck-breast product, seller or PHP/kg quote changed.');
  }
  return { name: 'Duck breast', key: ingredientKey('Duck breast'), description: product.name,
    price: Number(spec.price), unit: 'kg', kind: 'reference', sourceType: 'retailer', verified: true,
    currency: 'PHP', sourceCountry: 'PH', region: 'Panglao, Bohol / Philippine retailer',
    source: 'The Sausage Guy Panglao official shop', sourceUrl: DUCK_BREAST_URL,
    observedAt: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10), estimateType: 'product',
    availability: offer.availability === 'https://schema.org/InStock' ? 'Listed in stock' : 'Stock status not confirmed' };
}

export function parseWholeDuckPrice(html) {
  const section = html.match(/<div class=product-price>[\s\S]*?<meta itemprop=priceCurrency content=PHP>/)?.[0];
  const price = section?.match(/class=priceUnit[^>]*>[\s\S]*?₱\s*([\d,]+(?:\.\d+)?)\s*\/kg/);
  if (!/Whole Duck Headless/.test(html) || !price) throw new Error('Whole duck identity or PHP/kg price changed.');
  const amount = Number(price[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid whole-duck price.');
  return { name: 'Whole duck', key: ingredientKey('Whole duck'), price: amount, unit: 'kg',
    description: 'Whole Duck Headless — whole-bird retailer reference', kind: 'reference', sourceType: 'retailer', verified: true, currency: 'PHP', sourceCountry: 'PH',
    source: 'GERALD.ph official online store', sourceUrl: DUCK_URL, region: 'Philippines / online store',
    observedAt: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    estimateType: 'product reference', notes: 'Whole bird includes bones and skin; edible breast yield is not measured.' };
}

export function parseRetailPrice(html) {
  const products = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'Product' || value['@type']?.includes?.('Product')) products.push(value);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object') walk(child);
    }
  }
  for (const [, json] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(json)); } catch { /* Ignore unrelated malformed schema. */ }
  }
  const product = products.find((p) => /^beef tocino 500\s*g$/i.test(p.name?.trim()));
  const offers = product ? (Array.isArray(product.offers) ? product.offers : [product.offers]).flatMap((offer) => {
    if (!offer) return [];
    const specs = Array.isArray(offer.priceSpecification) ? offer.priceSpecification : offer.priceSpecification ? [offer.priceSpecification] : [];
    return [offer, ...specs.filter((p) => p['@type'] === 'UnitPriceSpecification')];
  }) : [];
  const offer = offers.find((o) => o?.priceCurrency === 'PHP' && Number.isFinite(Number(o.price)) && Number(o.price) > 0);
  if (!offer) throw new Error('Retail product, pack size, or PHP price could not be verified.');
  return { name: 'Beef, sweet cured', key: ingredientKey('Beef, sweet cured'),
    description: 'Beef Tocino 500g — retailer product reference', price: Number(offer.price) / .5, unit: 'kg',
    packPrice: Number(offer.price), packQuantity: '500 g', kind: 'reference', sourceType: 'retailer', region: 'NCR', currency: 'PHP', sourceCountry: 'PH',
    source: 'Monterey Community Market, Quezon City', sourceUrl: TOCINO_URL,
    observedAt: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10) };
}

export function decodeProductName(value) {
  return String(value || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"');
}

export function productRecords(config, product, packPrice, source, url, description = '') {
  if (ingredientKey(decodeProductName(product)) !== ingredientKey(config.title)) throw new Error('Retail product identity changed.');
  const basis = parsePriceQuantity(config.basis);
  if (config.requireNetWeight) {
    const text = decodeProductName(description.replace(/<[^>]*>/g, ' '));
    const labelled = text.match(/Net Weight:\s*(\d+(?:\.\d+)?\s*(?:kg|g|ml|l))\b/i)?.[1];
    const stated = parsePriceQuantity(labelled);
    if (!stated || stated.unit !== basis?.unit || stated.amount !== basis?.amount) throw new Error('Labelled product weight changed.');
  }
  if (!basis || !Number.isFinite(packPrice) || packPrice <= 0) throw new Error('Invalid retailer price or pack basis.');
  return config.names.map((name) => ({ name, key: ingredientKey(name), description: decodeProductName(product),
    price: packPrice / basis.amount, unit: basis.unit, packPrice, packQuantity: config.basis,
    kind: 'reference', sourceType: 'retailer', verified: true, currency: 'PHP', sourceCountry: 'PH', region: config.host === 'jelexie.ph' ? 'Tarlac brand / online store' : 'Philippines / online store',
    source, sourceUrl: url, observedAt: new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
    estimateType: config.raw ? 'raw' : config.note ? 'product reference' : 'product',
    partial: Boolean(config.partial), notes: [config.raw ? 'Same-weight raw ingredient estimate; cooking yield, labour and fuel are not included.' : '', config.note || ''].filter(Boolean).join(' ') }));
}

export async function fetchRetailPrices(previousRecords = []) {
  const records = [];
  const warnings = [];
  async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }
  function fallback(config, error) {
    for (const name of config.names) {
      const previous = previousRecords.find((p) => p.key === ingredientKey(name) && p.sourceType === 'retailer' && p.sourceUrl);
      if (previous) records.push({ ...previous, refreshStatus: 'cached' });
    }
    warnings.push(`${config.names[0]}: source refresh unavailable (${error.message}).`);
  }
  // A single public API request updates all reviewed Metro product IDs.
  const metroUrl = new URL('https://shopmetro.ph/wp-json/wc/store/v1/products');
  metroUrl.searchParams.set('include', METRO_SOURCES.map((c) => c.id).join(','));
  metroUrl.searchParams.set('per_page', '100');
  try {
    const products = await (await get(metroUrl.href)).json();
    for (const config of METRO_SOURCES) {
      try {
        const product = products.find((p) => p.id === config.id);
        if (!product || product.prices?.currency_code !== 'PHP' || product.prices.price_range) throw new Error('Product or PHP price is unavailable.');
        const price = Number(product.prices.price) / 10 ** Number(product.prices.currency_minor_unit);
        records.push(...productRecords(config, product.name, price, 'Metro official online store', product.permalink, product.description).map((p) => ({ ...p, availability: product.is_in_stock ? 'Listed in stock' : 'Listed out of stock' })));
      } catch (error) { fallback(config, error); }
    }
  } catch (error) { for (const config of METRO_SOURCES) fallback(config, error); }
  let index = 0;
  async function worker() {
    while (index < SHOPIFY_SOURCES.length) {
      const config = SHOPIFY_SOURCES[index++];
      try {
        const url = `https://${config.host}/products/${config.handle}`;
        const data = await (await get(`${url}.js`)).json();
        const variant = config.variantTitle ? data.variants?.find((v) => v.title === config.variantTitle)
          : data.variants?.length === 1 ? data.variants[0] : null;
        if (!variant) throw new Error('Reviewed product variant is unavailable.');
        const packPrice = Number(variant.price) / 100;
        records.push(...productRecords(config, data.title, packPrice, config.source, url).map((p) => ({ ...p,
          variant: config.variantTitle || null, availability: variant.available ? 'Listed in stock' : 'Listed out of stock' })));
      } catch (error) { fallback(config, error); }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  try { records.push(parseWholeDuckPrice(await (await get(DUCK_URL)).text())); }
  catch (error) { fallback({ names: ['Whole duck'] }, error); }
  try { records.push(parseDuckBreastPrice(await (await get(DUCK_BREAST_URL)).text())); }
  catch (error) { fallback({ names: ['Duck breast'] }, error); }
  try { records.push({ ...parseRetailPrice(await (await get(TOCINO_URL)).text()), verified: true, estimateType: 'product' }); }
  catch (error) { fallback({ names: ['Beef, sweet cured'] }, error); }
  if (!records.length) throw new Error('No verified retailer prices could be loaded.');
  return { records, fetchedAt: new Date().toISOString(), warning: warnings.length ? `${warnings.length} retailer listings could not be refreshed. Original observation dates are retained for cached quotes.` : '', failures: warnings };
}
