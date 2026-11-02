import { asList, normalized, recipeEligible, unmatchedConstraints } from './constraint-rules.js';
import { computeDailyTargets } from '../../supabase/functions/_shared/nutrition.js';
import { isProfileComplete } from './profile-readiness.js';
import { selectedHealthGoals } from './health-goals.js';
import { readMealReview, aiReviewBlocksMeal } from './meal-review.js';

export function matchesMealType(recipe, mealType) {
  const type = normalized(recipe.type);
  const requested = normalized(mealType);
  return type === requested || (requested === 'brunch' && type === 'breakfast')
    || (requested === 'dessert' && type === 'snack');
}

export function recommendRecipes(profile, recipes, mealType, goalIdeals, definitions, ready, mealCount = 4, review = readMealReview) {
  if (!ready) return { items: [], status: 'rules-unavailable' };
  if (!isProfileComplete(profile)) return { items: [], status: 'profile-incomplete' };
  if (unmatchedConstraints(profile, definitions).length) return { items: [], status: 'unsupported-restrictions' };
  if (!recipes.length) return { items: [], status: 'empty-catalogue' };
  const goal = profile.goal;
  const secondaryGoals = selectedHealthGoals(profile).filter(key => key !== goal);
  const ideals = goalIdeals[goal] || goalIdeals.maintain;
  if (!ideals) return { items: [], status: 'rules-unavailable' };
  const count = Number.isInteger(mealCount) && mealCount > 0 ? mealCount : 4;
  const perMealKcal = Math.round(computeDailyTargets(profile).calories / count);
  const hasConstraints = ['dietary_restrictions', 'medical_conditions', 'allergies'].some(key => asList(profile[key]).length);
  const eligible = recipes.filter(recipe => recipeEligible(recipe, profile, definitions, ready)
    && !aiReviewBlocksMeal(review(recipe, profile, [])));
  const current = eligible.filter(recipe => matchesMealType(recipe, mealType));
  // Preserve each recipe's category; the widget labels alternatives and lets users
  // explicitly assign them to the current meal period.
  const pool = current.length ? current : eligible;
  const items = pool.map(recipe => {
    const secondaryMatches = secondaryGoals.filter(key => asList(recipe.goal).includes(key)).length;
    let goalScore = asList(recipe.goal).includes(goal) ? 20 : 0;
    goalScore += secondaryMatches * 5;
    if (recipe.protein >= ideals.minProtein) goalScore += 8;
    if (recipe.kcal <= ideals.maxKcal) goalScore += 6;
    if (recipe.fats <= ideals.maxFats) goalScore += 3;
    if (recipe.carbs >= ideals.minCarbs) goalScore += 3;
    const distance = Math.abs(Number(recipe.kcal) - perMealKcal);
    const score = Math.min(40, goalScore) + (distance <= 50 ? 15 : distance <= 120 ? 10 : distance <= 200 ? 5 : 0) + (hasConstraints ? 10 : 0);
    return { recipe, score, secondaryMatches, violations: 0, allergyHit: false,
      reason: `${recipe.kcal} kcal; ${recipe.protein} g protein, ${recipe.carbs} g carbs and ${recipe.fats} g fat. ${distance <= 80 ? 'Close to' : 'Compared with'} the estimated ${perMealKcal} kcal per-meal target. Ranked using your selected health goals, primary calorie target and loaded ingredient rules.` };
  }).sort((a, b) => b.score - a.score || b.secondaryMatches - a.secondaryMatches
    || String(a.recipe.id).localeCompare(String(b.recipe.id))).slice(0, 3);
  return { items, status: !eligible.length ? 'no-eligible-recipes' : current.length ? 'ready' : 'other-periods' };
}
