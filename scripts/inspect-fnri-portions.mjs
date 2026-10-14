import { mkdir, writeFile } from 'node:fs/promises';
const rows = [];
for (let page = 1; page <= 7; page++) {
  const url = `https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=${page}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`FNRI returned ${response.status}`);
  const html = await response.text();
  for (const block of html.split(/id="foodNutriInformation/).slice(1)) {
    const title = block.match(/class="fsize-2 mb-0 mazzard-semibold"[^>]*>([\s\S]*?)<\/p>/)?.[1]?.replace(/<[^>]*>/g, '').trim();
    const field = (key) => block.match(new RegExp(`name="${key}"[^>]*value="([^"]*)"`))?.[1];
    rows.push({ title, ap: field('weight_ap'), ep: field('weight_ep'), measure: field('household_measure'), sourceUrl: url });
  }
}
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
await writeFile(new URL('../tmp/fnri-portions-source.json', import.meta.url), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
