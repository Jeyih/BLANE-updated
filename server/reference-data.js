import { createClient } from '@supabase/supabase-js';
import { loadPriceReferenceData } from '../src/lib/price-reference.js';

function createReferenceDataClient({
  url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
} = {}) {
  if (!url || !key)
    throw new Error('Supabase URL and service role key are required for price reference data.');
  const client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function createReferenceDataLoader(options) {
  const client = createReferenceDataClient(options);
  return () => loadPriceReferenceData(client);
}

async function replacePriceReferenceData(client, catalogues, entries) {
  const { error } = await client.rpc('replace_price_reference_data', {
    p_catalogues: catalogues,
    p_entries: entries,
  });
  if (error) throw new Error(`Could not save price reference data: ${error.message}`);
}

export { createReferenceDataClient, createReferenceDataLoader, replacePriceReferenceData };
