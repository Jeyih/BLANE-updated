import { supabase } from './supabase';
const CB_CONSTRAINTS = {};
const normalized = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
function asList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => asList(item));
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value.trim();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.flatMap((item) => asList(item));
  } catch {}
  const postgresArray = text.match(/^\{(.*)\}$/s);
  const items = postgresArray ? postgresArray[1].split(',') : text.split(',');
  return items.map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}
async function loadConstraintDefinitions() {
  const { data, error } = await supabase
    .from('constraint_definitions')
    .select('*')
    .order('sort_order');
  if (error) {
    console.error('Failed to load constraint definitions:', error);
    return false;
  }
  const definitions = {};
  Object.keys(CB_CONSTRAINTS).forEach((key) => delete CB_CONSTRAINTS[key]);
  (data || []).forEach((row) => {
    if (row.active === false || !row.key) return;
    definitions[row.key] = {
      label: row.label || row.key,
      severity: row.severity || 'dietary',
      icon: row.icon || '\u26A0\uFE0F',
      reason:
        row.reason ||
        'Contains ingredients that may conflict with your preferences or medical profile.',
      blocked: asList(row.blocked),
    };
  });
  Object.assign(CB_CONSTRAINTS, definitions);
  return definitions;
}
function getActiveConstraints(profile, definitions = CB_CONSTRAINTS) {
  const dietary = asList(profile?.dietary_restrictions);
  const medical = asList(profile?.medical_conditions);
  const allergies = asList(profile?.allergies);
  const definitionEntries = Object.entries(definitions);
  return [...dietary, ...medical, ...allergies]
    .map((value) => {
      const selected = normalized(typeof value === 'object' ? value.key || value.label : value);
      const match = definitionEntries.find(
        ([key, definition]) =>
          normalized(key) === selected || normalized(definition.label) === selected,
      );
      return match?.[0];
    })
    .filter((key, index, values) => key && values.indexOf(key) === index);
}
function getUnmatchedConstraints(profile, definitions = CB_CONSTRAINTS) {
  return ['dietary_restrictions', 'medical_conditions', 'allergies'].flatMap((field) =>
    asList(profile?.[field]).filter((value) => {
      const selected = normalized(typeof value === 'object' ? value.key || value.label : value);
      return !Object.entries(definitions).some(
        ([key, definition]) =>
          normalized(key) === selected || normalized(definition.label) === selected,
      );
    }),
  );
}
function checkRecipeViolations(
  recipe,
  activeConstraints,
  filterOn = true,
  definitions = CB_CONSTRAINTS,
) {
  if (!filterOn || activeConstraints.length === 0) return [];
  const violations = [];
  activeConstraints.forEach((key) => {
    const constraint = definitions[key];
    if (!constraint) return;
    (recipe.ingredients || []).forEach((ing) => {
      const ingName = normalized(
        [ing?.name, ing?.ingredient_name, ing?.food_name].filter(Boolean).join(' '),
      );
      if (!ingName) return;
      const isBlocked = constraint.blocked.some((blocked) => {
        const blockedName = normalized(blocked);
        return blockedName && (ingName.includes(blockedName) || blockedName.includes(ingName));
      });
      if (isBlocked) {
        const exists = violations.some((v) => v.ingredient === ing.name && v.constraintKey === key);
        if (!exists) {
          violations.push({
            constraintKey: key,
            constraintLabel: constraint.label,
            severity: constraint.severity,
            icon: constraint.icon,
            ingredient: ing.name,
            reason: constraint.reason,
          });
        }
      }
    });
    if (constraint.warnHighCarb && recipe.carbs > constraint.carbThreshold) {
      violations.push({
        constraintKey: key,
        constraintLabel: constraint.label,
        severity: constraint.severity,
        icon: constraint.icon,
        ingredient: 'Total Carbs (' + recipe.carbs + 'g)',
        reason: 'exceeds ' + constraint.carbThreshold + 'g carb threshold for ' + constraint.label,
      });
    }
    if (constraint.warnHighFat && recipe.fats > constraint.fatThreshold) {
      violations.push({
        constraintKey: key,
        constraintLabel: constraint.label,
        severity: constraint.severity,
        icon: constraint.icon,
        ingredient: 'Total Fats (' + recipe.fats + 'g)',
        reason: 'exceeds ' + constraint.fatThreshold + 'g fat threshold for ' + constraint.label,
      });
    }
    if (constraint.warnHighProtein && recipe.protein > constraint.proteinThreshold) {
      violations.push({
        constraintKey: key,
        constraintLabel: constraint.label,
        severity: constraint.severity,
        icon: constraint.icon,
        ingredient: 'Total Protein (' + recipe.protein + 'g)',
        reason:
          'exceeds ' + constraint.proteinThreshold + 'g protein threshold for ' + constraint.label,
      });
    }
  });
  return violations;
}
export {
  CB_CONSTRAINTS,
  checkRecipeViolations,
  getActiveConstraints,
  getUnmatchedConstraints,
  loadConstraintDefinitions,
};
