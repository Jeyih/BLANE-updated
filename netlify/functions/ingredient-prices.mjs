import { fetchDaPrices } from '../../server/da-prices.js';
import { createPriceFeed } from '../../server/price-feed.js';
import { fetchRetailPrices } from '../../server/retail-prices.js';
import {
  createReferenceDataClient,
  replacePriceReferenceData,
} from '../../server/reference-data.js';
import { loadPriceReferenceData } from '../../src/lib/price-reference.js';

function createHandler({ loadReferenceData, saveDa, saveRetail } = {}) {
  let feed;
  async function getFeed() {
    if (!feed) {
      let referenceData;
      if (loadReferenceData) {
        referenceData = await loadReferenceData();
      } else {
        const client = createReferenceDataClient();
        referenceData = await loadPriceReferenceData(client);
        saveDa = async (data) => {
          const entries = [
            ...data.records.map((record, index) => ({
              catalogue: 'da_price',
              entry_key: `${String(index + 1).padStart(3, '0')}:${record.name}`,
              data: record,
            })),
            { catalogue: 'da_report', entry_key: 'latest', data: data.report },
          ];
          await replacePriceReferenceData(client, ['da_price', 'da_report'], entries);
        };
        saveRetail = async (data) => {
          const entries = data.records.map((record, index) => ({
            catalogue: 'retail_price',
            entry_key: `${String(index + 1).padStart(3, '0')}:${record.name}`,
            data: record,
          }));
          await replacePriceReferenceData(client, ['retail_price'], entries);
        };
      }
      feed = createPriceFeed({
        daSnapshot: referenceData.daSnapshot,
        retailSnapshot: referenceData.retailSnapshot,
        loadDa: () => fetchDaPrices(referenceData),
        loadRetail: (previousRecords) => fetchRetailPrices(previousRecords, referenceData),
        saveDa,
        saveRetail,
      });
    }
    return feed;
  }
  return async function handler(event) {
    if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
    try {
      const getPrices = await getFeed();
      const data = await getPrices({ force: event.queryStringParameters?.refresh === '1' });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Netlify-CDN-Cache-Control': 'no-store',
        },
        body: JSON.stringify(data),
      };
    } catch (error) {
      console.error('Unable to load price references:', error);
      return {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ error: 'Price references are unavailable.' }),
      };
    }
  };
}

const handler = createHandler();
export { createHandler, handler };
