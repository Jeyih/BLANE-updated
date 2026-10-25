import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { loadPriceReferenceData } from '../src/lib/price-reference.js';

async function readLocalEnv() {
  try {
    const text = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=');
          return [
            line.slice(0, separator).trim(),
            line
              .slice(separator + 1)
              .trim()
              .replace(/^["']|["']$/g, ''),
          ];
        }),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function createPriceReferenceClient() {
  const localEnv = await readLocalEnv();
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    localEnv.SUPABASE_URL ||
    localEnv.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before updating price data.');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function savePriceSnapshot(client, catalogue, records, report) {
  const catalogues = catalogue === 'da_price' ? ['da_price', 'da_report'] : ['retail_price'];
  const entries = records.map((record, index) => ({
    catalogue,
    entry_key: `${String(index + 1).padStart(3, '0')}:${record.name}`,
    data: record,
  }));
  if (report) entries.push({ catalogue: 'da_report', entry_key: 'latest', data: report });
  const { error } = await client.rpc('replace_price_reference_data', {
    p_catalogues: catalogues,
    p_entries: entries,
  });
  if (error) throw new Error(`Could not save ${catalogue} data: ${error.message}`);
}

async function loadReferenceData(client) {
  return loadPriceReferenceData(client);
}

export { createPriceReferenceClient, loadReferenceData, savePriceSnapshot };
