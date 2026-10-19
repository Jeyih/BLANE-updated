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
const CONSTRAINT_BLOCKS = {};
const ALLERGY_KEYS = [];
const GOAL_IDEALS = { maintain: { minProtein: 15, maxKcal: 550, maxFats: 25, minCarbs: 20 } };
async function loadRecommendationData() {
  const { data: constraintData, error: constraintErr } = await supabase
    .from('constraint_definitions')
    .select('*')
    .order('sort_order');
  if (constraintErr) {
    console.error('Failed to load recommendation constraints:', constraintErr);
  } else {
    Object.keys(CONSTRAINT_BLOCKS).forEach((key) => delete CONSTRAINT_BLOCKS[key]);
    ALLERGY_KEYS.length = 0;
    (constraintData || []).forEach((row) => {
      if (row.active === false || !row.key) return;
      const blocked = Array.isArray(row.blocked)
        ? row.blocked.map((item) => item.trim()).filter(Boolean)
        : typeof row.blocked === 'string'
          ? row.blocked
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [];
      CONSTRAINT_BLOCKS[row.key] = blocked;
      if (row.severity === 'allergy') ALLERGY_KEYS.push(row.key);
    });
  }
  const { data: goalData, error: goalErr } = await supabase.from('goal_ideals').select('*');
  if (goalErr) {
    console.error('Failed to load goal ideals:', goalErr);
  } else {
    Object.keys(GOAL_IDEALS).forEach((key) => {
      if (key !== 'maintain') delete GOAL_IDEALS[key];
    });
    (goalData || []).forEach((row) => {
      if (!row.goal_key) return;
      GOAL_IDEALS[row.goal_key] = {
        minProtein: row.min_protein || 0,
        maxKcal: row.max_kcal || 9999,
        maxFats: row.max_fats || 9999,
        minCarbs: row.min_carbs || 0,
      };
    });
  }
  return !constraintErr && !goalErr;
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
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedRecipes, setRecipes] = useState([]);
  const { records } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, records),
    [savedRecipes, records],
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
      const ready = await loadRecommendationData();
      if (!cancelled) {
        setMetadataReady(ready);
        if (!ready)
          setMetadataError(
            'Your dietary preferences could not be checked. Please reload to get meal recommendations.',
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
        ),
      );
      setLoading(false);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile, recipes, mealType, metadataReady]);
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
function scoreAndRankRecipes(profile, recipes) {
  const goal = profile.goal || 'maintain';
  const dietary = profile.dietary_restrictions || [];
  const medical = profile.medical_conditions || [];
  const allergies = profile.allergies || [];
  const allConstraints = [...dietary, ...medical, ...allergies];
  const ideals = GOAL_IDEALS[goal] || GOAL_IDEALS.maintain;
  const dailyTarget = computeDailyTarget(profile);
  const perMealKcal = Math.round(dailyTarget / 4);
  const scored = (recipes || []).map((recipe) => {
    let score = 0;
    let goalScore = 0;
    if (recipe.goal?.includes(goal)) goalScore += 20;
    if (recipe.protein >= ideals.minProtein) goalScore += 8;
    if (recipe.kcal <= ideals.maxKcal) goalScore += 6;
    if (recipe.fats <= ideals.maxFats) goalScore += 3;
    if (recipe.carbs >= ideals.minCarbs) goalScore += 3;
    score += Math.min(40, goalScore);
    let violations = 0,
      allergyHit = false;
    allConstraints.forEach((key) => {
      const blocked = CONSTRAINT_BLOCKS[key] || [];
      const isAllergy = ALLERGY_KEYS.includes(key);
      recipe.ingredients.forEach((ing) => {
        const ingLower = ing.name.toLowerCase();
        blocked.forEach((b) => {
          if (ingLower.includes(b) || b.includes(ingLower.split(' ')[0])) {
            violations++;
            if (isAllergy) allergyHit = true;
          }
        });
      });
    });
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
function generateReason(recipe, goal, violations, perMealKcal, profile) {
  if (
    violations > 0 &&
    ALLERGY_KEYS.some(
      (k) =>
        (profile.dietary_restrictions || []).includes(k) ||
        (profile.medical_conditions || []).includes(k) ||
        (profile.allergies || []).includes(k),
    )
  ) {
    return 'Flagged \u2014 contains an ingredient that may conflict with your allergy profile.';
  }
  if (goal === 'lose_weight') {
    if (recipe.kcal <= 350 && recipe.protein >= 20) {
      return (
        'High-protein at only ' +
        recipe.kcal +
        ' kcal \u2014 ideal for staying in a calorie deficit while preserving muscle.'
      );
    }
    return (
      'At ' +
      recipe.kcal +
      ' kcal with ' +
      recipe.protein +
      'g protein, this supports your weight loss goal with good satiety.'
    );
  }
  if (goal === 'gain_muscle') {
    if (recipe.protein >= 30)
      return (
        recipe.protein +
        'g protein directly fuels muscle protein synthesis \u2014 a top pick for your muscle gain goal.'
      );
    return (
      'Solid ' +
      recipe.protein +
      'g protein and ' +
      recipe.carbs +
      'g carbs for energy \u2014 supports your muscle-building plan.'
    );
  }
  if (goal === 'improve_health') {
    return (
      'Nutrient-dense Filipino ingredients with ' +
      recipe.protein +
      'g protein and only ' +
      recipe.fats +
      'g fat \u2014 great for overall wellness.'
    );
  }
  if (goal === 'boost_energy') {
    return (
      recipe.carbs + 'g of complex carbohydrates gives you sustained energy throughout the day.'
    );
  }
  if (goal === 'manage_condition') {
    return (
      'Low in fat (' +
      recipe.fats +
      'g) and moderate calories (' +
      recipe.kcal +
      ' kcal) \u2014 suitable for condition management.'
    );
  }
  const diff = Math.abs(recipe.kcal - perMealKcal);
  if (diff <= 80)
    return (
      'Nearly matches your per-meal calorie target of ' +
      perMealKcal +
      ' kcal \u2014 a well-balanced choice.'
    );
  return (
    'Balanced macros with ' +
    recipe.protein +
    'g protein, ' +
    recipe.carbs +
    'g carbs, and ' +
    recipe.fats +
    'g fat \u2014 fits your maintenance plan.'
  );
}
function computeDailyTarget(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * 1.55;
  const adj = {
    lose_weight: 0.85,
    gain_muscle: 1.1,
    maintain: 1,
    improve_health: 1,
    boost_energy: 1,
    manage_condition: 0.9,
  };
  return Math.round(tdee * (adj[profile.goal] || 1));
}
export { RecommendWidget as default };
