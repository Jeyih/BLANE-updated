import { mealForAi, nutritionProfile } from '../../supabase/functions/_shared/nutrition.js';
import { localMealStorage, readStoredJson } from './account-storage.js';

export const MEAL_REVIEWS_KEY = 'blane_meal_reviews_v1';
const MAX_REVIEW_AGE = 24 * 60 * 60 * 1000;

export function mealReviewKey(meal, profile, violations = []) {
  const food = mealForAi(meal);
  // Price refreshes and page-specific ingredient decorations do not change suitability.
  food.ingredients = (food.ingredients || []).map(i => ({
    name: i.name, quantity: i.quantity ?? i.qty ?? '', grams: Number(i.grams) || 0,
  }));
  return JSON.stringify({ meal: food, profile: nutritionProfile(profile), violations });
}

export function readMealReview(meal, profile, violations = [], storage = localMealStorage, now = Date.now()) {
  const entry = readStoredJson(storage, MEAL_REVIEWS_KEY, {})[mealReviewKey(meal, profile, violations)];
  return entry && Number.isFinite(entry.savedAt) && now >= entry.savedAt && now - entry.savedAt < MAX_REVIEW_AGE
    && ['safe', 'caution', 'avoid'].includes(entry.verdict?.verdict) ? entry.verdict : null;
}

export function storeMealReview(meal, profile, violations, verdict, storage = localMealStorage, now = Date.now()) {
  if (!['safe', 'caution', 'avoid'].includes(verdict?.verdict)) return;
  const entries = readStoredJson(storage, MEAL_REVIEWS_KEY, {});
  entries[mealReviewKey(meal, profile, violations)] = { verdict, savedAt: now };
  const recent = Object.entries(entries).filter(([, e]) => now >= e.savedAt && now - e.savedAt < MAX_REVIEW_AGE)
    .sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 100);
  try { storage.setItem(MEAL_REVIEWS_KEY, JSON.stringify(Object.fromEntries(recent))); } catch {}
}

export function aiReviewBlocksMeal(verdict) { return verdict?.verdict === 'avoid'; }

export function mealReviewBadge(violations = [], aiVerdict) {
  if (violations.length) return null; // Recorded conflicts retain their existing labels.
  if (aiVerdict?.verdict === 'avoid') return { className: 'medical', text: 'AI: Avoid · Review meal' };
  if (aiVerdict?.verdict === 'caution') return { className: 'medical', text: 'AI: Caution · Review meal' };
  return { className: 'review', text: 'Rule check only · Review suitability' };
}
