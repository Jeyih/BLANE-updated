import { SLOT_OPTIMIZATIONS_KEY } from '../lib/week-plans.js';
import { sessionMealStorage as sessionStorage, readStoredJson } from '../lib/account-storage.js';
import { buildPortionPreview } from '../lib/manual-portions.js';
import React from 'react';
import { useEffect, useState } from 'react';
import '../styles/optimizer.css';
function OptimizeButton({ open, onToggle, disabled = false, disabledReason }) {
  return React.createElement(
    'button',
    {
      className: 'meal-action-btn',
      style: { borderColor: 'rgba(96,165,250,0.25)', color: '#60a5fa' },
      onClick: onToggle,
      disabled,
      title: disabled ? (disabledReason || 'Resolve dietary warnings or missing nutrition data first.') : 'Adjust portion size',
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
    ' Adjust portion',
  );
}
function PortionOptimizerPanel({
  optimizationKey,
  meal,
  profile,
  totalMealsToday,
  open,
  onClose,
  onApplied,
  onOriginalMeal,
  blocked = false,
}) {
  const optimizationStorageKey = optimizationKey ? SLOT_OPTIMIZATIONS_KEY : 'blane_optimized_v2';
  const storedMealKey = optimizationKey || meal?.id;
  const [applied, setApplied] = useState(false);
  const [originalRestored, setOriginalRestored] = useState(false);
  const [selectedScale, setSelectedScale] = useState(1);
  useEffect(() => {
    if (!open) return;
    const saved = readStoredJson(sessionStorage, optimizationStorageKey, {})[storedMealKey];
    const value = Number(saved?.scaleFactor);
    setSelectedScale(Number.isFinite(value) && value >= 0.5 && value <= 2 ? value : 1);
    setApplied(false);
    setOriginalRestored(false);
  }, [open, storedMealKey, optimizationStorageKey]);
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
  const result = buildPortionPreview(meal, totalMealsToday || 4, profile, selectedScale);
  const scaleClass = result.scaleFactor > 1.05 ? 'over' : result.scaleFactor < 0.95 ? 'under' : '';
  const scaleLabel =
    result.scaleFactor > 1.05
      ? '\u2191 ' + result.scaleFactor.toFixed(2) + '\xD7 Increase'
      : result.scaleFactor < 0.95
        ? '\u2193 ' + result.scaleFactor.toFixed(2) + '\xD7 Decrease'
        : '\u2192 ' + result.scaleFactor.toFixed(2) + '\xD7 Original';
  function handleApply() {
    if (blocked) return;
    const saved = readStoredJson(sessionStorage, optimizationStorageKey, {});
    saved[storedMealKey] = {
      scaleFactor: result.scaleFactor,
      ingredients: result.ingredients,
      optimizedKcal: result.optimizedKcal,
      appliedAt: new Date().toISOString(),
      source: 'user',
    };
    sessionStorage.setItem(optimizationStorageKey, JSON.stringify(saved));
    window.dispatchEvent(new Event('blane-portions-updated'));
    setApplied(true);
    setOriginalRestored(false);
    onApplied?.(meal.id, result);
  }
  function handleOriginalMeal() {
    let saved = {};
    try {
      saved = JSON.parse(sessionStorage.getItem(optimizationStorageKey) || '{}');
    } catch {
      saved = {};
    }
    delete saved[storedMealKey];
    sessionStorage.setItem(optimizationStorageKey, JSON.stringify(saved));
    window.dispatchEvent(new Event('blane-portions-updated'));
    setApplied(false);
    setOriginalRestored(true);
    setSelectedScale(1);
    onOriginalMeal?.(meal.id);
  }
  return React.createElement(
    'div',
    { className: 'opt-panel open opt-manual-panel' },
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
            { className: 'opt-icon' },
            '\u2696\uFE0F',
          ),
          React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { className: 'opt-title' },
              'Portion size \u2014 ',
              meal.name,
            ),
            React.createElement(
              'div',
              { className: 'opt-sub' },
              'Choose your portion. Apply it when you are ready.',
            ),
          ),
        ),
        React.createElement(
          'button',
          { className: 'opt-close-btn', onClick: onClose },
          '\u2715 Close',
        ),
      ),
      React.createElement('div', { className: 'opt-manual-controls' },
        React.createElement('label', { htmlFor: `portion-${storedMealKey}` }, 'Portion multiplier: ', React.createElement('strong', null, selectedScale.toFixed(2), ' times the original')),
        React.createElement('input', { id: `portion-${storedMealKey}`, type: 'range', min: 0.5, max: 2, step: 0.05, value: selectedScale, disabled: blocked, 'aria-label': 'Portion multiplier', onChange: e => { setSelectedScale(Number(e.target.value)); setApplied(false); setOriginalRestored(false); } }),
        React.createElement('div', { className: 'opt-portion-presets' },
          [[0.5, 'Half'], [0.75, 'Three-quarter'], [1, 'Original'], [1.5, 'One and a half'], [2, 'Double']].map(([value, label]) => React.createElement('button', { key: value, type: 'button', className: 'opt-btn opt-btn-outline', 'aria-pressed': selectedScale === value, disabled: blocked, onClick: () => { setSelectedScale(value); setApplied(false); setOriginalRestored(false); } }, label))),
        React.createElement('p', null, 'Choose your portion size. Ingredient amounts adjust together, while dietary checks remain in place.'),
        React.createElement('p', null, `Your portion: ${result.optimized.protein} g protein · ${result.optimized.carbs} g carbs · ${result.optimized.fats} g fat. Prices retain the original recipe’s estimate limitations.`),
        React.createElement('p', { role: 'status' }, applied ? 'Your chosen portion is applied.' : originalRestored ? 'Original meal restored.' : 'Preview only — click Apply to save.')),
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
          React.createElement('div', { className: 'opt-target-chip-label' }, 'Your Portion'),
          React.createElement(
            'div',
            { className: 'opt-target-chip-value green' },
            result.optimizedKcal,
            ' kcal',
          ),
        ),
        React.createElement('div', { className: 'opt-target-chip' }, React.createElement('div', { className: 'opt-target-chip-label' }, 'Estimated portion cost'), React.createElement('div', { className: 'opt-target-chip-value' }, result.cost == null ? 'Unavailable' : `₱${result.cost.toFixed(2)}`)),
        React.createElement('span', { className: 'opt-scale-badge ' + scaleClass }, scaleLabel),
      ),
      React.createElement(
        'div',
        { className: 'opt-section-title' },
        'Ingredient Portions \u2014 Original vs Your Portion',
      ),
      React.createElement(
        'div',
        { className: 'opt-ingredient-table-wrap' },
        React.createElement(
          'div',
          { className: 'opt-table-header' },
          React.createElement('span', null, 'Ingredient'),
          React.createElement('span', null, 'Orig Quantity'),
          React.createElement('span', null, 'Your Quantity'),
          React.createElement('span', null, 'Original (g)'),
          React.createElement('span', null, 'Your Weight (g)'),
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
            return null;
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
                React.createElement('b', null, macroValue('protein') == null ? 'Not recorded' : `~${macroValue('protein')}g`),
              ),
              React.createElement(
                'div',
                { className: 'opt-ing-macro-line' },
                'C ',
                React.createElement('b', null, macroValue('carbs') == null ? 'Not recorded' : `~${macroValue('carbs')}g`),
              ),
              React.createElement(
                'div',
                { className: 'opt-ing-macro-line' },
                'F ',
                React.createElement('b', null, macroValue('fats') == null ? 'Not recorded' : `~${macroValue('fats')}g`),
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
          { className: 'opt-btn opt-btn-primary', onClick: handleApply, disabled: blocked },
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

      ),
    ),
  );
}
export { OptimizeButton, PortionOptimizerPanel as default };
