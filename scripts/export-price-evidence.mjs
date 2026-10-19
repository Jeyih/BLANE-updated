import { readFile, writeFile } from 'node:fs/promises';
import { ingredientPriceAudit, formatPrice } from '../src/lib/pricing.js';
const db = JSON.parse(
  await readFile(new URL('../tmp/ingredient-pricing-audit.json', import.meta.url), 'utf8'),
);
const snapshots = await Promise.all(
  ['ingredient-prices', 'retail-prices'].map(async (name) =>
    JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8')),
  ),
);
const records = snapshots.flatMap((s) => s.records);
const names = [
  ...new Set([...db.recipeIngredients, ...db.marketIngredients].map((i) => i.name).filter(Boolean)),
].sort();
const rows = names.map((name) => ingredientPriceAudit(name, db.recipeIngredients, records));
const counts = {};
for (const row of rows) counts[row.evidence.label] = (counts[row.evidence.label] || 0) + 1;
const date = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
const header = [
  'Ingredient',
  'Source price PHP',
  'Unit',
  'Evidence status',
  'Actual source product',
  'Source URL',
  'Observed date',
  'Assumptions',
  'Conversion database URLs',
  'Required verification',
];
const data = rows.map((row) => {
  const source = row.quote?.records[0];
  return [
    row.name,
    row.quote?.price ?? '',
    row.quote?.unit || '',
    row.evidence.label,
    source?.description || source?.name || '',
    source?.sourceUrl || '',
    source?.observedAt || '',
    [...row.assumptions, ...row.conversionNotes].join(' | '),
    row.conversionSources.join(' | '),
    row.verificationTasks.join(' | '),
  ];
});
const csv = [header, ...data]
  .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  .join('\r\n');
await writeFile(new URL('../PRICE_EVIDENCE_AUDIT.csv', import.meta.url), '\uFEFF' + csv);
const cell = (v) =>
  String(v || '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
const report = [
  `# Ingredient price evidence audit \u2014 ${date}`,
  '',
  `${rows.length} distinct names used in recipes or market inventory. A real quoted product price does not make a different food, cooking yield or household quantity exact.`,
  '',
  ...Object.entries(counts).map(([name, count]) => `- ${name}: ${count}`),
  '',
  'DA report prices are retained. Only Philippine DA reports and Philippine store listings in PHP supply prices. Foreign cooking-yield factors are not used.',
  '',
  '## Source databases',
  '',
  '- [DA price monitoring](https://www.da.gov.ph/price-monitoring/)',
  '- [Metro public product catalogue](https://shopmetro.ph/wp-json/wc/store/v1/products)',
  '- [FNRI Philippine food composition catalogue](https://i.fnri.dost.gov.ph/fct/library) (nutrition data; not a price or cooking-yield database)',
  '',
  '- [DOST-FNRI MARFEL portion weights](https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=1) and [AP/EP definitions](https://marfel.fnri.dost.gov.ph/marfel-faqs): four exact food matches use published purchase and edible weights, labeled as reference estimates.',
  '',
  'Rice and oats use Philippine raw-product price benchmarks with explicit equal-weight assumptions. These are not verified cooked-food costs. A measured or documented Philippine preparation yield is required before certifying the recipe cost.',
  '',
  'Exact ordinary duck liver, domestic quail, suckling-pig leg and lima-bean pod quotations remain unverified. Their displayed estimates use explicitly disclosed different-product benchmarks. Retail listings found for premium foie gras, pet treats, whole birds, unspecified beans, and prepared foods without pack weights do not establish exact affordable prices for these foods. A dated matching supplier quote or measured preparation yield is still required.',
  '',
  'Assumption-based recipe calculations are excluded from affordability and cheapest-day results. The website keeps their labeled estimates visible for review.',
  '',
  '## All priced ingredients and their assumptions',
  '',
  '| Ingredient | Listed price/unit | Evidence | Actual product/source | Assumptions / conversion evidence |',
  '| --- | --- | --- | --- | --- |',
  ...rows.map((row) => {
    const source = row.quote?.records[0];
    return `| ${cell(row.name)} | ${row.quote ? `${formatPrice(row.quote.price)} / ${row.quote.unit}` : 'Unavailable'} | ${cell(row.evidence.label)} | ${source ? `[${cell(source.description || source.name)}](${source.sourceUrl}) \xB7 ${source.observedAt}` : 'No source'} | ${cell([...row.assumptions, ...row.conversionNotes].join(' '))} ${row.conversionSources.map((url) => `[Portion reference](${url})`).join(' ')} |`;
  }),
  '',
  'Refresh source snapshots and rerun `node scripts/export-price-evidence.mjs` to regenerate this report. The app audit and CSV export use the current live feed.',
  '',
].join('\n');
await writeFile(new URL('../PRICE_EVIDENCE_AUDIT.md', import.meta.url), report);
console.log(JSON.stringify({ ingredients: rows.length, counts }, null, 2));
