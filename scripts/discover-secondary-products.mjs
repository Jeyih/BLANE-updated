import { mkdir, writeFile } from 'node:fs/promises';
const products = [];
const host = process.argv[2] === 'jelexie' ? 'jelexie.ph' : 'pindotlang.com';
for (let page = 1; page <= 4; page++) {
  const url = `https://${host}/products.json?limit=250&page=${page}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Farm2Metro catalogue returned ${response.status}`);
  const data = await response.json();
  products.push(...data.products);
  if (data.products.length < 250) break;
}
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(new URL(host === 'jelexie.ph' ? '../tmp/jelexie-products.json' : '../tmp/secondary-products.json', import.meta.url), JSON.stringify(products, null, 2));
console.log(JSON.stringify({ products: products.length, matches: products.filter((p) => /pandesal|spanish|duck|quail|cassava|banana heart|bibingka|suman|puto|turon|lima|patani|pork leg|tablea|tableya|peanut|tamarind/i.test(p.title))
  .map((p) => ({ title: p.title, handle: p.handle, variants: p.variants.map((v) => ({ title: v.title, price: v.price, grams: v.grams, available: v.available })) })) }, null, 2));
