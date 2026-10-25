import { supabase } from './supabase';
import { asList, activeConstraintKeys, unmatchedConstraints, recipeViolations, recipeEligible } from './constraint-rules.js';
const CB_CONSTRAINTS = {};
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
      warnHighCarb: row.warnHighCarb ?? row.warn_high_carb, carbThreshold: row.carbThreshold ?? row.carb_threshold,
      warnHighFat: row.warnHighFat ?? row.warn_high_fat, fatThreshold: row.fatThreshold ?? row.fat_threshold,
      warnHighProtein: row.warnHighProtein ?? row.warn_high_protein, proteinThreshold: row.proteinThreshold ?? row.protein_threshold,
    };
  });
  Object.assign(CB_CONSTRAINTS, definitions);
  return definitions;
}

function getActiveConstraints(profile, definitions = CB_CONSTRAINTS) { return [...activeConstraintKeys(profile, definitions), ...unmatchedConstraints(profile, definitions).map(v => 'unmatched:' + v)]; }
function getUnmatchedConstraints(profile, definitions = CB_CONSTRAINTS) { return unmatchedConstraints(profile, definitions); }
function checkRecipeViolations(recipe, active, enabled = true, definitions = CB_CONSTRAINTS) { return recipeViolations(recipe, active, enabled, definitions); }
function canSelectRecipe(recipe, profile, definitions = CB_CONSTRAINTS, ready = true) { return recipeEligible(recipe, profile, definitions, ready); }
export { CB_CONSTRAINTS, loadConstraintDefinitions, getActiveConstraints, getUnmatchedConstraints, checkRecipeViolations, canSelectRecipe };
