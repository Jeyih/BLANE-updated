import { loadConstraintDefinitions, CB_CONSTRAINTS, canSelectRecipe } from '../lib/constraints';
import { asList } from '../lib/constraint-rules.js';
import { localMealStorage as localStorage, sessionMealStorage as sessionStorage } from '../lib/account-storage.js';
import { computeDailyTargets } from '../../supabase/functions/_shared/nutrition.js';
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
  philippineClock,
  DEFAULT_SLOTS,
} from '../lib/meal-experience';
import useMealClock from '../hooks/useMealClock';
import PriceEstimateNotice from './PriceEstimateNotice';
import '../styles/meal-experience.css';
import '../styles/recommend.css';
async function loadRecommendationData() {
  const definitions = await loadConstraintDefinitions();
  const { data: goalData, error: goalErr } = await supabase.from('goal_ideals').select('*');
  if (goalErr) {
    console.error('Failed to load goal ideals:', goalErr);
    return { ready: false, goalIdeals: {} };
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
  };
}
function RecommendWidget({ profile }) {
  const now = useMealClock();
  let schedule = DEFAULT_SLOTS;
  try {
    const plan = JSON.parse(localStorage.getItem('blane_meal_plan') || '{}');
    schedule = plan[philippineClock(now).dayIndex]?.length
      ? plan[philippineClock(now).dayIndex]
      : DEFAULT_SLOTS;
  } catch {}
  const mealType = currentMealType(now, schedule);
  const [metadataReady, setMetadataReady] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [goalIdeals, setGoalIdeals] = useState({});
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedRecipes, setRecipes] = useState([]);
  const { records, referenceData } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, records, referenceData || {}),
    [savedRecipes, records, referenceData],
  );
  const [top3, setTop3] = useState([]);
  const matchesMealType = (recipe) =>
    recipe.type === mealType ||
    (mealType === 'Brunch' && recipe.type === 'Breakfast') ||
    (mealType === 'Dessert' && recipe.type === 'Snack');
  const visibleTop3 = top3.filter((item) => matchesMealType(item.recipe));
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
        setRecipes([]);
        setLoading(false);
        return;
      }
      const { data: ingData, error: ingErr } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .order('sort_order');
      if (cancelled) return;
      if (ingErr) {
        console.error('Failed to load recipe ingredients:', ingErr.message);
        setRecipes([]);
        setLoading(false);
        return;
      }
      const ingByRecipe = {};
      (ingData || []).forEach((ing) => {
        if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
        ingByRecipe[ing.recipe_id].push({
          name: ing.name || ing.ingredient_name || ing.food_name,
          qty: ing.quantity ?? ing.qty,
          grams: ing.grams,
        });
      });
      setRecipes(
        (recipesData || []).map((r) => ({
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
        })),
      );
      setLoading(false);
    }
    loadRecipes();
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
        if (!metadata.ready)
          setMetadataError(
            'Recommendation rules could not be loaded. Please reload before requesting meal recommendations.',
          );
      }
    }
    prepareMetadata();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!metadataReady || !profile || recipes.length === 0) {
      setTop3([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      setTop3(
        scoreAndRankRecipes(
          profile,
          recipes.filter(
            (recipe) =>
              recipe.type === mealType ||
              (mealType === 'Brunch' && recipe.type === 'Breakfast') ||
              (mealType === 'Dessert' && recipe.type === 'Snack'),
          ),
          goalIdeals,
        ),
      );
      setLoading(false);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile, recipes, mealType, metadataReady, goalIdeals]);
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
            'Recommended for ',
            mealType,
            ' now',
          ),
          React.createElement(
            'div',
            { className: 'rec-header-sub' },
            'Ready for this time of day \xB7 Use a meal in one tap',
          ),
        ),
      ),
      React.createElement(
        Link,
        { to: '/recipes', className: 'rec-view-all-btn' },
        'View all recipes \u2192',
      ),
    ),
    React.createElement(PriceEstimateNotice, null),
    actionMessage &&
      React.createElement('p', { className: 'meal-action-status', role: 'status' }, actionMessage),
    metadataError
      ? React.createElement('p', { className: 'meal-action-status' }, metadataError)
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
                  onUse: () => {
                    try {
                      if (!canSelectRecipe(item.recipe, profile, CB_CONSTRAINTS, metadataReady)) { setActionMessage('This recipe cannot be selected with the available dietary rules.'); return; }
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
                  'No recipe matches your preferences for this meal. ',
                  React.createElement(Link, { to: '/recipes' }, 'Browse recipes'),
                  '.',
                ),
            ),
  );
}
function RecCard({ item, rank, mealType, onUse }) {
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
        React.createElement('span', { className: 'rec-card-type-tag' }, recipe.type),
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
        { className: 'quick-meal-action', type: 'button', onClick: onUse },
        "Use for today's ",
        mealType.toLowerCase(),
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
function scoreAndRankRecipes(profile, recipes, goalIdeals) {
  const goal = profile.goal || 'maintain';
  const dietary = asList(profile.dietary_restrictions);
  const medical = asList(profile.medical_conditions);
  const allergies = asList(profile.allergies);
  const allConstraints = [...dietary, ...medical, ...allergies];
  const ideals = goalIdeals[goal] || goalIdeals.maintain;
  if (!ideals) return [];
  const dailyTarget = computeDailyTarget(profile);
  const perMealKcal = Math.round(dailyTarget / 4);
  const scored = (recipes || []).filter(recipe => canSelectRecipe(recipe, profile, CB_CONSTRAINTS)).map((recipe) => {
    let score = 0;
    let goalScore = 0;
    if (recipe.goal?.includes(goal)) goalScore += 20;
    if (recipe.protein >= ideals.minProtein) goalScore += 8;
    if (recipe.kcal <= ideals.maxKcal) goalScore += 6;
    if (recipe.fats <= ideals.maxFats) goalScore += 3;
    if (recipe.carbs >= ideals.minCarbs) goalScore += 3;
    score += Math.min(40, goalScore);
    const violations = 0, allergyHit = false;
    if (allergyHit) score -= 30;
    else if (violations > 0) score -= violations * 20;
    const calDiff = Math.abs(recipe.kcal - perMealKcal);
    if (calDiff <= 50) score += 15;
    else if (calDiff <= 120) score += 10;
    else if (calDiff <= 200) score += 5;
    if (violations === 0 && allConstraints.length > 0) score += 10;
    const reason = generateReason(recipe, goal, violations, perMealKcal, profile);
    return { recipe, score: Math.max(0, score), reason, violations, allergyHit };
  });
  scored.sort(
    (a, b) => b.score - a.score || String(a.recipe.id).localeCompare(String(b.recipe.id)),
  );
  return scored.filter((item) => !item.allergyHit && item.violations === 0).slice(0, 3);
}
function generateReason(recipe, goal, violations, perMealKcal) {
  const distance = Math.abs(Number(recipe.kcal) - perMealKcal);
  return `${recipe.kcal} kcal; ${recipe.protein} g protein, ${recipe.carbs} g carbs and ${recipe.fats} g fat. ${distance <= 80 ? 'Close to' : 'Compared with'} the estimated ${perMealKcal} kcal per-meal target. Ranked using your selected goal and loaded ingredient rules.`;
}
function computeDailyTarget(profile) {
  return computeDailyTargets(profile).calories;
}
export { RecommendWidget as default };
