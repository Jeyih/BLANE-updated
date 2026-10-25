// Application estimates, not clinical prescriptions. Keep all screens on one policy.
export const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra_active: 1.9 };
export const GOAL_ADJUST = { lose_weight: 0.85, gain_muscle: 1.1, maintain: 1, improve_health: 1, boost_energy: 1, manage_condition: 1 };
export const MACRO_TARGETS = { protein: 0.3, carbs: 0.45, fats: 0.25 };
export function validateMeasurements(profile) {
  const age = Number(profile?.age), height = Number(profile?.height_cm), weight = Number(profile?.weight_kg);
  if (!Number.isInteger(age) || age <= 0) return 'Enter a positive whole-number age.';
  if (!Number.isFinite(height) || height <= 0) return 'Enter a positive height in centimeters.';
  if (!Number.isFinite(weight) || weight <= 0) return 'Enter a positive weight in kilograms.';
  return '';
}
export function computeDailyTargets(profile = {}) {
  const positive = (v, fallback) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback;
  const h = positive(profile?.height_cm, 170), w = positive(profile?.weight_kg, 70), age = positive(profile?.age, 25);
  const bmr = 10 * w + 6.25 * h - 5 * age + (profile?.sex === 'female' ? -161 : 5);
  const tdee = bmr * (ACTIVITY_MULT[String(profile?.activity_level || '').toLowerCase()] || 1.55);
  const calories = Math.round(tdee * (GOAL_ADJUST[String(profile?.goal || '').toLowerCase()] || 1));
  return { calories, protein: Math.round(calories * MACRO_TARGETS.protein / 4), carbs: Math.round(calories * MACRO_TARGETS.carbs / 4), fats: Math.round(calories * MACRO_TARGETS.fats / 9), bmr, tdee };
}
export function nutritionProfile(profile = {}) {
  return Object.fromEntries(['age', 'sex', 'height_cm', 'weight_kg', 'activity_level', 'goal', 'dietary_restrictions', 'medical_conditions', 'allergies'].filter(k => profile?.[k] !== undefined).map(k => [k, profile[k]]));
}
export function mealForAi(meal = {}) {
  return Object.fromEntries(['id', 'name', 'type', 'servings', 'kcal', 'protein', 'carbs', 'fats', 'ingredients'].filter(k => meal[k] !== undefined).map(k => [k, meal[k]]));
}
export function normalizePortionResult(payload, meal, profile, mealCount = 4) {
  const count = Number(mealCount);
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new Error('Invalid meal count.');
  const scale = Number(payload?.scaleFactor);
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 2) throw new Error('Invalid portion scale.');
  const daily = computeDailyTargets(profile);
  const original = Object.fromEntries(['protein', 'carbs', 'fats'].map(k => [k, Number(meal[k]) || 0]));
  const originalKcal = Number(meal.kcal);
  if (!Number.isFinite(originalKcal) || originalKcal <= 0) throw new Error('Meal calories are unavailable.');
  return { ...payload, scaleFactor: scale, daily, original, originalKcal, optimizedKcal: Math.round(originalKcal * scale), optimized: Object.fromEntries(Object.entries(original).map(([k, v]) => [k, Math.round(v * scale)])), perMealKcal: Math.round(daily.calories / count), targets: Object.fromEntries(['calories', 'protein', 'carbs', 'fats'].map(k => [k, Math.round(daily[k] / count)])) };
}
