/* ============================================================
   BLANE — Constraint-Based Planning (Module 08)
   Replaces: the CB_CONSTRAINTS data + checkRecipeViolations()
   logic from js/constraints.js.

   The HTML-string generators (renderConstraintBar, badge/detail
   HTML) are now React components — see ConstraintWarnings.jsx.
   ============================================================ */
import { supabase } from './supabase';

// Constraint definitions are now managed by the Admin panel and stored
// in the database. Keep an empty placeholder so code reads gracefully.
export const CB_CONSTRAINTS = {};

export async function loadConstraintDefinitions() {
  const { data, error } = await supabase
    .from('constraint_definitions')
    .select('*')
    .order('sort_order');

  if (error) {
    console.error('Failed to load constraint definitions:', error);
    return false;
  }

  Object.keys(CB_CONSTRAINTS).forEach((key) => delete CB_CONSTRAINTS[key]);

  (data || []).forEach((row) => {
    if (row.active === false || !row.key) return;
    CB_CONSTRAINTS[row.key] = {
      label: row.label || row.key,
      severity: row.severity || 'dietary',
      icon: row.icon || '⚠️',
      reason: row.reason || 'Contains ingredients that may conflict with your preferences or medical profile.',
      blocked: Array.isArray(row.blocked)
        ? row.blocked.map((item) => item.trim()).filter(Boolean)
        : typeof row.blocked === 'string'
          ? row.blocked.split(',').map((item) => item.trim()).filter(Boolean)
          : [],
      warnHighCarb: !!row.warn_high_carb,
      carbThreshold: row.carb_threshold || 0,
      warnHighFat: !!row.warn_high_fat,
      fatThreshold: row.fat_threshold || 0,
      warnHighProtein: !!row.warn_high_protein,
      proteinThreshold: row.protein_threshold || 0,
    };
  });

  return true;
}

export function getActiveConstraints(profile) {
  const dietary = profile?.dietary_restrictions || [];
  const medical = profile?.medical_conditions || [];
  const allergies = profile?.allergies || [];
  return [...dietary, ...medical, ...allergies].filter((key) => CB_CONSTRAINTS[key] !== undefined);
}

export function checkRecipeViolations(recipe, activeConstraints, filterOn = true) {
  if (!filterOn || activeConstraints.length === 0) return [];

  const violations = [];

  activeConstraints.forEach((key) => {
    const constraint = CB_CONSTRAINTS[key];
    if (!constraint) return;

    recipe.ingredients.forEach((ing) => {
      const ingName = ing.name.toLowerCase();
      const isBlocked = constraint.blocked.some(
        (blocked) => ingName.includes(blocked.toLowerCase()) || blocked.toLowerCase().includes(ingName.split(' ')[0])
      );
      if (isBlocked) {
        const exists = violations.some((v) => v.ingredient === ing.name && v.constraintKey === key);
        if (!exists) {
          violations.push({
            constraintKey: key, constraintLabel: constraint.label, severity: constraint.severity,
            icon: constraint.icon, ingredient: ing.name, reason: constraint.reason,
          });
        }
      }
    });

    if (constraint.warnHighCarb && recipe.carbs > constraint.carbThreshold) {
      violations.push({ constraintKey: key, constraintLabel: constraint.label, severity: constraint.severity, icon: constraint.icon,
        ingredient: 'Total Carbs (' + recipe.carbs + 'g)', reason: 'exceeds ' + constraint.carbThreshold + 'g carb threshold for ' + constraint.label });
    }
    if (constraint.warnHighFat && recipe.fats > constraint.fatThreshold) {
      violations.push({ constraintKey: key, constraintLabel: constraint.label, severity: constraint.severity, icon: constraint.icon,
        ingredient: 'Total Fats (' + recipe.fats + 'g)', reason: 'exceeds ' + constraint.fatThreshold + 'g fat threshold for ' + constraint.label });
    }
    if (constraint.warnHighProtein && recipe.protein > constraint.proteinThreshold) {
      violations.push({ constraintKey: key, constraintLabel: constraint.label, severity: constraint.severity, icon: constraint.icon,
        ingredient: 'Total Protein (' + recipe.protein + 'g)', reason: 'exceeds ' + constraint.proteinThreshold + 'g protein threshold for ' + constraint.label });
    }
  });

  return violations;
}