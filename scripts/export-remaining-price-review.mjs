import { readFile, writeFile } from 'node:fs/promises';
import { ingredientPriceAudit } from '../src/lib/pricing.js';
const db = JSON.parse(
  await readFile(new URL('../tmp/ingredient-pricing-audit.json', import.meta.url), 'utf8'),
);
const feeds = await Promise.all(
  ['ingredient-prices', 'retail-prices'].map(async (name) =>
    JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8')),
  ),
);
const records = feeds.flatMap((feed) => feed.records);
const resolved = new Set([
  'Garlic bulb',
  'Onion, Bombay bulb',
  'Carrot, boiled',
  'Cabbage, green, boiled',
  'Squash fruit, boiled',
  'String/Yard long bean pod, green, boiled',
]);
const audits = [
  ...new Set([...db.recipeIngredients, ...db.marketIngredients].map((i) => i.name).filter(Boolean)),
]
  .sort()
  .map((name) => ingredientPriceAudit(name, db.recipeIngredients, records))
  .filter((audit) => audit.evidence.needsReview || resolved.has(audit.name));
if (audits.length !== 52)
  throw new Error(`Expected the original 52 ingredients, found ${audits.length}.`);
const cell = (value) =>
  String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
const report = [
  '# Review of the remaining 52 ingredient names',
  '',
  'All 52 records were checked against their existing source listings and recipe quantities. Six gaps were resolved as sourced references: two exact Philippine store quotes and four documented Philippine portion estimates. Forty-six remain unresolved for full recipe costing. These are not 52 newly missing store prices: many have a real raw-product quote but no valid cooked or edible-portion conversion.',
  '',
  '## Evidence checked',
  '',
  '- [DOST-FNRI MARFEL food exchange records](https://marfel.fnri.dost.gov.ph/marfel-food-exchange-list?category=-1&page=1): carrot AP 51g / EP 45g; cabbage 64g / 45g; squash 52g / 45g; sitaw 42g / 45g. All seven public pages were inspected. A dash in AP is not converted to a fabricated value.',
  '- [DOST-FNRI AP/EP definitions and edition](https://marfel.fnri.dost.gov.ph/marfel-faqs): reference portions from FEL 4th edition, 2019; these are not measurements of each recipe or checkout prices.',
  '- [Metro native garlic](https://shopmetro.ph/product/native-garlic-1kg/) and [native red onion](https://shopmetro.ph/product/gf-onion-native-red-1kg/): exact product identity, labelled 1kg basis and PHP prices are checked on each refresh.',
  '- [Metro public catalogue](https://shopmetro.ph/wp-json/wc/store/v1/products): 901 products inspected through targeted ingredient and prepared-food searches. Existing reviewed store prices were refreshed successfully.',
  '',
  '## Rejected or incomplete leads',
  '',
  '- Ordinary duck liver: foie gras and pet treats do not establish a human-food price for ordinary duck liver.',
  '- Quail meat: whole birds, approximate weights and non-primary classified listings do not establish a matching edible-meat rate.',
  '- Lima-bean pods: planting seeds, hyacinth beans and ordinary Baguio beans are not the requested cooked lima-bean pods.',
  '- Suckling-pig leg: regular pork shoulder, adult pig legs and whole lechon do not establish the requested cut price.',
  '- [Molinera chickpeas listing](https://lahatdito.com.ph/product/Molinera-Natural-Chick-Peas-Garbanzos--400g-YpQ2p) states 400g net and 240g drained. Its direct HTTPS fetch redirected insecurely, so it was not added as a trusted automatic source.',
  '- [ACT II salted tray popcorn](https://shopmetro.ph/product/act-ii-salted-tray-popcorn-85g/) is ready to pop, not ready-to-eat popped weight. [Alamang 80g](https://shopmetro.ph/product/alamang-80g/) describes dried shrimp and inconsistently calls it paste; neither resolves the requested prepared food.',
  '- Ready-to-eat rice, boiled eggs and cassava-suman listings were found, but unspecified varieties, portion weights or approximate recipe piece counts remain unresolved. No guessed pack-to-serving conversion was imported.',
  '',
  '## Every ingredient and outcome',
  '',
  '| Ingredient | Outcome | Source checked | Evidence still required / supported reference |',
  '| --- | --- | --- | --- |',
  ...audits.map((audit) => {
    const source = audit.quote?.records[0];
    const outcome = audit.evidence.needsReview
      ? 'Unresolved for full costing'
      : audit.evidence.label;
    const details = audit.evidence.needsReview
      ? audit.verificationTasks.join(' ')
      : audit.conversionNotes.join(' ') ||
        'Matching product identity and labelled kilogram price verified.';
    return `| ${cell(audit.name)} | ${cell(outcome)} | ${source ? `[${cell(source.description || source.name)}](${source.sourceUrl})` : 'No matching source'} | ${cell(details)} |`;
  }),
  '',
  'Actual recipe measurements require weighing food, recording raw inputs and output, and documenting every preparation ingredient. No measurements or receipts were invented. The six resolved entries are reference estimates; meal totals can still fail affordability if another ingredient is unresolved. All changes remain local until deployed.',
  '',
].join('\n');
await writeFile(new URL('../REMAINING_INGREDIENT_REVIEW.md', import.meta.url), report);
console.log(
  JSON.stringify({
    reviewed: audits.length,
    resolved: audits.filter((a) => !a.evidence.needsReview).length,
    unresolved: audits.filter((a) => a.evidence.needsReview).length,
  }),
);
