/* ============================================================
   BLANE — Dynamic Portion Optimizer (Module 03)
   Replaces: js/optimizer.js entirely.

   Self-contained button + collapsible panel, rendered inline
   below a meal card (not a portal — matches the old inline
   .opt-panel behavior, unlike the fixed-position WhyButton).
   ============================================================ */
import { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import '../styles/optimizer.css';

const OPT_MIN_SCALE = 0.5;
const OPT_MAX_SCALE = 2.0;
const MACRO_TARGETS = { protein: 0.30, carbs: 0.45, fats: 0.25 };
const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra_active: 1.9 };
const GOAL_ADJUST   = { lose_weight: 0.85, gain_muscle: 1.10, maintain: 1.0, improve_health: 1.0, boost_energy: 1.0, manage_condition: 1.0 };

export function OptimizeButton({ open, onToggle }) {
  return (
    <button className="meal-action-btn" style={{ borderColor: 'rgba(96,165,250,0.25)', color: '#60a5fa' }} onClick={onToggle}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
      {' Optimize'}
    </button>
  );
}

function getOptimizeMealUrl() {
  if (!SUPABASE_URL) return null;
  return SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co') + '/optimize-meal';
}

export default function PortionOptimizerPanel({ meal, profile, totalMealsToday, open, onClose, onApplied }) {
  const [applied, setApplied] = useState(false);
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

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setAiMode('local');
            setAiError('Sign in to enable Gemini optimization. Using a smart local estimate instead.');
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
          const sourceQuantity = meal.ingredients.find((item) => item.name === ing.name)?.quantity;
          const quantityValue = sourceQuantity == null || sourceQuantity === ''
            ? '—'
            : applied ? ing.optimized || sourceQuantity : sourceQuantity;
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
          setAiError('BLANE AI is temporarily unavailable. Showing the smart local estimate instead.');
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    }

    loadAiOptimization();
    return () => { cancelled = true; };
  }, [open, meal?.id, profile?.height_cm, profile?.weight_kg, profile?.goal, profile?.activity_level, totalMealsToday]);

  if (!open) return null;

  if (!profile?.height_cm) {
    return (
      <div className="opt-panel open">
        <div className="opt-inner">
          <p style={{ fontSize: 13, color: '#4d6e5a', textAlign: 'center', padding: '20px 0' }}>
            ⚠️ Complete your health profile first to enable portion optimization.
          </p>
        </div>
      </div>
    );
  }

  const result = aiResult || optimizeMeal(meal, totalMealsToday || 3, profile);
  const scaleClass = result.scaleFactor > 1.05 ? 'over' : result.scaleFactor < 0.95 ? 'under' : '';
  const scaleLabel = result.scaleFactor > 1.05
    ? '↑ ' + result.scaleFactor.toFixed(2) + '× Increase'
    : result.scaleFactor < 0.95
    ? '↓ ' + result.scaleFactor.toFixed(2) + '× Decrease'
    : '→ ' + result.scaleFactor.toFixed(2) + '× (Optimal)';

  const pBar = (val, target) => Math.min(Math.round((val / target) * 100), 120);

  function handleApply() {
    const saved = JSON.parse(sessionStorage.getItem('blane_optimized') || '{}');
    saved[meal.id] = {
      scaleFactor: result.scaleFactor,
      ingredients: result.ingredients,
      optimizedKcal: result.optimizedKcal,
      appliedAt: new Date().toISOString(),
    };
    sessionStorage.setItem('blane_optimized', JSON.stringify(saved));
    setApplied(true);
    onApplied?.(meal.id, result);
  }

  return (
    <div className={'opt-panel open' + (aiMode === 'ai' ? ' opt-panel-ai' : '')}>
      <div className="opt-inner">
        <div className="opt-header">
          <div className="opt-header-left">
            <div className={'opt-icon' + (aiMode === 'ai' ? ' ai' : '')}>
              {aiMode === 'ai' ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17">
                  <path d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z" />
                </svg>
              ) : '⚖️'}
            </div>
            <div>
              <div className="opt-title">AI Portion Optimizer — {meal.name}</div>
              <div className="opt-sub">Powered by Gemini · adjusted for your calorie &amp; macro targets</div>
            </div>
          </div>
          <button className="opt-close-btn" onClick={onClose}>✕ Close</button>
        </div>

        <div className={'opt-header-strip' + (aiLoading ? ' opt-header-strip-loading' : '')}>
          <span className={'opt-mode-badge ' + aiMode}>
            {aiMode === 'ai' ? (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11" className="opt-mode-badge-spark">
                  <path d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z" />
                </svg>
                Gemini AI
              </>
            ) : '⚙ Local estimate'}
          </span>
          {aiLoading && (
            <span className="opt-loading-text opt-loading-pulse">
              <span className="opt-loading-dot"></span>
              <span className="opt-loading-dot"></span>
              <span className="opt-loading-dot"></span>
              Gemini is analyzing this meal…
            </span>
          )}
          {!aiLoading && aiError && <span className="opt-warning-text">{aiError}</span>}
        </div>

        {aiMode === 'ai' && (result.insight || result.explanation || result.reasoning) && (
          <div className="opt-ai-insight">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" className="opt-ai-insight-spark">
              <path d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z" />
            </svg>
            <span>{result.insight || result.explanation || result.reasoning}</span>
          </div>
        )}

        <div className="opt-target-row">
          <div className="opt-target-chip">
            <div className="opt-target-chip-label">Daily Target</div>
            <div className="opt-target-chip-value green">{result.daily.calories.toLocaleString()} kcal</div>
          </div>
          <div className="opt-target-divider"></div>
          <div className="opt-target-chip">
            <div className="opt-target-chip-label">Per-Meal Target</div>
            <div className="opt-target-chip-value yellow">{result.perMealKcal} kcal</div>
          </div>
          <div className="opt-target-divider"></div>
          <div className="opt-target-chip">
            <div className="opt-target-chip-label">Original Meal</div>
            <div className="opt-target-chip-value">{result.originalKcal} kcal</div>
          </div>
          <div className="opt-target-divider"></div>
          <div className="opt-target-chip">
            <div className="opt-target-chip-label">Optimized Meal</div>
            <div className="opt-target-chip-value green">{result.optimizedKcal} kcal</div>
          </div>
          <span className={'opt-scale-badge ' + scaleClass}>{scaleLabel}</span>
        </div>

        <div className="opt-section-title">Ingredient Portions — Original vs Optimized</div>
        <div className="opt-table-header">
          <span>Ingredient</span><span style={{ textAlign: 'center' }}>Quantity</span>
          <span style={{ textAlign: 'center' }}>Original</span><span style={{ textAlign: 'center' }}>Optimized</span>
          <span style={{ textAlign: 'right' }}>Macros</span>
        </div>
        {result.ingredients.map((ing) => {
          const changeClass = ing.increased ? 'more' : ing.decreased ? 'less' : 'same';
          const sourceQuantity = meal.ingredients.find((item) => item.name === ing.name)?.quantity;
          const quantityValue = sourceQuantity == null || sourceQuantity === ''
            ? '—'
            : applied ? ing.optimized || sourceQuantity : sourceQuantity;
          const changeTxt = ing.increased
            ? '+' + ((result.scaleFactor - 1) * 100).toFixed(0) + '%'
            : ing.decreased
            ? '-' + ((1 - result.scaleFactor) * 100).toFixed(0) + '%'
            : 'same';
          return (
            <div key={ing.name} className="opt-ing-row">
              <div className="opt-ing-name"><div className="opt-ing-dot"></div>{ing.name}</div>
              <div className="opt-ing-quantity">{quantityValue}</div>
              <div className="opt-ing-original">{ing.original}</div>
              <div className="opt-ing-optimized">
                <div className="opt-ing-opt-val">{ing.optimized}</div>
                <div className={'opt-ing-opt-change ' + changeClass}>{changeTxt}</div>
              </div>
              <div className="opt-ing-macro">
                <div className="opt-ing-macro-line">P <b>~{Math.round(meal.protein / meal.ingredients.length * result.scaleFactor)}g</b></div>
                <div className="opt-ing-macro-line">C <b>~{Math.round(meal.carbs / meal.ingredients.length * result.scaleFactor)}g</b></div>
                <div className="opt-ing-macro-line">F <b>~{Math.round(meal.fats / meal.ingredients.length * result.scaleFactor)}g</b></div>
              </div>
            </div>
          );
        })}

        <div className="opt-apply-row">
          <button className="opt-btn opt-btn-primary" onClick={handleApply}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Apply to Meal Plan
          </button>
          {applied && <span className="opt-applied-badge show">✓ Portions applied to today's plan</span>}
          {!applied && aiMode === 'ai' && !aiLoading && (
            <span className="opt-ai-footer-note">
              <svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 2.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2-5.2-1.8 5.2-1.8L12 2.5z" /></svg>
              Optimized with Gemini AI
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PURE HELPER FUNCTIONS (ported unchanged from optimizer.js)
   ============================================================ */
function computeDailyTargets(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * (ACTIVITY_MULT[profile.activity_level] || 1.55);
  const calTarget = Math.round(tdee * (GOAL_ADJUST[profile.goal] || 1.0));
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
    scaleFactor, perMealKcal, originalKcal, optimizedKcal,
    original: { protein: meal.protein, carbs: meal.carbs, fats: meal.fats },
    optimized: { protein: optimizedProtein, carbs: optimizedCarbs, fats: optimizedFats },
    targets: { protein: mealProteinTarget, carbs: mealCarbsTarget, fats: mealFatsTarget, calories: perMealKcal },
    ingredients: scaledIngredients,
    daily,
  };
}

function scaleIngredient(ing, factor) {
  const original = ing.qty;
  const optimized = scaleQtyString(original, factor);
  return {
    name: ing.name, status: ing.status, original, optimized, factor,
    changed: Math.abs(factor - 1) > 0.05,
    increased: factor > 1.05,
    decreased: factor < 0.95,
  };
}

function scaleQtyString(qtyStr, factor) {
  if (!qtyStr || qtyStr === 'to taste') return qtyStr;
  const normalizedQty = String(qtyStr).trim();
  const match = normalizedQty.match(/^([\d./½¼¾⅓⅔]+)\s*(.*)/);
  if (!match) return qtyStr;

  let num = parseFraction(match[1]);
  const unit = match[2].trim();
  if (isNaN(num) || num === 0) return qtyStr;

  const scaled = num * factor;
  let formatted;
  if (['pcs', 'pc', 'cloves', 'slices', 'stalks'].includes(unit)) {
    const rounded = Math.round(scaled * 2) / 2;
    formatted = rounded % 1 === 0.5 ? rounded.toFixed(1) : Math.round(rounded).toString();
  } else if (unit === 'cup' || unit === 'cups') {
    formatted = formatCup(scaled);
  } else if (unit === 'tbsp' || unit === 'tsp') {
    const rounded = Math.round(scaled * 4) / 4;
    formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  } else {
    const rounded = Math.round(scaled / 5) * 5 || Math.round(scaled);
    formatted = rounded.toString();
  }
  return formatted + (unit ? ' ' + unit : '');
}

function parseFraction(str) {
  const fracts = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667 };
  if (fracts[str]) return fracts[str];
  if (str.includes('/')) {
    const parts = str.split('/');
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return parseFloat(str);
}

function formatCup(val) {
  if (val >= 0.875) return Math.round(val).toString();
  if (val >= 0.625) return '¾';
  if (val >= 0.375) return '½';
  if (val >= 0.175) return '¼';
  return val.toFixed(2);
}