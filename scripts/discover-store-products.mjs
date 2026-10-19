import { mkdir, readFile, writeFile } from 'node:fs/promises';
const terms = [
  'rice',
  'sitaw',
  'carrot',
  'squash',
  'chicken breast',
  'gizzard',
  'coconut milk',
  'corned beef',
  'garlic',
  'onion',
  'cabbage',
  'banana',
  'noodles',
  'crab',
  'milk',
  'cassava',
  'vinegar',
  'tomato',
  'tamarind',
  'tilapia',
  'coffee',
  'peanut butter',
  'ginger',
  'fish sauce',
  'duck',
  'puto',
  'egg',
  'soy sauce',
  'kangkong',
  'pandesal',
  'coconut oil',
  'tomato sauce',
  'shrimp',
  'oats',
  'potato',
  'polvoron',
  'squid',
  'okra',
  'tablea',
  'alamang',
  'chickpea',
  'mango',
  'munggo',
  'sardines',
  'eggplant',
  'patola',
  'mussel',
  'corn oil',
  'quail',
  'laing',
  'bacon',
  'bagoong',
  'hotdog',
  'corn',
  'clam',
  'peanut',
  'bread',
  'popcorn',
  'sweet potato',
  'lima',
  'tocino',
];
const products = new Map();
const searches = process.argv.length > 2 ? process.argv.slice(2) : terms;
try {
  const previous = JSON.parse(
    await readFile(new URL('../tmp/store-product-discovery.json', import.meta.url), 'utf8'),
  );
  for (const product of previous.products) products.set(product.id, product);
} catch {}
const errors = [];
let index = 0;
async function worker() {
  while (index < searches.length) {
    const term = searches[index++];
    try {
      const url = new URL('https://shopmetro.ph/wp-json/wc/store/v1/products');
      url.searchParams.set('search', term);
      url.searchParams.set('per_page', '30');
      const response = await fetch(url, { signal: AbortSignal.timeout(15e3) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid store response');
      for (const p of rows)
        products.set(p.id, {
          id: p.id,
          name: p.name,
          permalink: p.permalink,
          prices: p.prices,
          is_in_stock: p.is_in_stock,
          description: p.description,
          short_description: p.short_description,
          type: p.type,
          attributes: p.attributes,
        });
    } catch (error) {
      errors.push({ term, error: error.message });
    }
  }
}
await Promise.all([worker(), worker(), worker()]);
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../tmp/store-product-discovery.json', import.meta.url),
  JSON.stringify({ products: [...products.values()], errors }, null, 2),
);
console.log(JSON.stringify({ products: products.size, errors: errors.slice(0, 3) }));
