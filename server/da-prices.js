import pdf from 'pdf-parse/lib/pdf-parse.js';
import { ingredientKey } from '../src/lib/pricing.js';
const DA_INDEX = 'https://www.da.gov.ph/price-monitoring/';
function reportLinks(html, now = Date.now()) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .flatMap(([, href, raw]) => {
      let url;
      try {
        url = new URL(href.replace(/&amp;/g, '&'), DA_INDEX);
      } catch {
        return [];
      }
      if (url.hostname !== 'www.da.gov.ph' || !/Weekly-Average-Prices.*\.pdf$/i.test(url.pathname))
        return [];
      const label = raw
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;|&#8211;|&ndash;/g, ' ')
        .trim();
      const end = label.match(/(?:([A-Za-z]+)\s+)?(\d{1,2}),?\s+(\d{4})$/);
      const month = end?.[1] || label.match(/^([A-Za-z]+)/)?.[1];
      const date =
        end && month ? new Date(`${month} ${end[2]}, ${end[3]} 00:00:00 GMT+0800`) : null;
      if (!date || !Number.isFinite(date.getTime()) || date.getTime() > now) return [];
      return [
        {
          url: url.href,
          label,
          observedAt: new Date(date.getTime() + 8 * 36e5).toISOString().slice(0, 10),
          timestamp: date.getTime(),
        },
      ];
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}
function parseDaRows(lines, report, catalog, minimumRecordCount = 15) {
  if (!Array.isArray(catalog) || catalog.length === 0)
    throw new Error('DA product catalogue is unavailable.');
  const records = [];
  let section = '';
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (line.includes('IMPORTED COMMERCIAL RICE')) section = 'IMPORTED COMMERCIAL RICE';
    if (line.includes('LOCAL COMMERCIAL RICE')) section = 'LOCAL COMMERCIAL RICE';
    const item = catalog.find(
      (entry) =>
        new RegExp(entry.pattern).test(line) &&
        (!entry.requiredSection || section === entry.requiredSection),
    );
    if (!item || records.some((r) => r.key === ingredientKey(item.name))) continue;
    const values = line.match(/\b(kg|pc|L)\s+([\d,]+\.\d{2})\s*$/);
    if (!values) continue;
    const price = Number(values[2].replace(/,/g, ''));
    if (!Number.isFinite(price) || price <= 0) continue;
    records.push({
      name: item.name,
      key: ingredientKey(item.name),
      price,
      unit: values[1].toLowerCase(),
      description: line.replace(/\s+(kg|pc|L)\s+[\d,.]+$/, ''),
      region: item.region,
      kind: 'reference',
      currency: item.currency,
      sourceCountry: item.sourceCountry,
      observedAt: report.observedAt,
      source: item.source,
      sourceUrl: report.url,
    });
  }
  if (records.length < minimumRecordCount)
    throw new Error('DA table changed or too few prices could be verified.');
  return records;
}
async function renderPage(page) {
  const { items } = await page.getTextContent();
  const rows = [];
  for (const item of items) {
    const y = item.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 2);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x: item.transform[4], text: item.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join(' '),
    )
    .join('\n');
}
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12e3) });
  if (!response.ok) throw new Error(`DA source returned ${response.status}`);
  return response;
}
async function fetchDaPrices(referenceData) {
  if (!Array.isArray(referenceData?.daCatalog) || !referenceData.daCatalog.length)
    throw new Error('DA product catalogue is unavailable.');
  const html = await (await get(DA_INDEX)).text();
  const report = reportLinks(html)[0];
  if (!report) throw new Error('No dated weekly DA report found.');
  const buffer = Buffer.from(await (await get(report.url)).arrayBuffer());
  if (buffer.length > 5e6) throw new Error('DA report exceeds expected size.');
  const parsed = await pdf(buffer, { pagerender: renderPage });
  if (!/NCR Markets/i.test(parsed.text)) throw new Error('Report region could not be verified.');
  return {
    records: parseDaRows(parsed.text.split('\n'), report, referenceData.daCatalog),
    report,
    fetchedAt: new Date().toISOString(),
    status: 'updated',
  };
}
export { DA_INDEX, fetchDaPrices, parseDaRows, reportLinks };
