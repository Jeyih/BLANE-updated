import snapshot from '../../public/data/ingredient-prices.json' with { type: 'json' };
import retailSnapshot from '../../public/data/retail-prices.json' with { type: 'json' };
import { fetchDaPrices } from '../../server/da-prices.js';
import { fetchRetailPrices } from '../../server/retail-prices.js';
import { createPriceFeed } from '../../server/price-feed.js';
const getPrices = createPriceFeed({
  daSnapshot: snapshot,
  retailSnapshot,
  loadDa: fetchDaPrices,
  loadRetail: fetchRetailPrices,
});
async function handler(event) {
  if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' };
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
}
export { handler };
