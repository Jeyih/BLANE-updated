import { fetchDaPrices } from '../server/da-prices.js';
import {
  createPriceReferenceClient,
  loadReferenceData,
  savePriceSnapshot,
} from './price-reference-db.mjs';

const client = await createPriceReferenceClient();
const references = await loadReferenceData(client);
const data = await fetchDaPrices(references);
await savePriceSnapshot(client, 'da_price', data.records, data.report);
console.log(`Saved ${data.records.length} DA prices for ${data.report.label} to Supabase.`);
