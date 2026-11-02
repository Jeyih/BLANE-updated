import { singleDishRecipeRows, singleDishIngredientRows, singleDishStepRows } from '../lib/single-dish-catalogue.js';
import { weekStartKey } from '../lib/meal-calendar.js';
import { readWeekPlan } from '../lib/week-plans.js';
import { loadConstraintDefinitions, canSelectRecipe, getActiveConstraints } from '../lib/constraints';
import ClinicalReviewNotice from './ClinicalReviewNotice';
import { recommendRecipes } from '../lib/recommendations.js';
import { localMealStorage as localStorage, sessionMealStorage as sessionStorage } from '../lib/account-storage.js';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useIngredientPrices } from '../context/PriceContext';
import {
  applyDynamicRecipePrices,
  formatEstimatedPrice as formatPrice,
  pricingLabel,
} from '../lib/pricing';
import {
  addMealForToday,
  currentMealType,
  mealScheduleForDay,
  DEFAULT_SLOTS,
} from '../lib/meal-experience';
import useMealClock from '../hooks/useMealClock';
import PriceEstimateNotice from './PriceEstimateNotice';
import '../styles/meal-experience.css';
import '../styles/recommend.css';
import { isProfileComplete } from '../lib/profile-readiness';
import { MEAL_REVIEWS_KEY, readMealReview, mealReviewKey, aiReviewBlocksMeal } from '../lib/meal-review';
import { subscribeAccountStorage } from '../lib/account-storage';
import { getMealExplanation } from './WhyButton';
async function loadRecommendationData() {
  const definitions = await loadConstraintDefinitions();
  const { data: goalData, error: goalErr } = await supabase.from('goal_ideals').select('*');
  if (goalErr) {
    console.error('Failed to load goal ideals:', goalErr);
    return { ready: false, goalIdeals: {}, definitions: {} };
  }
  const goalIdeals = Object.fromEntries(
    (goalData || [])
      .filter((row) => row.goal_key)
      .map((row) => [
        row.goal_key,
        {
          minProtein: row.min_protein ?? 0,
          maxKcal: row.max_kcal ?? 9999,
          maxFats: row.max_fats ?? 9999,
          minCarbs: row.min_carbs ?? 0,
        },
      ]),
  );
  return {
    ready: Boolean(definitions) && Object.keys(goalIdeals).length > 0,
    goalIdeals,
    definitions: definitions || {},
  };
}
function RecommendWidget({ profile }) {
  const now = useMealClock();
  let schedule = DEFAULT_SLOTS;
  try {
    const plan = readWeekPlan(localStorage, weekStartKey(now), now) || {};
    schedule = mealScheduleForDay(plan, now);
  } catch {}
  const mealType = currentMealType(now, schedule);
  const mealCount = schedule.length;
  const [metadataReady, setMetadataReady] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [goalIdeals, setGoalIdeals] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedRecipes, setRecipes] = useState([]);
  const [recipeError, setRecipeError] = useState('');
  const [definitions, setDefinitions] = useState({});
  const [reviewRevision, setReviewRevision] = useState(0);
  const [pendingReviews, setPendingReviews] = useState([]);
  useEffect(() => subscribeAccountStorage(event => {
    if (event.key === MEAL_REVIEWS_KEY) setReviewRevision(v => v + 1);
  }), []);
  const { records, referenceData } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, records, referenceData || {}),
    [savedRecipes, records, referenceData],
  );
  const recommendation = useMemo(
    () => recommendRecipes(profile, recipes, mealType, goalIdeals, definitions, metadataReady, mealCount),
    [profile, recipes, mealType, goalIdeals, definitions, metadataReady, mealCount, reviewRevision],
  );
  const visibleTop3 = recommendation.items;
  // Review only the initial top three, sharing WhyButton's deduplicated requests.
  // Backfilled alternatives keep their rule-only status until separately reviewed.
  const reviewBatch = recommendRecipes(profile, recipes, mealType, goalIdeals, definitions, metadataReady, mealCount, () => null).items;
  const reviewBatchKey = JSON.stringify(reviewBatch.map(item => mealReviewKey(item.recipe, profile)));
  useEffect(() => {
    let active = true;
    const pending = reviewBatch.filter(item => !readMealReview(item.recipe, profile));
    setPendingReviews(pending.map(item => mealReviewKey(item.recipe, profile)));
    pending.forEach(item => {
      const key = mealReviewKey(item.recipe, profile);
      getMealExplanation(item.recipe, profile).catch(() => {
        // Quota/network failures retain local checks rather than implying AI approval.
      }).finally(() => {
        if (active) {
          setPendingReviews(keys => keys.filter(k => k !== key));
          setReviewRevision(v => v + 1);
        }
      });
    });
    return () => { active = false; };
  }, [reviewBatchKey]);
  useEffect(() => {
    let cancelled = false;
    async function loadRecipes() {
      setLoading(true);
      const { data: recipesData, error: recipesErr } = await supabase
        .from('recipes')
        .select('*')
        .order('name');
      if (cancelled) return;
      if (recipesErr) {
        console.error('Failed to load recommended recipes:', recipesErr.message);
        setRecipeError('Recipes could not be loaded. Please reload to try again.');
        setRecipes([]);
        setLoading(false);
        return;
      }
      const [ingredientResult, stepResult] = await Promise.all([
        supabase.from('recipe_ingredients').select('*').order('sort_order'),
        supabase.from('recipe_steps').select('*').order('step_order'),
      ]);
      const { data: ingData, error: ingErr } = ingredientResult;
      if (cancelled) return;
      if (ingErr || stepResult.error) {
        console.error('Failed to load recipe details:', (ingErr || stepResult.error).message);
        setRecipeError('Recipes could not be loaded. Please reload to try again.');
        setRecipes([]);
        setLoading(false);
        return;
      }
      const ingByRecipe = {};
      singleDishIngredientRows(ingData).forEach((ing) => {
        if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
        ingByRecipe[ing.recipe_id].push({
          id: ing.id,
          name: ing.name || ing.ingredient_name || ing.food_name,
          qty: ing.quantity ?? ing.qty,
          grams: ing.grams,
        });
      });
      const stepsByRecipe = {};
      singleDishStepRows(stepResult.data).forEach((step) => {
        if (!stepsByRecipe[step.recipe_id]) stepsByRecipe[step.recipe_id] = [];
        stepsByRecipe[step.recipe_id].push({ title: step.title, desc: step.description });
      });
      setRecipes(
        singleDishRecipeRows(recipesData).map((r) => ({
          id: r.id,
          emoji: r.emoji,
          name: r.name,
          type: r.type,
          diet: r.diet_tags || [],
          goal: r.goal_tags || [],
          kcal: r.kcal,
          cost: r.cost,
          servings: r.servings || 1,
          protein: r.protein_g,
          carbs: r.carbs_g,
          fats: r.fats_g,
          ingredients: ingByRecipe[r.id] || [],
          steps: stepsByRecipe[r.id] || [],
        })),
      );
      setLoading(false);
    }
    loadRecipes().catch(() => {
      if (!cancelled) {
        setRecipeError('Recipes could not be loaded. Please reload to try again.');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function prepareMetadata() {
      const metadata = await loadRecommendationData();
      if (!cancelled) {
        setMetadataReady(metadata.ready);
        setGoalIdeals(metadata.goalIdeals);
        setDefinitions(metadata.definitions);
        if (!metadata.ready)
          setMetadataError(
            'Recommendation rules could not be loaded. Please reload before requesting meal recommendations.',
          );
      }
    }
    prepareMetadata().catch(() => {
      if (!cancelled) setMetadataError('Recommendation rules could not be loaded. Please reload to try again.');
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return React.createElement(
    'div',
    { className: 'rec-widget col-12', 'data-dashboard-tour': 'recommendations' },
    React.createElement(
      'div',
      { className: 'rec-header' },
      React.createElement(
        'div',
        { className: 'rec-header-left' },
        React.createElement('div', { className: 'rec-header-icon' }, '\u2B50'),
        React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { className: 'rec-header-title' },
            recommendation.status === 'other-periods'
              ? `Meal ideas for ${mealType} now`
              : `Recommended for ${mealType} now`,
          ),
          React.createElement(
            'div',
            { className: 'rec-header-sub' },
            recommendation.status === 'other-periods'
              ? 'Alternative recipes \xB7 Use for your current meal'
              : 'Ready for this time of day \xB7 Use a meal in one tap',
          ),
        ),
      ),
      React.createElement(
        Link,
        { to: '/recipes', className: 'rec-view-all-btn' },
        'View all recipes \u2192',
      ),
    ),
    !loading && !metadataError && !recipeError && recommendation.status === 'other-periods' &&
      React.createElement('p', { className: 'meal-action-status', role: 'status' },
        `No ${mealType.toLowerCase()}-tagged recipes match your dietary checks. You can use these alternatives for ${mealType.toLowerCase()}.`),
    React.createElement(PriceEstimateNotice, null),
    metadataReady && React.createElement(ClinicalReviewNotice, { active: getActiveConstraints(profile, definitions) }),
    actionMessage &&
      React.createElement('p', { className: 'meal-action-status', role: 'status' }, actionMessage),
    !isProfileComplete(profile)
      ? profile?.sex === 'prefer_not_to_say'
        ? React.createElement('p', { className: 'rec-no-profile' }, 'Calorie-based recommendations are off because you chose not to share biological sex. You can still ', React.createElement(Link, { to: '/recipes' }, 'browse recipes'), ' and plan meals manually.')
        : React.createElement('p', { className: 'rec-no-profile' }, 'Update your ', React.createElement(Link, { to: '/profile' }, 'health profile'), ' before receiving personalized recommendations.')
      : metadataError || recipeError
      ? React.createElement('p', { className: 'meal-action-status', role: 'status' }, metadataError || recipeError)
      : loading || !metadataReady
        ? React.createElement(SkeletonLoader, null)
        : !profile?.goal && !profile?.height_cm
          ? React.createElement(
              'div',
              { className: 'rec-no-profile' },
              React.createElement('span', { className: 'rec-no-profile-icon' }, '\u{1F37D}\uFE0F'),
              React.createElement(
                'p',
                null,
                'Complete your ',
                React.createElement(Link, { to: '/onboarding' }, 'health profile'),
                ' to receive personalised recipe recommendations.',
              ),
            )
          : React.createElement(
              'div',
              { className: 'rec-cards-grid' },
              visibleTop3.map((item, i) =>
                React.createElement(RecCard, {
                  key: item.recipe.id,
                  item,
                  rank: i,
                  mealType,
                  reviewing: pendingReviews.includes(mealReviewKey(item.recipe, profile)),
                  onUse: () => {
                    try {
                      if (pendingReviews.includes(mealReviewKey(item.recipe, profile))) return;
                      if (!canSelectRecipe(item.recipe, profile, definitions, metadataReady) || aiReviewBlocksMeal(readMealReview(item.recipe, profile))) { setActionMessage('This recipe has a dietary warning and cannot be selected.'); return; }
                      addMealForToday(item.recipe, { type: mealType });
                      setActionMessage(
                        `Added ${item.recipe.name} to today's ${mealType.toLowerCase()}.`,
                      );
                    } catch {
                      setActionMessage('Could not save the meal. Please try again.');
                    }
                  },
                }),
              ),
              !visibleTop3.length &&
                React.createElement(
                  'p',
                  null,
                  recommendation.status === 'unsupported-restrictions'
                    ? 'A saved restriction has no matching rule yet, so recommendations are paused. Review your profile or browse recipe details. '
                    : recommendation.status === 'empty-catalogue'
                      ? 'No recipes are available in the catalogue yet. '
                      : recommendation.status === 'rules-unavailable'
                        ? 'The nutrition ranking rules are unavailable. Please reload to try again. '
                        : 'No recipes currently pass all your saved dietary checks. Review your profile or browse recipe details. ',
                  React.createElement(Link, { to: '/recipes' }, 'Browse recipes'),
                  '.',
                ),
            ),
  );
}
function RecCard({ item, rank, mealType, onUse, reviewing = false }) {
  const ranks = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  const colors = ['#2ddc7a', '#60a5fa', '#a78bfa'];
  const color = item.allergyHit ? '#f87171' : item.violations > 0 ? '#fbbf24' : colors[rank];
  const pct = Math.min(Math.round((item.score / 70) * 100), 100);
  const circumf = 2 * Math.PI * 13;
  const arcFill = (pct / 100) * circumf;
  const recipe = item.recipe;
  return React.createElement(
    'div',
    { className: 'rec-card-shell' },
    React.createElement(
      Link,
      {
        to: `/recipes?recipe=${encodeURIComponent(recipe.id)}`,
        className: 'rec-card',
        style: { position: 'relative' },
      },
      React.createElement(
        'div',
        { className: 'rec-card-banner' },
        recipe.emoji || '\u{1F372}',
        React.createElement('span', { className: 'rec-card-rank' }, ranks[rank]),
        React.createElement('span', { className: 'rec-card-type-tag', title: 'Original recipe category' }, `${recipe.type} recipe`),
      ),
      React.createElement(
        'div',
        { className: 'rec-card-body' },
        React.createElement('div', { className: 'rec-card-name' }, recipe.name),
        React.createElement(
          'div',
          { className: 'rec-score-row' },
          React.createElement(
            'div',
            { className: 'rec-score-ring' },
            React.createElement(
              'svg',
              { viewBox: '0 0 36 36', width: '36', height: '36' },
              React.createElement('circle', {
                cx: '18',
                cy: '18',
                r: '13',
                fill: 'none',
                stroke: '#111f16',
                strokeWidth: '4',
              }),
              React.createElement('circle', {
                cx: '18',
                cy: '18',
                r: '13',
                fill: 'none',
                stroke: color,
                strokeWidth: '4',
                strokeDasharray: arcFill.toFixed(1) + ' ' + circumf.toFixed(1),
                strokeLinecap: 'round',
                transform: 'rotate(-90 18 18)',
              }),
            ),
            React.createElement('div', { className: 'rec-score-center', style: { color } }, pct),
          ),
          React.createElement(
            'div',
            { className: 'rec-score-info' },
            React.createElement('div', { className: 'rec-score-label' }, 'Match Score'),
            React.createElement(
              'div',
              { className: 'rec-score-bar-bg' },
              React.createElement('div', {
                className: 'rec-score-bar-fill',
                style: { width: pct + '%', background: color },
              }),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'rec-stats' },
          React.createElement(
            'span',
            { className: 'rec-stat-chip' },
            React.createElement('b', null, recipe.kcal),
            ' kcal',
          ),
          React.createElement(
            'span',
            { className: 'rec-stat-chip' },
            React.createElement('b', null, recipe.protein, 'g'),
            ' P',
          ),
        ),
        React.createElement(
          'div',
          { className: 'rec-price', title: pricingLabel(recipe) },
          React.createElement('span', { className: 'rec-price-value' }, formatPrice(recipe.cost)),
          React.createElement('span', { className: 'rec-price-note' }, pricingLabel(recipe)),
        ),
        React.createElement('div', { className: 'rec-reason' }, item.reason),
      ),
    ),
    React.createElement(
      'div',
      { className: 'rec-card-actions' },
      React.createElement(
        'button',
        { className: 'quick-meal-action', type: 'button', onClick: onUse, disabled: reviewing },
        reviewing ? 'Reviewing meal…' : "Use for today's " + mealType.toLowerCase(),
      ),
    ),
  );
}
function SkeletonLoader() {
  const card = React.createElement(
    'div',
    { className: 'rec-skeleton-card' },
    React.createElement('div', { className: 'rec-skeleton-banner' }),
    React.createElement(
      'div',
      { className: 'rec-skeleton-body' },
      React.createElement('div', { className: 'rec-skeleton-line', style: { width: '80%' } }),
      React.createElement('div', { className: 'rec-skeleton-line', style: { width: '55%' } }),
      React.createElement('div', {
        className: 'rec-skeleton-line',
        style: { width: '90%', marginTop: '4px' },
      }),
    ),
  );
  return React.createElement('div', { className: 'rec-loading' }, card, card, card);
}
export { RecommendWidget as default };
