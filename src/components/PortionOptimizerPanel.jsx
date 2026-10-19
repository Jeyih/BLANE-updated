import React from 'react';
import { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import '../styles/optimizer.css';
const OPT_MIN_SCALE = 0.5;
const OPT_MAX_SCALE = 2;
const MACRO_TARGETS = { protein: 0.3, carbs: 0.45, fats: 0.25 };
const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};
const GOAL_ADJUST = {
  lose_weight: 0.85,
  gain_muscle: 1.1,
  maintain: 1,
  improve_health: 1,
  boost_energy: 1,
  manage_condition: 1,
};
function OptimizeButton({ open, onToggle }) {
  return React.createElement(
    'button',
    {
      className: 'meal-action-btn',
      style: { borderColor: 'rgba(96,165,250,0.25)', color: '#60a5fa' },
      onClick: onToggle,
    },
    React.createElement(
      'svg',
      {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      React.createElement('line', { x1: '4', y1: '21', x2: '4', y2: '14' }),
      React.createElement('line', { x1: '4', y1: '10', x2: '4', y2: '3' }),
      React.createElement('line', { x1: '12', y1: '21', x2: '12', y2: '12' }),
      React.createElement('line', { x1: '12', y1: '8', x2: '12', y2: '3' }),
      React.createElement('line', { x1: '20', y1: '21', x2: '20', y2: '16' }),
      React.createElement('line', { x1: '20', y1: '12', x2: '20', y2: '3' }),
      React.createElement('line', { x1: '1', y1: '14', x2: '7', y2: '14' }),
      React.createElement('line', { x1: '9', y1: '8', x2: '15', y2: '8' }),
      React.createElement('line', { x1: '17', y1: '16', x2: '23', y2: '16' }),
    ),
    ' Optimize',
  );
}
function getOptimizeMealUrl() {
  if (!SUPABASE_URL) return null;
  return SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co') + '/optimize-meal';
}
function PortionOptimizerPanel({
  meal,
  profile,
  totalMealsToday,
  open,
  onClose,
  onApplied,
  onOriginalMeal,
}) {
  const [applied, setApplied] = useState(false);
  const [originalRestored, setOriginalRestored] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiMode, setAiMode] = useState('local');
  useEffect(() => {
    if (!open || !meal || !profile || !meal.ingredients) return;
    let cancelled = false;
    const fallbackResult = optimizeMeal(meal, totalMealsToday || 3, profile);
    async function loadAiOptimization() {
      setAiLoading(true);
      setAiError('');
      setAiMode('local');
      setAiResult(fallbackResult);
      try {
        const optimizeUrl = getOptimizeMealUrl();
        if (!optimizeUrl) {
          throw new Error('Supabase function URL is not configured.');
        }
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setAiMode('local');
            setAiError(
              'Sign in to enable Gemini optimization. Using a smart local estimate instead.',
            );
          }
          return;
        }
        const res = await fetch(optimizeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token,
          },
          body: JSON.stringify({ meal, profile, totalMealsToday: totalMealsToday || 3 }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || 'BLANE AI could not optimize this meal.');
        }
        if (!cancelled) {
          setAiResult(payload);
          setAiMode('ai');
          setAiError('');
        }
      } catch (err) {
        console.error('Portion optimizer AI failed:', err);
        if (!cancelled) {
          setAiResult(fallbackResult);
          setAiMode('local');
          setAiError(
            'BLANE AI is temporarily unavailable. Showing the smart local estimate instead.',
          );
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }
    loadAiOptimization();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    meal?.id,
    profile?.height_cm,
    profile?.weight_kg,
    profile?.goal,
    profile?.activity_level,
    totalMealsToday,
  ]);
  if (!open) return null;
  if (!profile?.height_cm) {
    return React.createElement(
      'div',
      { className: 'opt-panel open' },
      React.createElement(
        'div',
        { className: 'opt-inner' },
        React.createElement(
          'p',
          { style: { fontSize: 13, color: '#4d6e5a', textAlign: 'center', padding: '20px 0' } },
          '\u26A0\uFE0F Complete your health profile first to enable portion optimization.',
        ),
      ),
    );
  }
  const result = aiResult || optimizeMeal(meal, totalMealsToday || 3, profile);
  const scaleClass = result.scaleFactor > 1.05 ? 'over' : result.scaleFactor < 0.95 ? 'under' : '';
  const scaleLabel =
    result.scaleFactor > 1.05
      ? '\u2191 ' + result.scaleFactor.toFixed(2) + '\xD7 Increase'
      : result.scaleFactor < 0.95
        ? '\u2193 ' + result.scaleFactor.toFixed(2) + '\xD7 Decrease'
        : '\u2192 ' + result.scaleFactor.toFixed(2) + '\xD7 (Optimal)';
  const pBar = (val, target) => Math.min(Math.round((val / target) * 100), 120);
  function handleApply() {
    const saved = JSON.parse(sessionStorage.getItem('blane_optimized_v2') || '{}');
    saved[meal.id] = {
      scaleFactor: result.scaleFactor,
      ingredients: result.ingredients,
      optimizedKcal: result.optimizedKcal,
      appliedAt: new Date().toISOString(),
    };
    sessionStorage.setItem('blane_optimized_v2', JSON.stringify(saved));
    setApplied(true);
    setOriginalRestored(false);
    onApplied?.(meal.id, result);
  }
  function handleOriginalMeal() {
    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem('blane_optimized_v2') || '{}');
    } catch {
      saved = {};
    }
    delete saved[meal.id];
    sessionStorage.setItem('blane_optimized_v2', JSON.stringify(saved));
    setApplied(false);
    setOriginalRestored(true);
    onOriginalMeal?.(meal.id);
  }
  return React.createElement(
    'div',
    { className: 'opt-panel open' + (aiMode === 'ai' ? ' opt-panel-ai' : '') },
    React.createElement(
      'div',
      { className: 'opt-inner' },
      React.createElement(
        'div',
        { className: 'opt-header' },
        React.createElement(
          'div',
          { className: 'opt-header-left' },
          React.createElement(
            'div',
            { className: 'opt-icon' + (aiMode === 'ai' ? ' ai' : '') },
            aiMode === 'ai'
              ? React.createElement(
                  'svg',
                  { viewBox: '0 0 24 24', fill: 'currentColor', width: '17', height: '17' },
                  React.createElement('path', {
                    d: 'M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z',
                  }),
                )
              : '\u2696\uFE0F',
          ),
          React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { className: 'opt-title' },
              'AI Portion Optimizer \u2014 ',
              meal.name,
            ),
            React.createElement(
              'div',
              { className: 'opt-sub' },
              'Powered by Gemini \xB7 adjusted for your calorie & macro targets',
            ),
          ),
        ),
        React.createElement(
          'button',
          { className: 'opt-close-btn', onClick: onClose },
          '\u2715 Close',
        ),
      ),
      React.createElement(
        'div',
        { className: 'opt-header-strip' + (aiLoading ? ' opt-header-strip-loading' : '') },
        React.createElement(
          'span',
          { className: 'opt-mode-badge ' + aiMode },
          aiMode === 'ai'
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'svg',
                  {
                    viewBox: '0 0 24 24',
                    fill: 'currentColor',
                    width: '11',
                    height: '11',
                    className: 'opt-mode-badge-spark',
                  },
                  React.createElement('path', {
                    d: 'M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z',
                  }),
                ),
                'Gemini AI',
              )
            : '\u2699 Local estimate',
        ),
        aiLoading &&
          React.createElement(
            'span',
            { className: 'opt-loading-text opt-loading-pulse' },
            React.createElement('span', { className: 'opt-loading-dot' }),
            React.createElement('span', { className: 'opt-loading-dot' }),
            React.createElement('span', { className: 'opt-loading-dot' }),
            'Gemini is analyzing this meal\u2026',
          ),
        !aiLoading &&
          aiError &&
          React.createElement('span', { className: 'opt-warning-text' }, aiError),
      ),
      aiMode === 'ai' &&
        (result.insight || result.explanation || result.reasoning) &&
        React.createElement(
          'div',
          { className: 'opt-ai-insight' },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 24 24',
              fill: 'currentColor',
              width: '14',
              height: '14',
              className: 'opt-ai-insight-spark',
            },
            React.createElement('path', {
              d: 'M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z',
            }),
          ),
          React.createElement(
            'span',
            null,
            result.insight || result.explanation || result.reasoning,
          ),
        ),
      React.createElement(
        'div',
        { className: 'opt-target-row' },
        React.createElement(
          'div',
          { className: 'opt-target-chip' },
          React.createElement('div', { className: 'opt-target-chip-label' }, 'Daily Target'),
          React.createElement(
            'div',
            { className: 'opt-target-chip-value green' },
            result.daily.calories.toLocaleString(),
            ' kcal',
          ),
        ),
        React.createElement('div', { className: 'opt-target-divider' }),
        React.createElement(
          'div',
          { className: 'opt-target-chip' },
          React.createElement('div', { className: 'opt-target-chip-label' }, 'Per-Meal Target'),
          React.createElement(
            'div',
            { className: 'opt-target-chip-value yellow' },
            result.perMealKcal,
            ' kcal',
          ),
        ),
        React.createElement('div', { className: 'opt-target-divider' }),
        React.createElement(
          'div',
          { className: 'opt-target-chip' },
          React.createElement('div', { className: 'opt-target-chip-label' }, 'Original Meal'),
          React.createElement(
            'div',
            { className: 'opt-target-chip-value' },
            result.originalKcal,
            ' kcal',
          ),
        ),
        React.createElement('div', { className: 'opt-target-divider' }),
        React.createElement(
          'div',
          { className: 'opt-target-chip' },
          React.createElement('div', { className: 'opt-target-chip-label' }, 'Optimized Meal'),
          React.createElement(
            'div',
            { className: 'opt-target-chip-value green' },
            result.optimizedKcal,
            ' kcal',
          ),
        ),
        React.createElement('span', { className: 'opt-scale-badge ' + scaleClass }, scaleLabel),
      ),
      React.createElement(
        'div',
        { className: 'opt-section-title' },
        'Ingredient Portions \u2014 Original vs Optimized',
      ),
      React.createElement(
        'div',
        { className: 'opt-ingredient-table-wrap' },
        React.createElement(
          'div',
          { className: 'opt-table-header' },
          React.createElement('span', null, 'Ingredient'),
          React.createElement('span', null, 'Orig Quantity'),
          React.createElement('span', null, 'Opti Quantity'),
          React.createElement('span', null, 'Original (g)'),
          React.createElement('span', null, 'Optimized (g)'),
          React.createElement('span', null, 'Macros'),
        ),
        result.ingredients.map((ing) => {
          const sourceIngredient = meal.ingredients.find((item) => item.name === ing.name);
          const sourceQuantity = sourceIngredient?.quantity;
          const originalGrams = Number(sourceIngredient?.grams) || 0;
          const optimizedGrams = originalGrams
            ? Math.round(originalGrams * result.scaleFactor)
            : null;
          const macroValue = (key) => {
            const ingredientMacro = sourceIngredient?.[key];
            if (ingredientMacro != null && Number.isFinite(Number(ingredientMacro))) {
              return Math.round(Number(ingredientMacro) * result.scaleFactor);
            }
            return Math.round(
              ((Number(meal[key]) || 0) / Math.max(meal.ingredients.length, 1)) *
                result.scaleFactor,
            );
          };
          const changeClass = ing.increased ? 'more' : ing.decreased ? 'less' : 'same';
          const changeTxt = ing.increased
            ? '+' + ((result.scaleFactor - 1) * 100).toFixed(0) + '%'
            : ing.decreased
              ? '-' + ((1 - result.scaleFactor) * 100).toFixed(0) + '%'
              : 'same';
          return React.createElement(
            'div',
            { key: ing.name, className: 'opt-ing-row' },
            React.createElement(
              'div',
              { className: 'opt-ing-name' },
              React.createElement('div', { className: 'opt-ing-dot' }),
              ing.name,
            ),
            React.createElement(
              'div',
              { className: 'opt-ing-quantity opt-ing-quantity-original' },
              sourceQuantity == null || sourceQuantity === '' ? '\u2014' : sourceQuantity,
            ),
            React.createElement(
              'div',
              { className: 'opt-ing-quantity opt-ing-quantity-optimized' },
              ing.optimized || '\u2014',
            ),
            React.createElement(
              'div',
              { className: 'opt-ing-grams' },
              originalGrams ? `${originalGrams} g` : '\u2014',
            ),
            React.createElement(
              'div',
              { className: 'opt-ing-grams' },
              optimizedGrams == null
                ? '\u2014'
                : React.createElement(
                    React.Fragment,
                    null,
                    React.createElement('span', null, optimizedGrams, ' g'),
                    React.createElement(
                      'small',
                      { className: 'opt-ing-opt-change ' + changeClass },
                      changeTxt,
                    ),
                  ),
            ),
            React.createElement(
              'div',
              { className: 'opt-ing-macro' },
              React.createElement(
                'div',
                { className: 'opt-ing-macro-line' },
                'P ',
                React.createElement('b', null, '~', macroValue('protein'), 'g'),
              ),
              React.createElement(
                'div',
                { className: 'opt-ing-macro-line' },
                'C ',
                React.createElement('b', null, '~', macroValue('carbs'), 'g'),
              ),
              React.createElement(
                'div',
                { className: 'opt-ing-macro-line' },
                'F ',
                React.createElement('b', null, '~', macroValue('fats'), 'g'),
              ),
            ),
          );
        }),
      ),
      React.createElement(
        'div',
        { className: 'opt-apply-row' },
        React.createElement(
          'button',
          { className: 'opt-btn opt-btn-primary', onClick: handleApply },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2.5',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            },
            React.createElement('polyline', { points: '20 6 9 17 4 12' }),
          ),
          'Apply to Meal Plan',
        ),
        React.createElement(
          'button',
          { className: 'opt-btn opt-btn-outline', onClick: handleOriginalMeal },
          'Original Meal',
        ),
        applied &&
          React.createElement(
            'span',
            { className: 'opt-applied-badge show' },
            "\u2713 Portions applied to today's plan",
          ),
        originalRestored &&
          React.createElement(
            'span',
            { className: 'opt-applied-badge show' },
            '\u2713 Original meal restored',
          ),
        !applied &&
          aiMode === 'ai' &&
          !aiLoading &&
          React.createElement(
            'span',
            { className: 'opt-ai-footer-note' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24', fill: 'currentColor', width: '11', height: '11' },
              React.createElement('path', {
                d: 'M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z',
              }),
            ),
            'Optimized with Gemini AI',
          ),
      ),
    ),
  );
}
function computeDailyTargets(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * (ACTIVITY_MULT[profile.activity_level] || 1.55);
  const calTarget = Math.round(tdee * (GOAL_ADJUST[profile.goal] || 1));
  return {
    calories: calTarget,
    protein: Math.round((calTarget * MACRO_TARGETS.protein) / 4),
    carbs: Math.round((calTarget * MACRO_TARGETS.carbs) / 4),
    fats: Math.round((calTarget * MACRO_TARGETS.fats) / 9),
  };
}
function optimizeMeal(meal, totalMealsToday, profile) {
  const daily = computeDailyTargets(profile);
  const perMealKcal = Math.round(daily.calories / totalMealsToday);
  const originalKcal = meal.kcal;
  let scaleFactor = perMealKcal / originalKcal;
  scaleFactor = Math.max(OPT_MIN_SCALE, Math.min(OPT_MAX_SCALE, scaleFactor));
  const optimizedKcal = Math.round(originalKcal * scaleFactor);
  const optimizedProtein = Math.round(meal.protein * scaleFactor);
  const optimizedCarbs = Math.round(meal.carbs * scaleFactor);
  const optimizedFats = Math.round(meal.fats * scaleFactor);
  const mealProteinTarget = Math.round(daily.protein / totalMealsToday);
  const mealCarbsTarget = Math.round(daily.carbs / totalMealsToday);
  const mealFatsTarget = Math.round(daily.fats / totalMealsToday);
  const scaledIngredients = meal.ingredients.map((ing) => scaleIngredient(ing, scaleFactor));
  return {
    scaleFactor,
    perMealKcal,
    originalKcal,
    optimizedKcal,
    original: { protein: meal.protein, carbs: meal.carbs, fats: meal.fats },
    optimized: { protein: optimizedProtein, carbs: optimizedCarbs, fats: optimizedFats },
    targets: {
      protein: mealProteinTarget,
      carbs: mealCarbsTarget,
      fats: mealFatsTarget,
      calories: perMealKcal,
    },
    ingredients: scaledIngredients,
    daily,
  };
}
function scaleIngredient(ing, factor) {
  const original = ing.qty;
  const optimized = scaleQtyString(original, factor);
  return {
    name: ing.name,
    status: ing.status,
    original,
    optimized,
    factor,
    changed: Math.abs(factor - 1) > 0.05,
    increased: factor > 1.05,
    decreased: factor < 0.95,
  };
}
function scaleQtyString(qtyStr, factor) {
  if (!qtyStr || qtyStr === 'to taste') return qtyStr;
  const normalizedQty = String(qtyStr).trim();
  const match = normalizedQty.match(
    /^(\s*~?\s*)(?:scant\s+)?(\d+(?:\s+\d+\/\d+|\/\d+)?|[½¼¾⅓⅔])\s*(.*)$/i,
  );
  if (!match) return qtyStr;
  const [, estimatePrefix, amount, unit] = match;
  const num = parseFraction(amount);
  if (isNaN(num) || num === 0) return qtyStr;
  if (factor === 1) return qtyStr;
  const countUnit =
    /\b(?:pc|pcs|piece|pieces|clove|cloves|slice|slices|stalk|stalks|pod|pods|link|links|egg|eggs|banana|tomato|onion|carrot|potato|shrimp|sachet|sachets|can|cans|disc|discs|portion|serving|breast|gourd|fish|squid|puto|saba)\b/i.test(
      unit,
    );
  const denominator = countUnit ? 2 : 4;
  const scaled = Math.max(1 / denominator, Math.round(num * factor * denominator) / denominator);
  const formatted = formatQuantityNumber(scaled, denominator);
  return estimatePrefix + formatted + (unit ? ' ' + unit : '');
}
function parseFraction(str) {
  const fracts = { '\xBD': 0.5, '\xBC': 0.25, '\xBE': 0.75, '\u2153': 0.333, '\u2154': 0.667 };
  if (fracts[str]) return fracts[str];
  if (str.includes(' ')) {
    const [whole, fraction] = str.split(/\s+/, 2);
    return parseFloat(whole) + parseFraction(fraction);
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str);
}
function formatQuantityNumber(value, denominator) {
  const rounded = Math.round(value * denominator) / denominator;
  const whole = Math.floor(rounded);
  const numerator = Math.round((rounded - whole) * denominator);
  const fraction = denominator === 2 ? { 1: '1/2' } : { 1: '1/4', 2: '1/2', 3: '3/4' };
  if (!numerator) return String(whole);
  return whole ? `${whole} ${fraction[numerator]}` : fraction[numerator];
}
export { OptimizeButton, PortionOptimizerPanel as default };
