import {
  createPriceReferenceClient,
  loadReferenceData,
  savePriceSnapshot,
} from './price-reference-db.mjs';
import { fetchRetailPrices } from '../server/retail-prices.js';

const client = await createPriceReferenceClient();
const references = await loadReferenceData(client);
const data = await fetchRetailPrices(references.retailSnapshot.records, references);
await savePriceSnapshot(client, 'retail_price', data.records);
console.log(
  JSON.stringify({ records: data.records.length, warning: data.warning, failures: data.failures }),
);
