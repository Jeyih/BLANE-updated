import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDaPrices } from '../server/da-prices.js';
const data = await fetchDaPrices();
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/data/ingredient-prices.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(`Imported ${data.records.length} prices for ${data.report.label} (NCR reference).`);
