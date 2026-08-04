/* ============================================================
   BLANE — Constraint-Based Planning (Module 08)
   Replaces: the CB_CONSTRAINTS data + checkRecipeViolations()
   logic from js/constraints.js.

   The HTML-string generators (renderConstraintBar, badge/detail
   HTML) are now React components — see ConstraintWarnings.jsx.
   ============================================================ */

export const CB_CONSTRAINTS = {
  nut_allergy: { label: 'Nut Allergy', severity: 'allergy', icon: '🥜',
    blocked: ['peanut butter', 'ground peanuts', 'cashew', 'almond', 'peanuts'], reason: 'contains nut-based ingredient' },
  shellfish_allergy: { label: 'Shellfish Allergy', severity: 'allergy', icon: '🦐',
    blocked: ['bagoong alamang', 'shrimp', 'prawn', 'crab', 'squid', 'bagoong'], reason: 'contains shellfish or shellfish-derived ingredient' },
  egg_free: { label: 'Egg-Free', severity: 'allergy', icon: '🥚',
    blocked: ['eggs', 'egg', 'salted egg', 'egg yolk', 'egg white'], reason: 'contains egg' },
  soy_free: { label: 'Soy-Free', severity: 'allergy', icon: '🫘',
    blocked: ['soy sauce', 'tofu', 'soy milk', 'edamame', 'miso'], reason: 'contains soy-based ingredient' },

  vegetarian: { label: 'Vegetarian', severity: 'dietary', icon: '🥦',
    blocked: ['chicken', 'chicken breast', 'chicken thigh', 'pork', 'pork belly', 'bangus', 'tilapia', 'fish sauce', 'bagoong alamang', 'beef', 'grilled pork'],
    reason: 'contains meat or fish' },
  vegan: { label: 'Vegan', severity: 'dietary', icon: '🌱',
    blocked: ['chicken', 'chicken breast', 'pork', 'pork belly', 'bangus', 'tilapia', 'fish sauce', 'bagoong alamang', 'eggs', 'salted egg', 'milk', 'honey'],
    reason: 'contains animal product' },
  halal: { label: 'Halal', severity: 'dietary', icon: '☪️',
    blocked: ['pork', 'pork belly', 'bagoong', 'bagoong alamang'], reason: 'contains non-halal ingredient' },
  gluten_free: { label: 'Gluten-Free', severity: 'dietary', icon: '🌾',
    blocked: ['soy sauce', 'wheat', 'bread', 'flour', 'pasta'], reason: 'may contain gluten' },
  dairy_free: { label: 'Dairy-Free', severity: 'dietary', icon: '🥛',
    blocked: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'kesong puti'], reason: 'contains dairy' },
  low_sodium: { label: 'Low Sodium', severity: 'dietary', icon: '🧂',
    blocked: ['fish sauce', 'soy sauce', 'bagoong alamang', 'salted egg', 'bagoong'], reason: 'high sodium ingredient' },
  low_sugar: { label: 'Low Sugar', severity: 'dietary', icon: '🍬',
    blocked: ['honey', 'brown sugar', 'sugar', 'condensed milk'], reason: 'high sugar ingredient' },
  kosher: { label: 'Kosher', severity: 'dietary', icon: '✡️',
    blocked: ['pork', 'pork belly', 'shellfish', 'bagoong alamang'], reason: 'not kosher ingredient' },

  diabetes_t1: { label: 'Diabetes Type 1', severity: 'medical', icon: '💉', warnHighCarb: true, carbThreshold: 45,
    blocked: ['brown sugar', 'sugar', 'honey', 'condensed milk'], reason: 'high glycemic ingredient — monitor blood sugar' },
  diabetes_t2: { label: 'Diabetes Type 2', severity: 'medical', icon: '🩸', warnHighCarb: true, carbThreshold: 45,
    blocked: ['brown sugar', 'sugar', 'honey', 'condensed milk'], reason: 'high glycemic ingredient — monitor blood sugar' },
  hypertension: { label: 'Hypertension', severity: 'medical', icon: '❤️',
    blocked: ['fish sauce', 'soy sauce', 'bagoong alamang', 'salted egg', 'bagoong'], reason: 'high sodium — may raise blood pressure' },
  high_cholesterol: { label: 'High Cholesterol', severity: 'medical', icon: '🫀', warnHighFat: true, fatThreshold: 20,
    blocked: ['pork belly', 'butter', 'cream', 'coconut cream'], reason: 'high saturated fat — may raise cholesterol' },
  gerd: { label: 'GERD / Acid Reflux', severity: 'medical', icon: '🔥',
    blocked: ['calamansi', 'vinegar', 'chili', 'tomato', 'garlic'], reason: 'may trigger acid reflux' },
  kidney_disease: { label: 'Kidney Disease', severity: 'medical', icon: '🫘', warnHighProtein: true, proteinThreshold: 30,
    blocked: ['bagoong alamang', 'fish sauce', 'soy sauce'], reason: 'high phosphorus/sodium — avoid with kidney disease' },
  gout: { label: 'Gout', severity: 'medical', icon: '🦵',
    blocked: ['pork belly', 'beef', 'sardines', 'anchovies', 'bagoong'], reason: 'high purine content — may trigger gout' },
};

export function getActiveConstraints(profile) {
  const dietary = profile?.dietary_restrictions || [];
  const medical = profile?.medical_conditions || [];
  return [...dietary, ...medical].filter((key) => CB_CONSTRAINTS[key] !== undefined);
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