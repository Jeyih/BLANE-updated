import { generateMealPlan } from '../lib/plan-generation.js';
import { appliedMeal } from '../lib/portions.js';
import { loadConstraintDefinitions } from '../lib/constraints';
import { localMealStorage as localStorage, sessionMealStorage as sessionStorage } from '../lib/account-storage.js';
import { computeDailyTargets } from '../../supabase/functions/_shared/nutrition.js';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  applyDynamicRecipePrices,
  formatEstimatedPrice as formatPrice,
  pricingLabel,
} from '../lib/pricing';
import {
  philippineClock,
  timedSlotIndex,
  availableMealSlots,
  DEFAULT_SLOTS,
} from '../lib/meal-experience';
import useMealClock from '../hooks/useMealClock';
import PriceEstimateNotice from '../components/PriceEstimateNotice';
import '../styles/meal-experience.css';
import { useIngredientPrices } from '../context/PriceContext';
import Navbar from '../components/Navbar';
import DashboardTour from '../components/DashboardTour';
import FeedbackWidget from '../components/FeedbackWidget';
import DriftWidget from '../components/DriftWidget';
import RecommendWidget from '../components/RecommendWidget';
import '../styles/dashboard.css';
function getCalorieGoal(profile) {
  return computeDailyTargets(profile).calories;
}
function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState('...');
  const [logs, setLogs] = useState([]);
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    loadProfile();
  }, [user]);
  useEffect(() => {
    if (!user?.id) return;
    const newUserKey = `blane_dashboard_tour_new_user_${user.id}`;
    const completedKey = `blane_dashboard_tour_completed_${user.id}`;
    const isNewUser = globalThis.localStorage.getItem(newUserKey) === 'true';
    globalThis.localStorage.removeItem(newUserKey);
    setTourOpen(isNewUser && globalThis.localStorage.getItem(completedKey) !== 'true');
  }, [user?.id]);
  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setFirstName((data.full_name || user.email.split('@')[0]).split(' ')[0]);
    }
  }
  const [quickCheckinMood, setQuickCheckinMood] = useState(null);
  const [checkinToast, setCheckinToast] = useState('');
  function handleCheckin(mood, note) {
    setQuickCheckinMood(mood);
    setCheckinToast(note);
    setTimeout(() => setCheckinToast(''), 4e3);
  }
  function closeTour() {
    if (user?.id) {
      globalThis.localStorage.setItem(`blane_dashboard_tour_completed_${user.id}`, 'true');
    }
    setTourOpen(false);
  }
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Navbar, null),
    React.createElement(DashboardTour, { isOpen: tourOpen, onClose: closeTour }),
    React.createElement(
      'main',
      { className: 'dash-main' },
      React.createElement(
        'div',
        { className: 'dash-content' },
        React.createElement(
          'div',
          { className: 'dash-page-header', 'data-dashboard-tour': 'overview' },
          React.createElement(
            'div',
            null,
            React.createElement(
              'h1',
              { className: 'dash-page-title' },
              'Good day, ',
              React.createElement('span', { style: { color: '#2ddc7a' } }, firstName),
              ' \u{1F44B}',
            ),
            React.createElement(
              'p',
              { className: 'dash-page-date', style: { color: '#d1fae5', fontSize: 15 } },
              today,
              ' \xB7 Personalized for your metabolic profile',
            ),
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement(
              'button',
              { className: 'dash-tour-trigger', type: 'button', onClick: () => setTourOpen(true) },
              React.createElement('span', { 'aria-hidden': 'true' }, '\u24D8'),
              ' Take a tour',
            ),
          ),
        ),
        React.createElement(
          'div',
          {
            style: {
              background: 'linear-gradient(135deg, #173023 0%, #12261b 100%)',
              border: '1px solid rgba(45, 220, 122, 0.25)',
              borderRadius: '18px',
              padding: '16px 20px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            },
            'data-dashboard-tour': 'check-in',
          },
          React.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            React.createElement('span', { style: { fontSize: '24px' } }, '\u{1F331}'),
            React.createElement(
              'div',
              null,
              React.createElement(
                'div',
                { style: { color: '#ffffff', fontWeight: 700, fontSize: '15px' } },
                'Daily Check-in: How are you feeling right now?',
              ),
              React.createElement(
                'div',
                { style: { color: '#d1fae5', fontSize: '13px' } },
                checkinToast ||
                  'Select your mood for a brief check-in.',
              ),
            ),
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            [
              {
                mood: 'energetic',
                icon: '\u26A1',
                label: 'Energetic',
                note: 'Energetic selected for this session.',
              },
              {
                mood: 'great',
                icon: '\u{1F60A}',
                label: 'Feeling Great',
                note: 'Feeling great selected for this session.',
              },
              {
                mood: 'active',
                icon: '\u{1F4AA}',
                label: 'Workout Today',
                note: 'Workout selected. Record your activity in the health log below.',
              },
              {
                mood: 'tired',
                icon: '\u{1F634}',
                label: 'Tired / Low Energy',
                note: 'Low energy selected. Review your recent health entries below.',
              },
            ].map((item) =>
              React.createElement(
                'button',
                {
                  key: item.mood,
                  type: 'button',
                  onClick: () => handleCheckin(item.mood, item.note),
                  style: {
                    background:
                      quickCheckinMood === item.mood ? '#2ddc7a' : 'rgba(255, 255, 255, 0.06)',
                    color: quickCheckinMood === item.mood ? '#0a1610' : '#ffffff',
                    border:
                      quickCheckinMood === item.mood
                        ? '2px solid #ffffff'
                        : '1px solid rgba(45, 220, 122, 0.25)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  },
                },
                React.createElement('span', null, item.icon),
                React.createElement('span', null, item.label),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dash-grid' },
          React.createElement(MealPlanWidget, { profile }),
          React.createElement(BmiWidget, { profile }),
          React.createElement(RecommendWidget, { profile }),
          profile &&
            React.createElement(FeedbackWidget, {
              profile,
              onProfileUpdate: setProfile,
              onLogsChange: setLogs,
            }),
          profile && React.createElement(DriftWidget, { logs, profile }),
        ),
      ),
    ),
  );
}
function MealPlanWidget({ profile }) {
  const now = useMealClock();
  const [savedRecipes, setRecipes] = useState([]);
  const { records } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, records),
    [savedRecipes, records],
  );
  const [daySlots, setDaySlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      const { data: recipesData } = await supabase.from('recipes').select('*').order('name');
      const { data: ingData } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .order('sort_order');
      if (cancelled) return;
      const ingByRecipe = {};
      (ingData || []).forEach((ing) => {
        if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
        ingByRecipe[ing.recipe_id].push({
          name: ing.name || ing.ingredient_name || ing.food_name,
          qty: ing.quantity ?? ing.qty,
          grams: ing.grams,
          status: ing.status || 'avail',
        });
      });
      const formattedRecipes = (recipesData || []).map((r) => ({
        id: r.id,
        emoji: r.emoji || '\u{1F372}',
        name: r.name,
        type: r.type,
        difficulty: r.difficulty || 'medium',
        cookTime: r.cook_time_min || 20,
        prep: `${r.cook_time_min || 20} min`,
        kcal: r.kcal || 0,
        cost: r.cost || 0,
        servings: r.servings || 1,
        protein: r.protein_g || 0,
        carbs: r.carbs_g || 0,
        fats: r.fats_g || 0,
        ingredients: ingByRecipe[r.id] || [],
      }));
      setRecipes(formattedRecipes);
      const saved = localStorage.getItem('blane_meal_plan');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Object.keys(parsed).length > 0) {
            setDaySlots(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (formattedRecipes.length > 0) {
        const definitions = await loadConstraintDefinitions();
        if (cancelled) return;
        const defaultPlan = generateMealPlan(formattedRecipes, profile, definitions || {}, { ready: Boolean(definitions) });
        setDaySlots(defaultPlan);
        localStorage.setItem('blane_meal_plan', JSON.stringify(defaultPlan));
      }
      setLoading(false);
    }
    if (profile) loadData();
    return () => { cancelled = true; };
  }, [profile]);
  function getMeal(id) {
    if (!id) return null;
    let optimizations = {};
    try { optimizations = JSON.parse(sessionStorage.getItem('blane_optimized_v2') || '{}'); } catch {}
    return appliedMeal(recipes.find((r) => r.id === id || String(r.id) === String(id)) || null, optimizations[id]);
  }
  useEffect(() => {
    const syncPlan = (event) => {
      if (event?.key && !localStorage.matches(event.key, 'blane_meal_plan')) return;
      try {
        const saved = JSON.parse(localStorage.getItem('blane_meal_plan') || '{}');
        if (saved && typeof saved === 'object') setDaySlots(saved);
      } catch {}
    };
    window.addEventListener('blane-meal-plan-updated', syncPlan);
    window.addEventListener('blane-portions-updated', syncPlan);
    window.addEventListener('storage', syncPlan);
    return () => {
      window.removeEventListener('blane-meal-plan-updated', syncPlan);
      window.removeEventListener('blane-portions-updated', syncPlan);
      window.removeEventListener('storage', syncPlan);
    };
  }, []);
  const clock = philippineClock(now);
  const todayIndex = clock.dayIndex;
  const todaySlots = daySlots[todayIndex] || [];
  const visibleMealTypes = availableMealSlots(DEFAULT_SLOTS, now).map((slot) => slot.type);
  const allPlannedMeals = todaySlots
    .map((s) => ({ slot: s, meal: getMeal(s.mealId) }))
    .filter((item) => item.meal);
  const plannedMeals = todaySlots
    .filter((slot) => visibleMealTypes.includes(slot.type))
    .map((s) => ({ slot: s, meal: getMeal(s.mealId) }))
    .filter((item) => item.meal);
  const autoIndex = timedSlotIndex(
    visibleMealTypes.map((type) => DEFAULT_SLOTS.find((slot) => slot.type === type)),
    now,
  );
  const availableSlotKey = visibleMealTypes.join('|');
  useEffect(() => {
    setActiveTabIdx(autoIndex);
  }, [autoIndex, clock.dateKey, availableSlotKey]);
  const totalKcal = allPlannedMeals.reduce((acc, item) => acc + item.meal.kcal, 0);
  const totalProtein = Math.round(allPlannedMeals.reduce((acc, item) => acc + Number(item.meal.protein || 0), 0) * 10) / 10;
  const totalCost = allPlannedMeals.reduce((acc, item) => acc + (item.meal.cost || 0), 0);
  const missingCosts = allPlannedMeals.some((item) => item.meal.priceIncomplete);
  const calGoal = getCalorieGoal(profile);
  const calPct = Math.min(Math.round((totalKcal / calGoal) * 100), 100);
  const activeMealType = visibleMealTypes[Math.min(activeTabIdx, visibleMealTypes.length - 1)];
  const currentItem = plannedMeals.find((item) => item.slot.type === activeMealType);
  const mealTimeGuide = {
    Breakfast: 'Breakfast: Until 10:30am',
    Lunch: 'Lunch: 10:30am to 2:30pm',
    Snack: 'Snack: 2:30pm to 7:00pm',
    Dinner: 'Dinner: 7:00pm to 11:59pm',
  }[activeMealType];
  return React.createElement(
    'div',
    { className: 'widget col-8', 'data-dashboard-tour': 'meal-plan' },
    React.createElement(
      'div',
      { className: 'widget-header' },
      React.createElement(
        'div',
        { className: 'widget-title-row' },
        React.createElement('div', { className: 'widget-icon' }, '\u{1F37D}\uFE0F'),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'widget-title' }, "Today's Meal Plan"),
          React.createElement(
            'div',
            { className: 'widget-subtitle' },
            'Remaining meals today \xB7 Philippine time',
          ),
        ),
      ),
      React.createElement(
        Link,
        { to: '/mealplan', className: 'widget-badge', style: { textDecoration: 'none' } },
        'Open Meal Plan \u2192',
      ),
    ),
    React.createElement(
      'div',
      {
        className: 'meal-tabs' + (visibleMealTypes.length === 1 ? ' single' : ''),
        role: 'group',
        'aria-label': 'Meal type',
      },
      DEFAULT_SLOTS.map((slot) => {
        const index = visibleMealTypes.indexOf(slot.type);
        if (index === -1) return null;
        return React.createElement(
          'button',
          {
            key: slot.type,
            type: 'button',
            className: 'meal-tab-btn' + (slot.type === activeMealType ? ' active' : ''),
            'aria-pressed': slot.type === activeMealType,
            onClick: () => setActiveTabIdx(index),
          },
          slot.type,
        );
      }),
    ),
    React.createElement(
      'div',
      { className: 'meal-time-guide', 'aria-live': 'polite' },
      React.createElement('span', null, mealTimeGuide),
    ),
    loading
      ? React.createElement(
          'div',
          { style: { padding: '32px 0', textAlign: 'center', color: '#d1fae5', fontSize: '15px' } },
          "Loading today's meal plan\u2026",
        )
      : React.createElement(
          React.Fragment,
          null,
          currentItem
            ? React.createElement(
                'div',
                { className: 'meal-panel active' },
                React.createElement(
                  'div',
                  { className: 'meal-main-card' },
                  React.createElement(
                    'div',
                    { className: 'meal-emoji-big' },
                    currentItem.meal.emoji,
                  ),
                  React.createElement(
                    'div',
                    { className: 'meal-main-info' },
                    React.createElement(
                      'div',
                      { className: 'meal-main-name' },
                      currentItem.meal.name,
                    ),
                    React.createElement(
                      'div',
                      { className: 'meal-main-meta' },
                      currentItem.slot.time || 'Today',
                      ' \xA0\xB7\xA0 ',
                      currentItem.meal.prep,
                      ' prep \xA0\xB7\xA0 ',
                      formatPrice(currentItem.meal.cost),
                      ' (',
                      pricingLabel(currentItem.meal),
                      ')',
                    ),
                    React.createElement(
                      Link,
                      {
                        to: `/recipes?recipe=${encodeURIComponent(currentItem.meal.id)}`,
                        className: 'meal-recipe-link',
                      },
                      React.createElement('span', null, 'View this recipe'),
                      React.createElement(
                        'svg',
                        {
                          width: '16',
                          height: '16',
                          viewBox: '0 0 24 24',
                          fill: 'none',
                          stroke: 'currentColor',
                          strokeWidth: '2',
                          'aria-hidden': 'true',
                        },
                        React.createElement('path', { d: 'M5 12h14M13 6l6 6-6 6' }),
                      ),
                    ),
                    React.createElement(
                      'div',
                      { className: 'meal-macros-row' },
                      React.createElement(
                        'div',
                        { className: 'meal-macro-chip' },
                        React.createElement('span', null, currentItem.meal.protein, 'g'),
                        ' ',
                        React.createElement('small', null, 'Protein'),
                      ),
                      React.createElement(
                        'div',
                        { className: 'meal-macro-chip' },
                        React.createElement('span', null, currentItem.meal.carbs, 'g'),
                        ' ',
                        React.createElement('small', null, 'Carbs'),
                      ),
                      React.createElement(
                        'div',
                        { className: 'meal-macro-chip' },
                        React.createElement('span', null, currentItem.meal.fats, 'g'),
                        ' ',
                        React.createElement('small', null, 'Fats'),
                      ),
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'meal-kcal-tag' },
                    currentItem.meal.kcal,
                    React.createElement('small', null, 'kcal'),
                  ),
                ),
                currentItem.meal.ingredients.length > 0 &&
                  React.createElement(
                    'div',
                    { className: 'meal-ingredients' },
                    React.createElement(
                      'div',
                      {
                        style: {
                          fontSize: 12,
                          color: '#d1fae5',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          marginBottom: 6,
                        },
                      },
                      'Key Ingredients',
                    ),
                    currentItem.meal.ingredients
                      .slice(0, 4)
                      .map((ing, i) =>
                        React.createElement(
                          'div',
                          { key: i, className: 'meal-ingredient-row' },
                          React.createElement('div', { className: 'ingredient-dot' }),
                          React.createElement('span', { className: 'ingredient-name' }, ing.name),
                          React.createElement('span', { className: 'ingredient-amount' }, ing.qty),
                          React.createElement(
                            'span',
                            {
                              className:
                                'ingredient-avail ' + (ing.status === 'avail' ? 'yes' : 'no'),
                            },
                            ing.status === 'avail' ? '\u2713 In stock' : '\u26A0 Check market',
                          ),
                        ),
                      ),
                  ),
              )
            : React.createElement(
                'div',
                { className: 'meal-empty-panel' },
                React.createElement(
                  'div',
                  { className: 'meal-empty-title' },
                  'No ',
                  activeMealType.toLowerCase(),
                  ' planned yet',
                ),
                React.createElement(
                  'div',
                  { className: 'meal-empty-description' },
                  'Add a ',
                  activeMealType.toLowerCase(),
                  " to today's plan to see it here.",
                ),
                React.createElement(
                  Link,
                  { to: '/mealplan', className: 'meal-plan-link' },
                  "Plan today's meals ",
                  React.createElement('span', { 'aria-hidden': 'true' }, '\u2192'),
                ),
              ),
          React.createElement(
            'div',
            { className: 'daily-cal-summary' },
            React.createElement(PriceEstimateNotice, null),
            React.createElement(
              'div',
              { className: 'daily-cal-row' },
              React.createElement(
                'span',
                { className: 'daily-cal-label' },
                "Today's Total: ",
                React.createElement('b', null, totalProtein, 'g'),
                ' P \xB7 ',
                React.createElement('b', null, formatPrice(totalCost)),
                ' ',
                missingCosts ? 'Known costs (incomplete)' : 'Est. Cost',
              ),
              React.createElement(
                'span',
                { className: 'daily-cal-numbers' },
                React.createElement('span', null, totalKcal),
                ' / ',
                calGoal,
                ' kcal',
              ),
            ),
            React.createElement(
              'div',
              { className: 'daily-cal-bar-bg' },
              React.createElement('div', {
                className: 'daily-cal-bar-fill',
                style: { width: calPct + '%' },
              }),
            ),
          ),
          React.createElement(
            Link,
            { to: '/mealplan', className: 'meal-plan-link' },
            'View full meal plan ',
            React.createElement('span', { 'aria-hidden': 'true' }, '\u2192'),
          ),
        ),
  );
}
function BmiWidget({ profile }) {
  const h = parseFloat(profile?.height_cm);
  const w = parseFloat(profile?.weight_kg);
  const hasData = h && w;
  const bmi = hasData ? w / ((h / 100) * (h / 100)) : null;
  const bmiFixed = bmi ? bmi.toFixed(1) : '--';
  let category = '--',
    color = '#2ddc7a',
    desc = 'Loading your profile data...';
  if (bmi) {
    if (bmi < 18.5) {
      category = 'Underweight';
      color = '#60a5fa';
      desc = 'Your BMI is below the healthy range. Consider a calorie surplus plan.';
    } else if (bmi < 25) {
      category = 'Normal';
      color = '#2ddc7a';
      desc = 'Your BMI is within the healthy range. Keep up the great work!';
    } else if (bmi < 30) {
      category = 'Overweight';
      color = '#fbbf24';
      desc = 'Your BMI is slightly above normal. A moderate deficit may help.';
    } else {
      category = 'Obese';
      color = '#f87171';
      desc = 'Your BMI indicates obesity. Please consult a healthcare provider.';
    }
  }
  const circumf = 2 * Math.PI * 36;
  const pct = bmi ? Math.min(bmi / 40, 1) : 0;
  const arcFill = pct * circumf;
  const scalePct = bmi ? Math.min(Math.max((bmi - 10) / 30, 0), 1) * 100 : 0;
  const idealLow = hasData ? (18.5 * (h / 100) * (h / 100)).toFixed(1) : null;
  const idealHigh = hasData ? (24.9 * (h / 100) * (h / 100)).toFixed(1) : null;
  return React.createElement(
    'div',
    { className: 'widget col-4', 'data-dashboard-tour': 'body-stats' },
    React.createElement(
      'div',
      { className: 'widget-header' },
      React.createElement(
        'div',
        { className: 'widget-title-row' },
        React.createElement('div', { className: 'widget-icon' }, '\u{1F4CA}'),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'widget-title' }, 'BMI & Body Stats'),
          React.createElement('div', { className: 'widget-subtitle' }, 'Based on your profile'),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'bmi-display' },
      React.createElement(
        'div',
        { className: 'bmi-ring-wrap' },
        React.createElement(
          'svg',
          { viewBox: '0 0 90 90', width: '90', height: '90' },
          React.createElement('circle', {
            cx: '45',
            cy: '45',
            r: '36',
            fill: 'none',
            stroke: '#111f16',
            strokeWidth: '9',
          }),
          React.createElement('circle', {
            cx: '45',
            cy: '45',
            r: '36',
            fill: 'none',
            stroke: color,
            strokeWidth: '9',
            strokeDasharray: arcFill.toFixed(1) + ' ' + circumf.toFixed(1),
            strokeDashoffset: '0',
            strokeLinecap: 'round',
            style: { transition: 'stroke-dasharray 1s ease' },
          }),
        ),
        React.createElement(
          'div',
          { className: 'bmi-ring-center' },
          React.createElement('div', { className: 'bmi-value' }, bmiFixed),
          React.createElement('div', { className: 'bmi-label-sm' }, 'BMI'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'bmi-category-wrap' },
        React.createElement('div', { className: 'bmi-category-name', style: { color } }, category),
        React.createElement('div', { className: 'bmi-category-desc' }, desc),
      ),
    ),
    React.createElement(
      'div',
      { className: 'bmi-scale' },
      React.createElement(
        'div',
        { className: 'bmi-scale-bar' },
        React.createElement('div', {
          className: 'bmi-scale-marker',
          style: { left: scalePct + '%', transition: 'left 0.8s ease' },
        }),
      ),
      React.createElement(
        'div',
        { className: 'bmi-scale-labels' },
        React.createElement('span', null, 'Under'),
        React.createElement('span', null, 'Normal'),
        React.createElement('span', null, 'Over'),
        React.createElement('span', null, 'Obese'),
      ),
    ),
    React.createElement(
      'div',
      { className: 'body-stats-grid' },
      React.createElement(
        'div',
        { className: 'body-stat-item' },
        React.createElement('div', { className: 'body-stat-label' }, 'Height'),
        React.createElement(
          'div',
          { className: 'body-stat-value' },
          h || '--',
          ' ',
          React.createElement('span', null, 'cm'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'body-stat-item' },
        React.createElement('div', { className: 'body-stat-label' }, 'Weight'),
        React.createElement(
          'div',
          { className: 'body-stat-value' },
          w || '--',
          ' ',
          React.createElement('span', null, 'kg'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'body-stat-item' },
        React.createElement('div', { className: 'body-stat-label' }, 'BMI Index'),
        React.createElement('div', { className: 'body-stat-value' }, bmiFixed),
      ),
      React.createElement(
        'div',
        { className: 'body-stat-item' },
        React.createElement('div', { className: 'body-stat-label' }, 'Ideal Range'),
        React.createElement(
          'div',
          { className: 'body-stat-value', style: { fontSize: 13 } },
          hasData ? idealLow + ' \u2013 ' + idealHigh + ' kg' : '-- kg',
        ),
      ),
    ),
  );
}
export { Dashboard as default };
