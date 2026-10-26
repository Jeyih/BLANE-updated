import { mealForAi, nutritionProfile } from '../../supabase/functions/_shared/nutrition.js';

export function mealReviewKey(meal, profile, violations = []) {
  return JSON.stringify({ meal: mealForAi(meal), profile: nutritionProfile(profile), violations });
}

export function mealReviewBadge(violations = [], aiVerdict) {
  if (violations.length) return null; // Recorded conflicts retain their existing labels.
  if (aiVerdict?.verdict === 'avoid') return { className: 'medical', text: 'AI: Avoid · Review meal' };
  if (aiVerdict?.verdict === 'caution') return { className: 'medical', text: 'AI: Caution · Review meal' };
  return { className: 'review', text: 'Rule check only · Review suitability' };
}
