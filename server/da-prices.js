import pdf from 'pdf-parse/lib/pdf-parse.js';
import { ingredientKey } from '../src/lib/pricing.js';

export const DA_INDEX = 'https://www.da.gov.ph/price-monitoring/';
const CATALOG = [
  ['White rice', /^Well Milled\b/, 'LOCAL COMMERCIAL RICE'], ['Mungbean', /^Mungbean\b/],
  ['Bangus', /^Bangus, Medium\b/], ['Tilapia', /^Tilapia\b/], ['Galunggong', /^Galunggong, Local\b/],
  ['Whole chicken', /^Whole Chicken, Local\b/], ['Pork belly', /^Pork Belly.*Local\b/],
  ['Pork shoulder', /^Pork Picnic Shoulder.*Local\b/], ['Egg', /^Chicken Egg \(White, Medium\)/],
  ['Ampalaya', /^Ampalaya\b/], ['Eggplant', /^Eggplant\b/], ['Pechay', /^Native Pechay\b/],
  ['Sitaw', /^Pole Sitao\b/], ['Squash', /^Squash\b/], ['Tomato', /^Tomato\b/],
  ['Carrot', /^Carrots, Local\b/], ['Chayote', /^Chayote\b/], ['Potato', /^White Potato, Local\b/],
  ['Ginger', /^Ginger, Local\b/], ['Red onion', /^Red Onion, Local\b/], ['White onion', /^White Onion, Local\b/],
  ['Local garlic', /^Garlic, Native\/Local\b/], ['Imported garlic', /^Garlic, Imported\b/],
  ['Banana saba', /^Banana \(Saba\)/], ['Calamansi', /^Calamansi\b/], ['Papaya', /^Papaya\b/],
  ['Rock salt', /^Salt \(Rock\)/], ['Iodized salt', /^Salt \(Iodized\)/],
  ['Brown sugar', /^Sugar \(Brown\)/], ['Refined sugar', /^Sugar \(Refined\)/],
  ['Palm oil', /^Cooking Oil \(Palm\).*1 Liter\/bottle/], ['Coconut oil', /^Cooking Oil \(Coconut\).*1 Liter\/bottle/],
  ['Broccoli', /^Broccoli, Local\b/], ['Cauliflower', /^Cauliflower, Local\b/],
  ['Celery', /^Celery\b/], ['Baguio beans', /^Habichuelas\/Baguio Beans, Local\b/],
];
export function reportLinks(html, now = Date.now()) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(([, href, raw]) => {
    let url;
    try { url = new URL(href.replace(/&amp;/g, '&'), DA_INDEX); } catch { return []; }
    if (url.hostname !== 'www.da.gov.ph' || !/Weekly-Average-Prices.*\.pdf$/i.test(url.pathname)) return [];
    const label = raw.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#8211;|&ndash;/g, ' ').trim();
    const end = label.match(/(?:([A-Za-z]+)\s+)?(\d{1,2}),?\s+(\d{4})$/);
    const month = end?.[1] || label.match(/^([A-Za-z]+)/)?.[1];
    const date = end && month ? new Date(`${month} ${end[2]}, ${end[3]} 00:00:00 GMT+0800`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.getTime() > now) return [];
    return [{ url: url.href, label, observedAt: new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10), timestamp: date.getTime() }];
  }).sort((a, b) => b.timestamp - a.timestamp);
}
export function parseDaRows(lines, report) {
  const records = [];
  let section = '';
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.includes('IMPORTED COMMERCIAL RICE')) section = 'IMPORTED COMMERCIAL RICE';
    if (line.includes('LOCAL COMMERCIAL RICE')) section = 'LOCAL COMMERCIAL RICE';
    const item = CATALOG.find(([, pattern, required]) => pattern.test(line) && (!required || section === required));
    if (!item || records.some((r) => r.key === ingredientKey(item[0]))) continue;
    const values = line.match(/\b(kg|pc|L)\s+([\d,]+\.\d{2})\s*$/);
    if (!values) continue;
    const price = Number(values[2].replace(/,/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;
    records.push({ name: item[0], key: ingredientKey(item[0]), price, unit: values[1].toLowerCase(),
      description: line.replace(/\s+(kg|pc|L)\s+[\d,.]+$/, ''), region: 'NCR', kind: 'reference', currency: 'PHP', sourceCountry: 'PH',
      observedAt: report.observedAt, source: 'DA-AMAS weekly average', sourceUrl: report.url });
  }
  if (records.length < 15) throw new Error('DA table changed or too few prices could be verified.');
  return records;
}
async function renderPage(page) {
  const { items } = await page.getTextContent();
  const rows = [];
  for (const item of items) {
    const y = item.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x: item.transform[4], text: item.str });
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(' ')).join('\n');
}
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`DA source returned ${response.status}`);
  return response;
}
export async function fetchDaPrices() {
  const html = await (await get(DA_INDEX)).text();
  const report = reportLinks(html)[0];
  if (!report) throw new Error('No dated weekly DA report found.');
  const buffer = Buffer.from(await (await get(report.url)).arrayBuffer());
  if (buffer.length > 5000000) throw new Error('DA report exceeds expected size.');
  const parsed = await pdf(buffer, { pagerender: renderPage });
  if (!/NCR Markets/i.test(parsed.text)) throw new Error('Report region could not be verified.');
  return { records: parseDaRows(parsed.text.split('\n'), report), report, fetchedAt: new Date().toISOString(), status: 'updated' };
}
