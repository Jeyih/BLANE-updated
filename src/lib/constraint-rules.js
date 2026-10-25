export const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function asList(value) {
  if (Array.isArray(value)) return value.flatMap(asList);
  if (value && typeof value === 'object') return [value.key || value.label].filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.flatMap(asList); } catch {}
  return value.replace(/^\{|\}$/g, '').split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
const GROUPS = {
  meat: ['beef', 'pork', 'chicken', 'duck', 'quail', 'pugo', 'rabbit', 'venison', 'bacon', 'ham', 'sausage', 'meat', 'liver', 'gizzard', 'gelatin', 'lard'],
  seafood: ['fish', 'milkfish', 'bangus', 'tilapia', 'tuna', 'sardine', 'salmon', 'shrimp', 'prawn', 'crab', 'shellfish', 'clam', 'oyster', 'mussel', 'squid', 'anchovy', 'bagoong', 'patis', 'seafood'],
  egg: ['egg', 'eggs', 'mayonnaise', 'mayonnaise dressing'],
  dairy: ['milk', 'dairy', 'butter', 'cheese', 'cream', 'yogurt', 'yoghurt', 'whey', 'casein', 'margarine'],
};
function words(name, token) {
  const text = ` ${normalized(name)} `;
  const parts = normalized(token).split(' '), last = parts.pop();
  if (!last) return false;
  const forms = new Set([last, last + 's', last + 'es']);
  if (last.endsWith('s') && !last.endsWith('ss')) forms.add(last.slice(0, -1));
  return [...forms].some(word => text.includes(` ${[...parts, word].join(' ')} `));
}
function ingredientText(value) {
  return normalized(value).replace(/\beggs? (chicken|duck|quail)\b/g, 'egg').replace(/\b(coconut|soy|soya|oat|almond|rice) (milk|cream)\b/g, '$1 beverage').replace(/\bpeanut butter\b/g, 'peanut spread').replace(/\boyster mushroom\b/g, 'mushroom');
}
export function ingredientMatches(name, blocked) {
  const token = normalized(blocked), text = ingredientText(name);
  const group = /^(meat|meats|poultry)$/.test(token) ? 'meat' : /^(seafood|fish|shellfish)$/.test(token) ? 'seafood' : /^(egg|eggs)$/.test(token) ? 'egg' : /^(dairy|milk|dairy products|milk products)$/.test(token) ? 'dairy' : null;
  return group ? GROUPS[group].some(t => words(text, t)) : words(text, token);
}
export function constraintTokens(key, definition) {
  const label = normalized(`${key} ${definition.label}`);
  const tokens = [...asList(definition.blocked)];
  if (/\bvegan\b/.test(label)) tokens.push('meat', 'seafood', 'egg', 'dairy', 'honey');
  else if (/\bvegetarian\b/.test(label)) tokens.push('meat', 'seafood');
  if (/dairy free|milk allergy|dairy allergy|lactose/.test(label)) tokens.push('dairy');
  if (/egg allergy|allergy egg/.test(label)) tokens.push('egg');
  return [...new Set(tokens)];
}
export function activeConstraintKeys(profile, definitions) {
  return [...asList(profile?.dietary_restrictions), ...asList(profile?.medical_conditions), ...asList(profile?.allergies)].map(v => Object.keys(definitions).find(k => normalized(k) === normalized(v) || normalized(definitions[k].label) === normalized(v))).filter((v,i,a) => v && a.indexOf(v) === i);
}
export function unmatchedConstraints(profile, definitions) {
  return [...asList(profile?.dietary_restrictions), ...asList(profile?.medical_conditions), ...asList(profile?.allergies)].filter(v => !Object.keys(definitions).some(k => normalized(k) === normalized(v) || normalized(definitions[k].label) === normalized(v)));
}
export function recipeViolations(recipe, active, filterOn = true, definitions = {}) {
  if (!filterOn || !active.length) return [];
  const violations = [];
  for (const key of active) {
    const def = definitions[key];
    if (!def) {
      violations.push({ constraintKey: key, constraintLabel: 'Rules unavailable', severity: 'dietary', icon: '\u26A0', ingredient: key.replace('unmatched:', ''), reason: 'This profile restriction has no loaded rule. Selection is disabled until it can be checked.' });
      continue;
    }
    const tokens = constraintTokens(key, def);
    const add = (ingredient, reason = def.reason || 'Conflicts with your recorded dietary rules.') => {
      if (!violations.some(v => v.constraintKey === key && v.ingredient === ingredient)) violations.push({ constraintKey: key, constraintLabel: def.label || key, severity: def.severity || 'dietary', icon: def.icon || '\u26A0', ingredient, reason });
    };
    const ingredients = recipe.ingredients || [];
    if (!ingredients.length || ingredients.some(i => !normalized(typeof i === 'string' ? i : i.name || i.ingredient_name || i.food_name))) add('Ingredient data incomplete', 'This recipe cannot be checked until its ingredient records are complete.');
    const components = ingredients.map(i => typeof i === 'string' ? i : [i.name, i.ingredient_name, i.food_name].filter(Boolean).join(' '));
    // Titles and preparation steps can expose components absent from catalogue names.
    components.push(recipe.name || '', ...(recipe.steps || []).map(s => `${s.title || ''} ${s.desc || s.description || ''}`));
    for (const name of components) if (tokens.some(t => ingredientMatches(name, t))) add(name);
    if (/polvoron|3[ -]?in[ -]?1|three in one/i.test(components.join(' ')) && tokens.some(t => ingredientMatches('milk', t))) add('Prepared-food composition needs review', 'This prepared food may include milk. Verify its component ingredients before selecting it.');
    for (const [macro, flag, threshold] of [['carbs','warnHighCarb','carbThreshold'],['fats','warnHighFat','fatThreshold'],['protein','warnHighProtein','proteinThreshold']]) {
      if (def[flag] && Number.isFinite(Number(def[threshold])) && Number(recipe[macro]) > Number(def[threshold])) add(`Total ${macro} (${recipe[macro]} g)`, `Exceeds the configured ${def[threshold]} g ${macro} threshold.`);
    }
  }
  return violations;
}
export function recipeEligible(recipe, profile, definitions, ready = true) {
  return Boolean(recipe && profile && ready && !unmatchedConstraints(profile, definitions).length && recipeViolations(recipe, activeConstraintKeys(profile, definitions), true, definitions).length === 0);
}
