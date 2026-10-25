import { ingredientKey, parsePriceQuantity } from '../src/lib/pricing.js';
function parseDuckBreastPrice(html, config) {
  const products = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'Product') products.push(value);
    Object.values(value).forEach((child) => {
      if (Array.isArray(child)) child.forEach(walk);
      else walk(child);
    });
  }
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(json));
    } catch {}
  }
  const product = products.find((p) => p.name === config.productName);
  const offer = product?.offers;
  const spec = offer?.priceSpecification;
  if (
    offer?.priceCurrency !== config.currency ||
    spec?.priceCurrency !== config.currency ||
    spec.referenceQuantity?.unitCode !== config.unitCode ||
    Number(spec.referenceQuantity?.value) !== Number(config.unitValue) ||
    offer.seller?.name !== config.sellerName ||
    Number(offer.price) !== Number(spec.price) ||
    !Number.isFinite(Number(spec.price)) ||
    Number(spec.price) <= 0
  ) {
    throw new Error('Reviewed duck-breast product, seller or PHP/kg quote changed.');
  }
  return {
    name: config.name,
    key: ingredientKey(config.name),
    description: product.name,
    price: Number(spec.price),
    unit: 'kg',
    kind: 'reference',
    sourceType: 'retailer',
    verified: true,
    currency: config.currency,
    sourceCountry: config.sourceCountry,
    region: config.region,
    source: config.source,
    sourceUrl: config.url,
    observedAt: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10),
    estimateType: 'product',
    availability:
      offer.availability === 'https://schema.org/InStock'
        ? 'Listed in stock'
        : 'Stock status not confirmed',
  };
}
function parseWholeDuckPrice(html, config) {
  const section = html.match(
    new RegExp(config.priceSectionPattern),
  )?.[0];
  const price = section?.match(new RegExp(config.pricePattern));
  if (!new RegExp(config.productPattern).test(html) || !price)
    throw new Error('Reviewed whole-duck identity or PHP/kg price changed.');
  const amount = Number(price[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid whole-duck price.');
  return {
    name: config.name,
    key: ingredientKey(config.name),
    price: amount,
    unit: 'kg',
    description: config.description,
    kind: 'reference',
    sourceType: 'retailer',
    verified: true,
    currency: config.currency,
    sourceCountry: config.sourceCountry,
    source: config.source,
    sourceUrl: config.url,
    region: config.region,
    observedAt: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10),
    estimateType: 'product reference',
    notes: config.note,
  };
}
function parseRetailPrice(html, config) {
  const products = [];
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value['@type'] === 'Product' || value['@type']?.includes?.('Product')) products.push(value);
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) child.forEach(walk);
      else if (child && typeof child === 'object') walk(child);
    }
  }
  for (const [, json] of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse(json));
    } catch {}
  }
  const product = products.find((p) => new RegExp(config.productPattern, 'i').test(p.name?.trim()));
  const offers = product
    ? (Array.isArray(product.offers) ? product.offers : [product.offers]).flatMap((offer2) => {
        if (!offer2) return [];
        const specs = Array.isArray(offer2.priceSpecification)
          ? offer2.priceSpecification
          : offer2.priceSpecification
            ? [offer2.priceSpecification]
            : [];
        return [offer2, ...specs.filter((p) => p['@type'] === 'UnitPriceSpecification')];
      })
    : [];
  const offer = offers.find(
    (o) =>
      o?.priceCurrency === config.currency &&
      Number.isFinite(Number(o.price)) &&
      Number(o.price) > 0,
  );
  if (!offer)
    throw new Error('Reviewed retail product, pack size, or price could not be verified.');
  const basis = parsePriceQuantity(config.basis);
  if (!basis || basis.unit !== 'kg')
    throw new Error('Reviewed retailer pack basis is invalid.');
  return {
    name: config.name,
    key: ingredientKey(config.name),
    description: config.description,
    price: Number(offer.price) / basis.amount,
    unit: 'kg',
    packPrice: Number(offer.price),
    packQuantity: config.basis,
    kind: 'reference',
    sourceType: 'retailer',
    region: config.region,
    currency: config.currency,
    sourceCountry: config.sourceCountry,
    source: config.source,
    sourceUrl: config.url,
    observedAt: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10),
  };
}
function decodeProductName(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rsquo;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}
function productRecords(config, product, packPrice, source, url, description = '') {
  if (ingredientKey(decodeProductName(product)) !== ingredientKey(config.title))
    throw new Error('Retail product identity changed.');
  const basis = parsePriceQuantity(config.basis);
  if (config.requireNetWeight) {
    const text = decodeProductName(description.replace(/<[^>]*>/g, ' '));
    const labelled = text.match(/Net Weight:\s*(\d+(?:\.\d+)?\s*(?:kg|g|ml|l))\b/i)?.[1];
    const stated = parsePriceQuantity(labelled);
    if (!stated || stated.unit !== basis?.unit || stated.amount !== basis?.amount)
      throw new Error('Labelled product weight changed.');
  }
  if (!basis || !Number.isFinite(packPrice) || packPrice <= 0)
    throw new Error('Invalid retailer price or pack basis.');
  return config.names.map((name) => ({
    name,
    key: ingredientKey(name),
    description: decodeProductName(product),
    price: packPrice / basis.amount,
    unit: basis.unit,
    packPrice,
    packQuantity: config.basis,
    kind: 'reference',
    sourceType: 'retailer',
    verified: true,
    currency: config.currency,
    sourceCountry: config.sourceCountry,
    region: config.region,
    source: config.source || source,
    sourceUrl: url,
    observedAt: new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10),
    estimateType: config.raw ? 'raw' : config.note ? 'product reference' : 'product',
    partial: Boolean(config.partial),
    notes: [
      config.raw
        ? 'Same-weight raw ingredient estimate; cooking yield, labour and fuel are not included.'
        : '',
      config.note || '',
    ]
      .filter(Boolean)
      .join(' '),
  }));
}
async function fetchRetailPrices(previousRecords = [], referenceData) {
  const metroSources = referenceData?.metroSources;
  const shopifySources = referenceData?.shopifySources;
  const specials = referenceData?.retailSpecials;
  if (!Array.isArray(metroSources) || !Array.isArray(shopifySources) || !specials)
    throw new Error('Retailer product catalogue is unavailable.');
  for (const key of ['tocino', 'whole_duck', 'duck_breast']) {
    if (!specials[key]) throw new Error(`Retailer source configuration is missing: ${key}.`);
  }
  const records = [];
  const warnings = [];
  async function get(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12e3) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }
  function fallback(config, error) {
    for (const name of config.names) {
      const previous = previousRecords.find(
        (p) => p.key === ingredientKey(name) && p.sourceType === 'retailer' && p.sourceUrl,
      );
      if (previous) records.push({ ...previous, refreshStatus: 'cached' });
    }
    warnings.push(`${config.names[0]}: source refresh unavailable (${error.message}).`);
  }
  const metroUrl = new URL('https://shopmetro.ph/wp-json/wc/store/v1/products');
  metroUrl.searchParams.set('include', metroSources.map((c) => c.id).join(','));
  metroUrl.searchParams.set('per_page', '100');
  try {
    const products = await (await get(metroUrl.href)).json();
    for (const config of metroSources) {
      try {
        const product = products.find((p) => p.id === config.id);
        if (!product || product.prices?.currency_code !== 'PHP' || product.prices.price_range)
          throw new Error('Product or PHP price is unavailable.');
        const price =
          Number(product.prices.price) / 10 ** Number(product.prices.currency_minor_unit);
        records.push(
          ...productRecords(
            config,
            product.name,
            price,
            config.source,
            product.permalink,
            product.description,
          ).map((p) => ({
            ...p,
            availability: product.is_in_stock ? 'Listed in stock' : 'Listed out of stock',
          })),
        );
      } catch (error) {
        fallback(config, error);
      }
    }
  } catch (error) {
    for (const config of metroSources) fallback(config, error);
  }
  let index = 0;
  async function worker() {
    while (index < shopifySources.length) {
      const config = shopifySources[index++];
      try {
        const url = `https://${config.host}/products/${config.handle}`;
        const data = await (await get(`${url}.js`)).json();
        const variant = config.variantTitle
          ? data.variants?.find((v) => v.title === config.variantTitle)
          : data.variants?.length === 1
            ? data.variants[0]
            : null;
        if (!variant) throw new Error('Reviewed product variant is unavailable.');
        const packPrice = Number(variant.price) / 100;
        records.push(
          ...productRecords(config, data.title, packPrice, config.source, url).map((p) => ({
            ...p,
            variant: config.variantTitle || null,
            availability: variant.available ? 'Listed in stock' : 'Listed out of stock',
          })),
        );
      } catch (error) {
        fallback(config, error);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  try {
    const config = specials.whole_duck;
    records.push(parseWholeDuckPrice(await (await get(config.url)).text(), config));
  } catch (error) {
    fallback(specials.whole_duck, error);
  }
  try {
    const config = specials.duck_breast;
    records.push(parseDuckBreastPrice(await (await get(config.url)).text(), config));
  } catch (error) {
    fallback(specials.duck_breast, error);
  }
  try {
    records.push({
      ...parseRetailPrice(
        await (await get(specials.tocino.url)).text(),
        specials.tocino,
      ),
      verified: true,
      estimateType: 'product',
    });
  } catch (error) {
    fallback(specials.tocino, error);
  }
  if (!records.length) throw new Error('No verified retailer prices could be loaded.');
  return {
    records,
    fetchedAt: new Date().toISOString(),
    warning: warnings.length
      ? `${warnings.length} retailer listings could not be refreshed. Original observation dates are retained for cached quotes.`
      : '',
    failures: warnings,
  };
}
export {
  decodeProductName,
  fetchRetailPrices,
  parseDuckBreastPrice,
  parseRetailPrice,
  parseWholeDuckPrice,
  productRecords,
};
