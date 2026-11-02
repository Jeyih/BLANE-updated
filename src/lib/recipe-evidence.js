import { SPECIAL_DIET_NUTRIENTS, NUTRIENT_REFERENCE_SOURCE } from '../data/special-diet-nutrients.js';

export const REFERENCE_NUTRIENTS = [
  ['phenylalanine', 'Phenylalanine', 'mg'], ['potassium', 'Potassium', 'mg'],
  ['phosphorus', 'Phosphorus', 'mg'], ['sodium', 'Sodium', 'mg'], ['protein', 'Protein', 'g'],
];

export function recipeNutrientEvidence(recipe) {
  const ingredients = recipe.ingredients || [];
  const rows = ingredients.map(ingredient => {
    const reference = SPECIAL_DIET_NUTRIENTS[String(ingredient.fct_id || '')];
    const grams = Number(ingredient.grams);
    const matched = reference && ingredient.name === reference.name && Number.isFinite(grams) && grams > 0;
    return { ingredient, reference: matched ? reference : null, grams };
  });
  const complete = rows.length > 0 && rows.every(row => row.reference);
  const servings = Number(recipe.servings);
  // Totals describe the listed inputs. Never divide an existing per-serving cost,
  // or assume that recipe ingredients represent a measured cooked batch.
  const totals = complete ? Object.fromEntries(REFERENCE_NUTRIENTS.map(([key]) =>
    [key, rows.reduce((sum, row) => sum + row.reference[key] * row.grams / 100, 0)])) : null;
  return { rows, complete, totals, servings: Number.isFinite(servings) && servings > 0 ? servings : null };
}

// Prevent spreadsheet formula interpretation of user-editable catalogue values.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function recipeEvidenceCsv(recipe, exportedAt = new Date().toISOString()) {
  const evidence = recipeNutrientEvidence(recipe);
  const rows = [
    ['BLANE recipe evidence worksheet', 'Unverified worksheet; not a completed clinical review'],
    ['Recipe', recipe.name], ['Recipe ID', recipe.id], ['Exported at', exportedAt],
    ['Recorded servings', recipe.servings],
    ['Quantity basis', 'Catalogue inputs; confirm whether these represent the full measured batch'],
    ['Recipe steps', (recipe.steps || []).map((step, i) => `${i + 1}. ${step.title}: ${step.desc}`).join('\n')],
    [],
    ['Ingredient', 'FNRI ID', 'Recorded quantity', 'Recorded grams', 'Estimated ingredient cost PHP',
      'Price evidence', 'Source product', 'Source price / unit', 'Source pack', 'Source URL', 'Quote date',
      'Exact brand / variant / lot (complete)', 'Label ingredients / allergen declaration (complete)',
      'Package photo / supplier evidence (complete)', 'Actual purchase quantity and unit (complete)',
      'Measured prepared raw weight g (complete)', 'Trim / shell / drain loss g (complete)'],
  ];
  for (const ingredient of recipe.ingredients || []) {
    const sources = ingredient.priceRecords?.length ? ingredient.priceRecords : [null];
    sources.forEach((source, index) => rows.push([
      ingredient.name, ingredient.fct_id, ingredient.qty, ingredient.grams,
      index === 0 && Number.isFinite(ingredient.cost) ? ingredient.cost : '',
      ingredient.evidence?.reason || ingredient.evidence?.label || 'Price evidence not established',
      source?.description, source ? `${source.price} / ${source.unit}` : '',
      source?.packQuantity ? `${source.packPrice ?? ''} / ${source.packQuantity}` : '',
      source?.sourceUrl, source?.observedAt, '', '', '', '', '', '',
    ]));
  }
  rows.push([], ['Nutrient source', NUTRIENT_REFERENCE_SOURCE.archive],
    ['Reference release', NUTRIENT_REFERENCE_SOURCE.release],
    ['Important', 'US raw-food proxies; not measured cooked values, not individual dietary approval'],
    ['Ingredient', 'USDA FDC ID', 'USDA food description', 'Matching limitation',
      ...REFERENCE_NUTRIENTS.map(([, label, unit]) => `${label} ${unit} per 100 g`)]);
  evidence.rows.forEach(row => rows.push([row.ingredient.name, row.reference?.fdcId,
    row.reference?.description, row.reference?.caveat || 'No matched nutrient reference / valid weight',
    ...REFERENCE_NUTRIENTS.map(([key]) => row.reference?.[key] ?? '')]));
  if (evidence.totals) {
    rows.push(['Listed-input total (not cooked)', ...REFERENCE_NUTRIENTS.map(([key, label, unit]) =>
      `${label}: ${evidence.totals[key].toFixed(2)} ${unit}`)]);
  }
  rows.push([], ['Execution field', 'Actual record (complete; no assumed pass)'],
    ...['Batch ID and preparation date', 'Person preparing / checking', 'All additions and substitutions',
      'Shared equipment / utensils / storage and cross-contact controls', 'Supplier cross-contact confirmation',
      'Final cooked batch weight g', 'Actual serving count and serving weight g',
      'Total batch ingredient cost PHP (all quantities verified)',
      'PKU prescribed allowance and metabolic dietitian assessment',
      'CKD prescribed mineral / protein / fluid limits and renal dietitian assessment',
      'Prescribed IDDSI level', 'IDDSI method, serving temperature, result and evidence',
      'Reviewer qualification, date, scope and decision'].map(label => [label, '']),
    ['Cost formula', 'Verified full-batch ingredient cost / measured number of servings. Do not divide a per-serving cost again.'],
    ['IDDSI reference', 'https://www.iddsi.org/standards/framework'],
    ['Allergen reference', 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies']);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
