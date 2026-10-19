import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchRetailPrices, TOCINO_URL } from '../server/retail-prices.js';
if (process.argv.includes('--inspect')) {
  const html = await (await fetch(TOCINO_URL)).text();
  await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
  await writeFile(new URL('../tmp/retail-price-source.html', import.meta.url), html);
  console.log('Saved retailer HTML for parser verification.');
  process.exit(0);
}
let previous = [];
try {
  previous = JSON.parse(
    await readFile(new URL('../public/data/retail-prices.json', import.meta.url), 'utf8'),
  ).records;
} catch {}
const data = await fetchRetailPrices(previous);
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../public/data/retail-prices.json', import.meta.url),
  JSON.stringify(data, null, 2) + '\n',
);
console.log(
  JSON.stringify({ records: data.records.length, warning: data.warning, failures: data.failures }),
);
