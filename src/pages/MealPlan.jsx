import { generateMealPlan, emptyMealPlan } from '../lib/plan-generation.js';
import { appliedMeal } from '../lib/portions.js';
import { localMealStorage as localStorage, sessionMealStorage as sessionStorage, readStoredJson } from '../lib/account-storage.js';
import { nutritionProfile } from '../../supabase/functions/_shared/nutrition.js';
import React from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import ProfileRequired from '../components/ProfileRequired';
import { isProfileComplete, personalizedCalorieTarget } from '../lib/profile-readiness';
import MealPlanTour from '../components/MealPlanTour';
import WhyButton from '../components/WhyButton';
import { mealReviewKey } from '../lib/meal-review';
import PortionOptimizerPanel, { OptimizeButton } from '../components/PortionOptimizerPanel';
import { scoreRecipe } from '../lib/seasonal';
import { SeasonBadge, IngSeasonTag, SeasonalAltBanner } from '../components/SeasonalBadges';
import {
  loadConstraintDefinitions,
  getActiveConstraints,
  getUnmatchedConstraints,
  checkRecipeViolations,
  canSelectRecipe,
} from '../lib/constraints';
import {
  applyDynamicRecipePrices,
  formatPrice,
  formatEstimatedPrice,
  pricingLabel,
} from '../lib/pricing';
import { isBudgetPriced, isAffordableMeal } from '../lib/meal-budget';
import { mealSuggestionService, selectRecipeFallback } from '../lib/meal-suggestions';
import PriceEstimateNotice from '../components/PriceEstimateNotice';
import { useIngredientPrices } from '../context/PriceContext';
import { ViolationBadge, ViolationDetail } from '../components/ConstraintWarnings';
import '../styles/mealplan.css';
import '../styles/priceopt.css';
import '../styles/constraints.css';
const SLOT_PRESETS = [
  { type: 'Breakfast', icon: '\u{1F305}', time: '7:00 AM' },
  { type: 'Brunch', icon: '\u{1F373}', time: '10:00 AM' },
  { type: 'Lunch', icon: '\u2600\uFE0F', time: '12:00 PM' },
  { type: 'Snack', icon: '\u{1F34E}', time: '3:00 PM' },
  { type: 'Dinner', icon: '\u{1F319}', time: '6:30 PM' },
  { type: 'Custom', icon: '\u270F\uFE0F', time: 'Your own' },
];
function getCalorieGoal(profile) {
  return personalizedCalorieTarget(profile);
}
function getIngredientQuantityLabel(ingredient, optimizedQuantity) {
  const hasQuantity = ingredient.quantity != null && ingredient.quantity !== '';
  if (!hasQuantity) return '\u2014';
  const quantity =
    optimizedQuantity != null && optimizedQuantity !== '' ? optimizedQuantity : ingredient.quantity;
  return String(quantity);
}
function getMealCompletionKey(date, slot, index) {
  const dateKey = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  return `${dateKey}:${index}:${slot.type}:${slot.mealId || 'empty'}`;
}
function MealPlan() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [savedRecipes, setRecipes] = useState([]);
  const { records: priceRecords, referenceData } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, priceRecords, referenceData || {}),
    [savedRecipes, priceRecords, referenceData],
  );
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [constraintDefinitions, setConstraintDefinitions] = useState({});
  const [constraintsReady, setConstraintsReady] = useState(false);
  const [currentWeekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDay] = useState(new Date().getDay());
  const [daySlots, setDaySlots] = useState({});
  const [completedMeals, setCompletedMeals] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('blane_completed_meals') || '{}');
    } catch {
      return {};
    }
  });
  const [groceryList, setGroceryList] = useState(() => readStoredJson(sessionStorage, 'blane_grocery', []));
  const [openOptimizerId, setOpenOptimizerId] = useState(null);
  const [appliedOptimizations, setAppliedOptimizations] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('blane_optimized_v2') || '{}');
    } catch {
      return {};
    }
  });
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [slotTypeChoice, setSlotTypeChoice] = useState(null);
  const [customSlotName, setCustomSlotName] = useState('');
  const [selectedRecipeForAdd, setSelectedRecipeForAdd] = useState('');
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapChoice, setSwapChoice] = useState(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [completionTarget, setCompletionTarget] = useState(null);
  useEffect(() => {
    if (!user?.id) return;
    loadProfile();
    if (recipes.length === 0) loadRecipes();
    loadConstraintDefinitions().then((definitions) => {
      if (definitions) { setConstraintDefinitions(definitions); setConstraintsReady(true); }
    });
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    setTourOpen(globalThis.localStorage.getItem(`blane_mealplan_tour_completed_${user.id}`) !== 'true');
  }, [user?.id]);
  useEffect(() => {
    localStorage.setItem('blane_meal_plan_day', String(selectedDayIndex));
    window.dispatchEvent(new Event('blane-meal-plan-updated'));
  }, [selectedDayIndex]);
  useEffect(() => {
    sessionStorage.setItem('blane_grocery', JSON.stringify(groceryList));
  }, [groceryList]);
  useEffect(() => {
    localStorage.setItem('blane_completed_meals', JSON.stringify(completedMeals));
  }, [completedMeals]);
  async function loadProfile() {
    if (!user) return;
    setProfileLoading(true);
    setProfileError(false);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;
      setProfile(data || {});
    } catch { setProfileError(true); }
    finally { setProfileLoading(false); }
  }
  async function loadRecipes() {
    setLoadingRecipes(true);
    const { data: recipesData, error: recipesErr } = await supabase
      .from('recipes')
      .select('*')
      .order('name');
    if (recipesErr) {
      console.error('Failed to load recipes:', recipesErr.message);
      setRecipes([]);
      setLoadingRecipes(false);
      return;
    }
    const { data: ingData } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .order('sort_order');
    const linkedFctIds = [...new Set((ingData || []).map((ing) => ing.fct_id).filter(Boolean))];
    let nutrientByFctId = {};
    if (linkedFctIds.length > 0) {
      const { data: nutrientRows, error: nutrientError } = await supabase
        .from('fnri_food_composition')
        .select('fct_id, energy_kcal, protein_g, total_fat_g, available_carbohydrate_g')
        .in('fct_id', linkedFctIds);
      if (!nutrientError && nutrientRows) {
        nutrientByFctId = Object.fromEntries(nutrientRows.map((row) => [row.fct_id, row]));
      }
    }
    const ingByRecipe = {};
    (ingData || []).forEach((ing) => {
      if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
      const quantity = ing.quantity ?? '';
      ingByRecipe[ing.recipe_id].push({
        name: ing.name || ing.ingredient_name || ing.food_name,
        fct_id: ing.fct_id,
        ingredient_name: ing.ingredient_name,
        food_name: ing.food_name,
        qty: quantity,
        quantity,
        grams: ing.grams,
        calories: nutrientByFctId[ing.fct_id]
          ? Math.round(
              ((Number(nutrientByFctId[ing.fct_id].energy_kcal) || 0) * (Number(ing.grams) || 0)) /
                100,
            )
          : null,
        status: ing.status || 'avail',
      });
    });
    const formatted = (recipesData || []).map((r) => {
      const servings = Number(r.servings) || 1;
      const recipeIngredients = (ingByRecipe[r.id] || []).map((ing) => {
        const nutrient = nutrientByFctId[ing.fct_id];
        const servingFactor = (Number(ing.grams) || 0) / (100 * servings);
        return {
          ...ing,
          protein: nutrient?.protein_g == null ? null : Number(nutrient.protein_g) * servingFactor,
          carbs:
            nutrient?.available_carbohydrate_g == null
              ? null
              : Number(nutrient.available_carbohydrate_g) * servingFactor,
          fats: nutrient?.total_fat_g == null ? null : Number(nutrient.total_fat_g) * servingFactor,
        };
      });
      return {
        id: r.id,
        emoji: r.emoji || '\u{1F372}',
        name: r.name,
        type: r.type,
        is_dessert: r.is_dessert === true,
        diet: r.diet_tags || [],
        goal: r.goal_tags || [],
        difficulty: r.difficulty || 'medium',
        cookTime: r.cook_time_min || 20,
        prep: `${r.cook_time_min || 20} min`,
        servings: r.servings || 1,
        kcal: r.kcal || 0,
        cost: r.cost || 0,
        protein: r.protein_g || 0,
        carbs: r.carbs_g || 0,
        fats: r.fats_g || 0,
        ingredients: recipeIngredients,
      };
    });
    setRecipes(formatted);
    setLoadingRecipes(false);
    const saved = localStorage.getItem('blane_meal_plan');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Object.keys(parsed).length > 0) {
          setDaySlots(parsed);
          return;
        }
      } catch (e) {
        console.error('Error parsing stored meal plan:', e);
      }
    }
    // Generate only after both profile and constraint metadata are available.
    setDaySlots({});
  }
  useEffect(() => {
    if (Object.keys(daySlots).length > 0) {
      localStorage.setItem('blane_meal_plan', JSON.stringify(daySlots));
      window.dispatchEvent(new Event('blane-meal-plan-updated'));
    }
  }, [daySlots]);
  useEffect(() => {
    const sync = (event) => {
      if (event?.key && !localStorage.matches(event.key, 'blane_meal_plan')) return;
      try {
        const plan = JSON.parse(localStorage.getItem('blane_meal_plan') || '{}');
        if (plan && typeof plan === 'object' && !Array.isArray(plan)) setDaySlots(plan);
      } catch {}
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function getMeal(id) {
    if (!id) return null;
    return recipes.find((m) => m.id === id || String(m.id) === String(id)) || null;
  }
  const eligibleRecipes = recipes.filter(r => canSelectRecipe(r, profile, constraintDefinitions, constraintsReady));
  useEffect(() => {
    if (!profile || !constraintsReady || loadingRecipes || localStorage.getItem('blane_meal_plan')) return;
    setDaySlots(isProfileComplete(profile) ? generateMealPlan(recipes, profile, constraintDefinitions, { ready: constraintsReady }) : emptyMealPlan());
  }, [profile, constraintsReady, loadingRecipes, recipes, constraintDefinitions]);
  function regeneratePlan() {
    if (!isProfileComplete(profile)) return;
    if (eligibleRecipes.length === 0) { alert('No recipes can be selected with the available dietary rules and ingredient data.'); return; }
    const newSlots = generateMealPlan(recipes, profile, constraintDefinitions, { ready: constraintsReady, random: true });
    setDaySlots(newSlots);
  }
  const slots = daySlots[selectedDayIndex] || [];
  const activeConstraints = getActiveConstraints(profile, constraintDefinitions);
  const today = new Date();
  const base = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;
  base.setDate(today.getDate() - dayOfWeek + currentWeekOffset * 7);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const weekEnd = new Date(base);
  weekEnd.setDate(base.getDate() + 6);
  const weekLabel =
    months[base.getMonth()] +
    ' ' +
    base.getDate() +
    ' \u2013 ' +
    months[weekEnd.getMonth()] +
    ' ' +
    weekEnd.getDate() +
    ', ' +
    weekEnd.getFullYear();
  const selectedDate = new Date(base);
  selectedDate.setDate(base.getDate() + ((selectedDayIndex + 6) % 7));
  const getDisplayedMeal = id => appliedMeal(getMeal(id), appliedOptimizations[id]);
  function exportWeekPlan() {
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const lines = ['=== BLANE WEEKLY MEAL PLAN ===', `Week of ${weekLabel}`, '', 'Prices are estimates in Philippine pesos. Actual store totals may vary.', ''];
    [1, 2, 3, 4, 5, 6, 0].forEach((dayIndex, index) => {
      lines.push(`--- ${dayNames[index]} ---`);
      const planned = daySlots[dayIndex] || [];
      if (!planned.length) lines.push('  No meals planned.');
      planned.forEach(slot => {
        const meal = getDisplayedMeal(slot.mealId);
        lines.push(meal
          ? `  [${slot.type} - ${slot.time || 'Meal'}] ${meal.name} (${meal.kcal} kcal, ${meal.protein}g P, ${formatEstimatedPrice(meal.cost)} · ${pricingLabel(meal)})`
          : `  [${slot.type}] No meal assigned`);
      });
      lines.push('');
    });
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const date = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    link.download = `BLANE_MealPlan_${date}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const totalKcal = slots.reduce((s, slot) => s + (getDisplayedMeal(slot.mealId)?.kcal || 0), 0);
  const totalCost = Math.round(slots.reduce((s, slot) => s + (getDisplayedMeal(slot.mealId)?.cost || 0), 0));
  const missingCosts = slots.some(
    (slot) => !getDisplayedMeal(slot.mealId) || getDisplayedMeal(slot.mealId).priceIncomplete,
  );
  const totalProtein = Math.round(
    slots.reduce((s, slot) => s + (getDisplayedMeal(slot.mealId)?.protein || 0), 0),
  );
  const calGoal = getCalorieGoal(profile);
  const dayPct = calGoal ? Math.min(Math.round((totalKcal / calGoal) * 100), 100) : 0;
  function removeSlot(idx) {
    setDaySlots((prev) => {
      const next = { ...prev };
      next[selectedDayIndex] = [...(next[selectedDayIndex] || [])];
      next[selectedDayIndex].splice(idx, 1);
      return next;
    });
  }
  function confirmAddSlot() {
    if (!slotTypeChoice) {
      alert('Please select a meal type.');
      return;
    }
    if (selectedRecipeForAdd && !canSelectRecipe(getMeal(selectedRecipeForAdd), profile, constraintDefinitions, constraintsReady)) { alert('This recipe cannot be checked against your dietary profile.'); return; }
    let type = slotTypeChoice;
    let time = SLOT_PRESETS.find((p) => p.type === type)?.time || '12:00 PM';
    if (type === 'Custom') {
      if (!customSlotName.trim()) {
        alert('Please enter a custom slot name.');
        return;
      }
      type = customSlotName.trim();
      time = 'Your own';
    }
    setDaySlots((prev) => {
      const next = { ...prev };
      next[selectedDayIndex] = [
        ...(next[selectedDayIndex] || []),
        { type, time, mealId: selectedRecipeForAdd || null },
      ];
      return next;
    });
    setAddSlotOpen(false);
    setSlotTypeChoice(null);
    setCustomSlotName('');
    setSelectedRecipeForAdd('');
  }
  function openSwap(mealOrSlot, slotIdx) {
    setSwapTarget({ meal: mealOrSlot, slotIdx });
    setSwapChoice(null);
    setSwapSearch('');
  }
  function confirmSwap() {
    if (!swapChoice) {
      alert('Please select a recipe.');
      return;
    }
    if (!canSelectRecipe(getMeal(swapChoice), profile, constraintDefinitions, constraintsReady)) { alert('This recipe conflicts with your profile or cannot be fully checked.'); return; }
    setDaySlots((prev) => {
      const next = { ...prev };
      const arr = [...(next[selectedDayIndex] || [])];
      arr[swapTarget.slotIdx] = { ...arr[swapTarget.slotIdx], mealId: swapChoice };
      next[selectedDayIndex] = arr;
      return next;
    });
    setSwapTarget(null);
  }
  function confirmMealCompletion() {
    if (!completionTarget) return;
    setCompletedMeals((previous) => {
      const next = { ...previous };
      if (completionTarget.action === 'undo') delete next[completionTarget.key];
      else next[completionTarget.key] = true;
      return next;
    });
    setCompletionTarget(null);
  }
  function addMealToGrocery(meal) {
    meal = meal && getDisplayedMeal(meal.id);
    if (!meal || !meal.ingredients) return;
    setGroceryList((prev) => {
      const filtered = prev.filter((g) => g.mealId !== meal.id);
      return [
        ...filtered,
        ...meal.ingredients.map((ing) => ({
          mealId: meal.id,
          name: ing.name,
          qty: ing.qty,
          checked: false,
        })),
      ];
    });
  }
  function addAllTodayToGrocery() {
    const todayMeals = slots.map((s) => getDisplayedMeal(s.mealId)).filter(Boolean);
    if (todayMeals.length === 0) return;
    setGroceryList((prev) => {
      let current = [...prev];
      todayMeals.forEach((meal) => {
        current = current.filter((g) => g.mealId !== meal.id);
        const newItems = meal.ingredients.map((ing) => ({
          mealId: meal.id,
          name: ing.name,
          qty: ing.qty,
          checked: false,
        }));
        current = [...current, ...newItems];
      });
      return current;
    });
  }
  function toggleGroceryChecked(idx) {
    setGroceryList((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item)),
    );
  }
  function removeGroceryItem(idx) {
    setGroceryList((prev) => prev.filter((_, i) => i !== idx));
  }
  function closeTour() {
    if (user?.id) {
      globalThis.localStorage.setItem(`blane_mealplan_tour_completed_${user.id}`, 'true');
    }
    setTourOpen(false);
  }
  const availableRecipesForAdd = slotTypeChoice
    ? eligibleRecipes.filter(
        (r) =>
          r.type === slotTypeChoice || slotTypeChoice === 'Custom' || slotTypeChoice === 'Brunch',
      )
    : eligibleRecipes;
  const filteredSwapRecipes = eligibleRecipes.filter((recipe) => {
    if (swapTarget?.meal?.id && recipe.id === swapTarget.meal.id) return false;
    const query = swapSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      recipe.name,
      recipe.type,
      ...(recipe.ingredients || []).map((ingredient) => ingredient.name),
    ].some((value) => value?.toLowerCase().includes(query));
  });
  if (profileLoading || profileError) {
    return React.createElement(React.Fragment, null,
      React.createElement(Navbar, null),
      React.createElement(ProfileRequired, { loading: profileLoading, error: profileError, onRetry: loadProfile }));
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Navbar, null),
    React.createElement(MealPlanTour, { isOpen: tourOpen, onClose: closeTour }),
    React.createElement(
      'main',
      { className: 'mp-main' },
      React.createElement(
        'div',
        { className: 'mp-content' },
        React.createElement(
          'div',
          { className: 'mp-page-header', 'data-mealplan-tour': 'header' },
          React.createElement(
            'div',
            null,
            React.createElement('h1', { className: 'mp-page-title' }, 'Meal Plan'),
          ),
          React.createElement(
            'div',
            { className: 'mp-header-actions' },
            React.createElement(
              'button',
              { className: 'mp-tour-trigger', type: 'button', onClick: () => setTourOpen(true) },
              React.createElement('span', { 'aria-hidden': 'true' }, '\u24D8'),
              ' Take a tour',
            ),
            React.createElement(
              'button',
              { className: 'mp-btn mp-btn-outline', type: 'button', onClick: exportWeekPlan, disabled: loadingRecipes || !profile },
              'Export Week',
            ),
            isProfileComplete(profile)
              ? React.createElement('button', { className: 'mp-btn mp-btn-primary', onClick: regeneratePlan }, 'Regenerate Plan')
              : React.createElement(Link, { to: '/profile', className: 'mp-btn mp-btn-primary' }, 'Update profile for planning'),
          ),
        ),
        React.createElement(
          'div',
          { className: 'week-nav', 'data-mealplan-tour': 'week' },
          React.createElement(
            'button',
            { className: 'week-arrow', onClick: () => setWeekOffset((o) => o - 1) },
            '\u2039',
          ),
          React.createElement('span', { className: 'week-label' }, weekLabel),
          React.createElement(
            'div',
            { className: 'week-days' },
            Array.from({ length: 7 }, (_, i) => {
              const d = new Date(base);
              d.setDate(base.getDate() + i);
              const jsDay = d.getDay();
              const isToday = d.toDateString() === today.toDateString();
              const isActive = jsDay === selectedDayIndex;
              const dayMeals = daySlots[jsDay] || [];
              const hasMeals = dayMeals.some((s) => s.mealId);
              const hasCompletedMeals = dayMeals.some(
                (slot, slotIdx) => completedMeals[getMealCompletionKey(d, slot, slotIdx)],
              );
              return React.createElement(
                'button',
                {
                  key: i,
                  className:
                    'week-day-btn' +
                    (isActive ? ' active' : '') +
                    (isToday ? ' today' : '') +
                    (hasMeals ? ' has-meals' : '') +
                    (hasCompletedMeals ? ' has-completed' : ''),
                  onClick: () => setSelectedDay(jsDay),
                },
                React.createElement('span', { className: 'day-name' }, days[i]),
                React.createElement('span', { className: 'day-num' }, d.getDate()),
                React.createElement('span', { className: 'day-dot' }),
              );
            }),
          ),
          React.createElement(
            'button',
            { className: 'week-arrow', onClick: () => setWeekOffset((o) => o + 1) },
            '\u203A',
          ),
        ),
        React.createElement(
          'div',
          { className: 'day-view' },
          React.createElement(
            'div',
            { className: 'meal-slots-col' },
            React.createElement(
              'div',
              { className: 'day-summary-bar', 'data-mealplan-tour': 'summary' },
              React.createElement(
                'div',
                { className: 'day-summary-item' },
                React.createElement('span', { className: 'day-summary-label' }, 'Calories'),
                React.createElement(
                  'span',
                  { className: 'day-summary-value green' },
                  totalKcal,
                  ' ',
                  React.createElement(
                    'small',
                    { style: { fontSize: 13, color: '#4d6e5a', fontWeight: 400 } },
                    calGoal ? `/ ${calGoal} kcal` : 'kcal · Profile needed for target',
                  ),
                ),
              ),
              React.createElement('div', { className: 'day-summary-divider' }),
              React.createElement(
                'div',
                { className: 'day-summary-item' },
                React.createElement('span', { className: 'day-summary-label' }, 'Protein'),
                React.createElement(
                  'span',
                  { className: 'day-summary-value' },
                  totalProtein,
                  React.createElement(
                    'small',
                    { style: { fontSize: 12, color: '#4d6e5a', fontWeight: 400 } },
                    'g',
                  ),
                ),
              ),
              React.createElement('div', { className: 'day-summary-divider' }),
              React.createElement(
                'div',
                { className: 'day-summary-item' },
                React.createElement('span', { className: 'day-summary-label' }, 'Est. Cost'),
                React.createElement(
                  'span',
                  { className: 'day-summary-value yellow' },
                  '\u20B1',
                  totalCost,
                ),
              ),
              React.createElement('div', { className: 'day-summary-divider' }),
              React.createElement(
                'div',
                { className: 'day-cal-bar-wrap' },
                React.createElement(
                  'div',
                  { className: 'day-cal-bar-label' },
                  React.createElement('span', null, 'Progress'),
                  React.createElement('span', null, calGoal ? `${dayPct}%` : 'Profile needed'),
                ),
                React.createElement(
                  'div',
                  { className: 'day-cal-bar-bg' },
                  React.createElement('div', {
                    className: 'day-cal-bar-fill',
                    style: { width: dayPct + '%' },
                  }),
                ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'meal-slots-list', 'data-mealplan-tour': 'meal-slots' },
              loadingRecipes
                ? React.createElement(
                    'div',
                    { className: 'empty-slot' },
                    'Loading recipes from database\u2026',
                  )
                : slots.length === 0
                  ? React.createElement(
                      'div',
                      { className: 'empty-slot' },
                      React.createElement(
                        'span',
                        { className: 'empty-slot-icon' },
                        '\u{1F37D}\uFE0F',
                      ),
                      'No meals planned yet. Add a slot below!',
                    )
                  : slots.map((slot, idx) =>
                      React.createElement(SlotCard, {
                        key: idx,
                        slot,
                        idx,
                        completed: Boolean(
                          completedMeals[getMealCompletionKey(selectedDate, slot, idx)],
                        ),
                        onToggleComplete: () => {
                          const key = getMealCompletionKey(selectedDate, slot, idx);
                          setCompletionTarget({
                            key,
                            action: completedMeals[key] ? 'undo' : 'complete',
                            mealName: getMeal(slot.mealId)?.name || slot.type,
                          });
                        },
                        profile,
                        appliedOptimization: appliedOptimizations[slot.mealId],
                        onPortionApplied: (mealId, result) =>
                          setAppliedOptimizations((prev) => ({
                            ...prev,
                            [mealId]: {
                              scaleFactor: result.scaleFactor,
                              ingredients: result.ingredients,
                              optimizedKcal: result.optimizedKcal,
                            },
                          })),
                        onOriginalMeal: (mealId) =>
                          setAppliedOptimizations((prev) => {
                            const next = { ...prev };
                            delete next[mealId];
                            return next;
                          }),
                        activeConstraints,
                        constraintDefinitions,
                        getMeal,
                        totalMealsToday: slots.length,
                        groceryList,
                        openOptimizerId,
                        onSetOpenOptimizer: setOpenOptimizerId,
                        onRemove: () => removeSlot(idx),
                        onSwap: openSwap,
                        onAddGrocery: addMealToGrocery,
                      }),
                    ),
            ),
            React.createElement(
              'button',
              {
                className: 'add-slot-btn',
                'data-mealplan-tour': 'add-slot',
                onClick: () => setAddSlotOpen(true),
              },
              React.createElement(
                'svg',
                {
                  width: '16',
                  height: '16',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2.5',
                  strokeLinecap: 'round',
                },
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add meal slot',
            ),
            React.createElement(PriceOptimizerPanel, { meals: eligibleRecipes, profile }),
          ),
          React.createElement(
            'div',
            { className: 'grocery-panel', 'data-mealplan-tour': 'grocery-list' },
            React.createElement(
              'div',
              { className: 'grocery-panel-header' },
              React.createElement(
                'div',
                { className: 'grocery-panel-title-row' },
                React.createElement('div', { className: 'grocery-panel-icon' }, '\u{1F6D2}'),
                React.createElement('span', { className: 'grocery-panel-title' }, 'Grocery List'),
                React.createElement(
                  'span',
                  { className: 'grocery-count-badge' },
                  groceryList.length,
                ),
              ),
              React.createElement(
                'button',
                { className: 'grocery-clear-btn', onClick: () => setGroceryList([]) },
                'Clear all',
              ),
            ),
            React.createElement(
              'div',
              { style: { marginBottom: 12 } },
              React.createElement(
                'button',
                {
                  className: 'mp-btn mp-btn-outline',
                  style: {
                    width: '100%',
                    justifyContent: 'center',
                    fontSize: 13,
                    padding: '8px 12px',
                  },
                  onClick: addAllTodayToGrocery,
                },
                "+ Add all today's meals to list",
              ),
            ),
            React.createElement(
              'div',
              { className: 'grocery-list' },
              groceryList.length === 0
                ? React.createElement(
                    'div',
                    { className: 'grocery-empty' },
                    React.createElement('span', { className: 'grocery-empty-icon' }, '\u{1F6D2}'),
                    'No items yet. Add meals to build your list.',
                  )
                : groceryList.map((item, i) =>
                    React.createElement(
                      'div',
                      { key: i, className: 'grocery-item' + (item.checked ? ' checked' : '') },
                      React.createElement(
                        'div',
                        { className: 'grocery-checkbox', onClick: () => toggleGroceryChecked(i) },
                        item.checked ? '\u2713' : '',
                      ),
                      React.createElement('span', { className: 'grocery-item-name' }, item.name),
                      React.createElement('span', { className: 'grocery-item-qty' }, item.qty),
                      React.createElement(
                        'button',
                        { className: 'grocery-remove-btn', onClick: () => removeGroceryItem(i) },
                        '\u2715',
                      ),
                    ),
                  ),
            ),
            React.createElement(
              'div',
              { className: 'grocery-cost-total' },
              React.createElement(
                'span',
                { className: 'grocery-cost-label' },
                missingCosts ? 'Known costs only (incomplete)' : "Est. today's total",
              ),
              React.createElement(
                'span',
                { className: 'grocery-cost-value' },
                formatEstimatedPrice(totalCost),
              ),
            ),
            React.createElement(
              'button',
              {
                className: 'mp-btn mp-btn-primary',
                style: { width: '100%', justifyContent: 'center' },
                onClick: () => {
                  if (groceryList.length === 0) {
                    alert('Grocery list is empty.');
                    return;
                  }
                  const text = groceryList
                    .map((g) => `[${g.checked ? 'x' : ' '}] ${g.name} (${g.qty})`)
                    .join('\n');
                  const blob = new Blob(
                    [
                      `BLANE GROCERY LIST

${text}`,
                    ],
                    { type: 'text/plain' },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'BLANE_Grocery_List.txt';
                  a.click();
                  URL.revokeObjectURL(url);
                },
              },
              'Download List',
            ),
          ),
        ),
      ),
    ),
    addSlotOpen &&
      React.createElement(
        'div',
        {
          className: 'slot-modal-overlay active',
          onClick: (e) => {
            if (e.target === e.currentTarget) setAddSlotOpen(false);
          },
        },
        React.createElement(
          'div',
          { className: 'slot-modal', style: { maxWidth: 440 } },
          React.createElement(
            'button',
            { className: 'slot-modal-close', onClick: () => setAddSlotOpen(false) },
            '\u2715',
          ),
          React.createElement('div', { className: 'slot-modal-title' }, 'Add Meal Slot'),
          React.createElement(
            'div',
            { className: 'slot-type-grid' },
            SLOT_PRESETS.map((p) =>
              React.createElement(
                'div',
                {
                  key: p.type,
                  className: 'slot-type-option' + (slotTypeChoice === p.type ? ' selected' : ''),
                  onClick: () => setSlotTypeChoice(p.type),
                },
                React.createElement('span', { className: 'slot-type-option-icon' }, p.icon),
                React.createElement('span', { className: 'slot-type-option-label' }, p.type),
                React.createElement('span', { className: 'slot-type-option-time' }, p.time),
              ),
            ),
          ),
          slotTypeChoice === 'Custom' &&
            React.createElement(
              'div',
              { className: 'slot-custom-input-wrap show' },
              React.createElement('label', { className: 'form-label' }, 'Custom slot name'),
              React.createElement('input', {
                className: 'form-input',
                value: customSlotName,
                onChange: (e) => setCustomSlotName(e.target.value),
                placeholder: 'e.g. Pre-workout, Late night...',
              }),
            ),
          slotTypeChoice &&
            React.createElement(
              'div',
              { style: { marginTop: 14, marginBottom: 14 } },
              React.createElement(
                'label',
                {
                  className: 'form-label',
                  style: { fontSize: 12, color: '#8aab96', marginBottom: 6, display: 'block' },
                },
                'Assign Recipe (Optional)',
              ),
              React.createElement(
                'select',
                {
                  className: 'form-input',
                  style: {
                    width: '100%',
                    background: '#111f16',
                    color: '#e8f5ee',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(45, 220, 122, 0.2)',
                  },
                  value: selectedRecipeForAdd,
                  onChange: (e) => setSelectedRecipeForAdd(e.target.value),
                },
                React.createElement('option', { value: '' }, '-- Choose a recipe from database --'),
                (availableRecipesForAdd.length > 0 ? availableRecipesForAdd : recipes).map((r) =>
                  React.createElement(
                    'option',
                    { key: r.id, value: r.id },
                    r.emoji,
                    ' ',
                    r.name,
                    ' (',
                    r.kcal,
                    ' kcal \xB7 ',
                    formatEstimatedPrice(r.cost),
                    ')',
                  ),
                ),
              ),
            ),
          React.createElement(
            'button',
            {
              className: 'mp-btn mp-btn-primary',
              style: { width: '100%', justifyContent: 'center', marginTop: 8 },
              onClick: confirmAddSlot,
            },
            'Add Slot',
          ),
        ),
      ),
    swapTarget &&
      React.createElement(
        'div',
        {
          className: 'swap-modal-overlay active',
          onClick: (e) => {
            if (e.target === e.currentTarget) setSwapTarget(null);
          },
        },
        React.createElement(
          'div',
          { className: 'swap-modal', style: { maxWidth: 520 } },
          React.createElement(
            'button',
            { className: 'swap-close', onClick: () => setSwapTarget(null) },
            '\u2715',
          ),
          React.createElement('div', { className: 'swap-modal-label' }, 'Choose Recipe'),
          React.createElement(
            'div',
            { className: 'swap-modal-title' },
            swapTarget.meal?.name
              ? `Swapping: ${swapTarget.meal.name}`
              : `Select recipe for ${swapTarget.meal?.type || 'slot'}`,
          ),
          React.createElement(
            'div',
            { className: 'swap-search-wrap' },
            React.createElement(
              'span',
              { className: 'swap-search-icon', 'aria-hidden': 'true' },
              '\u{1F50D}',
            ),
            React.createElement('input', {
              className: 'swap-search-input',
              type: 'search',
              'aria-label': 'Search recipes',
              placeholder: 'Search by recipe, meal type, or ingredient...',
              value: swapSearch,
              onChange: (event) => setSwapSearch(event.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'swap-options', style: { maxHeight: 360, overflowY: 'auto' } },
            filteredSwapRecipes.length > 0
              ? filteredSwapRecipes.map((alt) =>
                  React.createElement(
                    'div',
                    {
                      key: alt.id,
                      className: 'swap-option-card' + (swapChoice === alt.id ? ' selected' : ''),
                      onClick: () => setSwapChoice(alt.id),
                      style: {
                        cursor: 'pointer',
                        padding: 12,
                        borderRadius: 12,
                        marginBottom: 8,
                        background: swapChoice === alt.id ? 'rgba(45, 220, 122, 0.12)' : '#111f16',
                        border:
                          swapChoice === alt.id
                            ? '1px solid #2ddc7a'
                            : '1px solid rgba(45, 220, 122, 0.1)',
                      },
                    },
                    React.createElement(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: 12 } },
                      React.createElement(
                        'div',
                        { className: 'swap-option-emoji', style: { fontSize: 24 } },
                        alt.emoji,
                      ),
                      React.createElement(
                        'div',
                        { className: 'swap-option-info', style: { flex: 1 } },
                        React.createElement(
                          'div',
                          {
                            className: 'swap-option-name',
                            style: { fontWeight: 600, color: '#e8f5ee' },
                          },
                          alt.name,
                        ),
                        React.createElement(
                          'div',
                          {
                            className: 'swap-option-meta',
                            style: { fontSize: 12, color: '#8aab96' },
                          },
                          React.createElement('span', null, alt.type),
                          ' \xA0\xB7\xA0 ',
                          React.createElement('span', null, alt.kcal, ' kcal'),
                          ' \xA0\xB7\xA0 ',
                          alt.protein,
                          'g protein \xA0\xB7\xA0 ',
                          alt.prep,
                        ),
                      ),
                      React.createElement(
                        'div',
                        {
                          className: 'swap-option-cost',
                          style: { color: '#fbbf24', fontWeight: 600 },
                        },
                        formatEstimatedPrice(alt.cost),
                      ),
                    ),
                  ),
                )
              : React.createElement(
                  'p',
                  { className: 'swap-empty-state', role: 'status' },
                  'No recipes match your search.',
                ),
          ),
          React.createElement(
            'button',
            {
              className: 'mp-btn mp-btn-primary swap-confirm-btn',
              style: { width: '100%', justifyContent: 'center', marginTop: 12 },
              onClick: confirmSwap,
            },
            'Confirm Selection',
          ),
        ),
      ),
    completionTarget &&
      React.createElement(
        'div',
        {
          className: 'completion-modal-overlay',
          onClick: (event) => {
            if (event.target === event.currentTarget) setCompletionTarget(null);
          },
        },
        React.createElement(
          'div',
          {
            className: 'completion-modal',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'completion-modal-title',
          },
          React.createElement(
            'div',
            { className: 'completion-modal-icon', 'aria-hidden': 'true' },
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
              React.createElement('path', { d: 'M5 12l4 4L19 6' }),
            ),
          ),
          React.createElement(
            'div',
            { className: 'completion-modal-title', id: 'completion-modal-title' },
            completionTarget.action === 'undo' ? 'Undo finished meal?' : 'Mark meal as finished?',
          ),
          React.createElement(
            'p',
            { className: 'completion-modal-copy' },
            completionTarget.action === 'undo'
              ? 'Remove the finished status from'
              : 'Did you finish eating',
            ' ',
            React.createElement('strong', null, completionTarget.mealName),
            '?',
          ),
          React.createElement(
            'div',
            { className: 'completion-modal-actions' },
            React.createElement(
              'button',
              {
                className: 'mp-btn mp-btn-outline',
                type: 'button',
                onClick: () => setCompletionTarget(null),
              },
              'Cancel',
            ),
            React.createElement(
              'button',
              {
                className: 'mp-btn mp-btn-primary',
                type: 'button',
                onClick: confirmMealCompletion,
              },
              completionTarget.action === 'undo' ? 'Yes, undo' : 'Yes, I finished',
            ),
          ),
        ),
      ),
  );
}
function PriceOptimizerPanel({ meals = [], profile }) {
  const { records: priceRecords, referenceData } = useIngredientPrices();
  const [dailyBudget, setDailyBudget] = useState(200);
  const [appliedBudget, setAppliedBudget] = useState(200);
  const [sortMode, setSortMode] = useState('cost');
  const [filterOver, setFilterOver] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [suggestionType, setSuggestionType] = useState('Lunch');
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [suggestionNotice, setSuggestionNotice] = useState('');
  const suggestionRequest = useRef(0);
  useEffect(() => {
    suggestionRequest.current += 1;
    setSuggestion(null);
    setSuggestionNotice('');
    setSuggestionError('');
    setSuggestionLoading(false);
    return () => {
      suggestionRequest.current += 1;
    };
  }, [profile, appliedBudget, suggestionType]);
  const liveSuggestion = useMemo(
    () =>
      suggestion
        ? applyDynamicRecipePrices([suggestion], priceRecords, referenceData || {})[0]
        : null,
    [suggestion, priceRecords, referenceData],
  );
  const perMeal = appliedBudget / 4;
  const sortedMeals = useMemo(() => {
    const list = [...meals];
    if (sortMode === 'cost') {
      return list.sort(
        (a, b) => (isBudgetPriced(a) ? a.cost : Infinity) - (isBudgetPriced(b) ? b.cost : Infinity),
      );
    }
    return list.sort(
      (a, b) =>
        (isBudgetPriced(b) && b.cost > 0 ? b.kcal / b.cost : 0) -
        (isBudgetPriced(a) && a.cost > 0 ? a.kcal / a.cost : 0),
    );
  }, [sortMode, meals]);
  const visibleMeals = filterOver
    ? sortedMeals.filter((meal) => isAffordableMeal(meal, perMeal))
    : sortedMeals;
  const affordableCount = sortedMeals.filter((meal) => isAffordableMeal(meal, perMeal)).length;
  const unverifiedCount = sortedMeals.filter((meal) => !isBudgetPriced(meal)).length;
  const cheapestDay = computeCheapestDay(meals, perMeal);
  async function suggestMeal() {
    if (!isProfileComplete(profile)) { setSuggestionError('Complete your profile to receive personalized meal suggestions.'); return; }
    const requestId = ++suggestionRequest.current;
    setSuggestion(null);
    setSuggestionLoading(true);
    setSuggestionError('');
    setSuggestionNotice('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in to get a personalized FNRI meal suggestion.');
      const definitions = await loadConstraintDefinitions();
      if (!definitions || getUnmatchedConstraints(profile, definitions).length) {
        throw new Error(
          'Your dietary preferences could not be fully checked. Please check your health profile before requesting a suggestion.',
        );
      }
      const active = getActiveConstraints(profile, definitions);
      const isAllowed = (meal) =>
        canSelectRecipe(meal, profile, definitions);
      const priceMeal = (meal) =>
        applyDynamicRecipePrices([meal], priceRecords, referenceData || {})[0];
      const validate = (meal) =>
        meal.type === suggestionType &&
        isAffordableMeal(priceMeal(meal), perMeal) &&
        isAllowed(meal);
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/optimize-meal`;
      const result = await mealSuggestionService.get({
        key: JSON.stringify({
          user: session.user.id,
          profile,
          budget: perMeal,
          mealType: suggestionType,
          definitions,
        }),
        validate,
        request: async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12e3);
          try {
            const response = await fetch(functionUrl, {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                mode: 'suggest',
                profile: nutritionProfile(profile),
                budget: perMeal,
                mealType: suggestionType,
              }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              const error = new Error(payload.error || 'AI temporarily unavailable.');
              error.status = response.status;
              throw error;
            }
            return {
              ...payload,
              type: suggestionType,
              servings: 1,
              ingredients: (payload.ingredients || []).map((ing) => ({
                ...ing,
                quantity: ing.quantity,
              })),
            };
          } finally {
            clearTimeout(timeout);
          }
        },
        fallback: () => {
          const meal = selectRecipeFallback(
            applyDynamicRecipePrices(meals, priceRecords, referenceData || {}),
            {
            mealType: suggestionType,
            budget: perMeal,
            isAllowed,
            },
          );
          return (
            meal && {
              ...meal,
              mealType: suggestionType,
              source: 'Existing recipe \xB7 fallback',
              reason:
                'Selected from your existing recipes using current sourced prices and your dietary preferences. No AI generation was used.',
            }
          );
        },
      });
      if (requestId !== suggestionRequest.current) return;
      const priced = priceMeal(result.meal);
      setSuggestion({ ...result.meal, ...priced });
      setSuggestionNotice(
        result.delivery === 'cached'
          ? 'Reused a recent suggestion; ingredient prices have been checked again.'
          : result.delivery === 'fallback'
            ? 'AI is temporarily unavailable or could not provide a suitable meal. Showing an existing recipe instead.'
            : 'AI suggestion checked against current ingredient prices and dietary rules.',
      );
    } catch (error) {
      if (requestId === suggestionRequest.current) setSuggestionError(error.message);
    } finally {
      if (requestId === suggestionRequest.current) setSuggestionLoading(false);
    }
  }
  function applyBudget() {
    const nextBudget = Math.max(50, Math.min(2e3, Number(dailyBudget) || 200));
    setDailyBudget(nextBudget);
    setAppliedBudget(nextBudget);
    setFilterOver(true);
    setSuggestion(null);
    setSuggestionError('');
  }
  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }
  function buildSubSuggestion(meal) {
    const ingredients = meal.ingredients || [];
    if (!ingredients.length) {
      return React.createElement(
        'div',
        { className: 'po-sub-suggestion' },
        React.createElement('span', { className: 'po-sub-suggestion-icon' }, '\u{1F4CD}'),
        React.createElement(
          'div',
          { className: 'po-sub-suggestion-text' },
          'Shop at local palengke or talipapa for better value on this meal.',
        ),
      );
    }
    const expensiveIngredient = ingredients
      .filter((ing) => ing.cost !== null)
      .sort((a, b) => b.cost - a.cost)[0];
    if (!expensiveIngredient) {
      return React.createElement(
        'div',
        { className: 'po-sub-suggestion' },
        React.createElement('span', { className: 'po-sub-suggestion-icon' }, '\u{1F4CD}'),
        React.createElement(
          'div',
          { className: 'po-sub-suggestion-text' },
          'Shop at local palengke or talipapa for better value on this meal.',
        ),
      );
    }
    return React.createElement(
      'div',
      { className: 'po-sub-suggestion' },
      React.createElement('span', { className: 'po-sub-suggestion-icon' }, '\u{1F4A1}'),
      React.createElement(
        'div',
        { className: 'po-sub-suggestion-text' },
        'Keep this meal under budget by using a local substitute for ',
        React.createElement('strong', null, expensiveIngredient.name),
        ' when it is cheaper at nearby markets.',
      ),
      React.createElement('div', { className: 'po-sub-saving' }, 'Save on local pricing'),
    );
  }
  return React.createElement(
    'div',
    { className: 'po-panel', 'data-mealplan-tour': 'price-optimizer' },
    React.createElement(
      'div',
      { className: 'po-header' },
      React.createElement(
        'div',
        { className: 'po-header-left' },
        React.createElement('div', { className: 'po-header-icon' }, '\u{1F4B8}'),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'po-title' }, 'Price-Aware Meal Optimizer'),
          React.createElement(
            'div',
            { className: 'po-sub' },
            'Shows sourced meal estimates within your budget. Prices update automatically.',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { style: { padding: '0 24px' } },
      React.createElement(PriceEstimateNotice, null),
      React.createElement(
        'p',
        { className: 'price-estimate-note' },
        'Meal estimates are per serving. Raw estimates exclude cooking yield and preparation costs. Base-only subtotals and missing prices are excluded from affordability results.',
      ),
      unverifiedCount > 0 &&
        React.createElement(
          'p',
          { className: 'price-estimate-note' },
          unverifiedCount,
          ' meals have incomplete or unverified prices and are excluded from affordable results. View all meals to inspect their ingredient sources.',
        ),
    ),
    React.createElement(
      'div',
      { className: 'po-budget-row' },
      React.createElement(
        'div',
        { className: 'po-budget-input-wrap' },
        React.createElement('span', { className: 'po-currency-prefix' }, '\u20B1'),
        React.createElement('input', {
          className: 'po-budget-input',
          type: 'number',
          value: dailyBudget,
          min: 50,
          max: 2e3,
          step: 10,
          onChange: (event) => setDailyBudget(parseInt(event.target.value, 10) || 200),
        }),
      ),
      React.createElement('span', { className: 'po-budget-label' }, 'Budget'),
      React.createElement(
        'div',
        { className: 'po-per-meal-chip' },
        React.createElement('strong', null, '\u20B1', perMeal.toFixed(2)),
        ' / meal',
      ),
      React.createElement(
        'button',
        { className: 'po-apply-btn', type: 'button', onClick: applyBudget },
        'Apply Budget',
      ),
    ),
    React.createElement(
      'div',
      { className: 'po-ai-suggest-row' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { className: 'po-ai-suggest-title' },
          'Suggest an affordable meal',
        ),
        React.createElement(
          'div',
          { className: 'po-ai-suggest-sub' },
          'Recent suggestions are reused for 15 minutes. Existing recipes are used when AI is unavailable.',
        ),
      ),
      React.createElement(
        'select',
        {
          value: suggestionType,
          onChange: (event) => setSuggestionType(event.target.value),
          'aria-label': 'Suggested meal type',
        },
        React.createElement('option', null, 'Breakfast'),
        React.createElement('option', null, 'Lunch'),
        React.createElement('option', null, 'Dinner'),
        React.createElement('option', null, 'Snack'),
      ),
      isProfileComplete(profile)
        ? React.createElement('button', { className: 'po-apply-btn', type: 'button', onClick: suggestMeal, disabled: suggestionLoading }, suggestionLoading ? 'Finding a meal...' : 'Suggest a meal')
        : React.createElement(Link, { className: 'po-apply-btn', to: '/profile' }, 'Update profile for suggestions'),
    ),
    suggestionError &&
      React.createElement('div', { className: 'po-ai-suggest-error' }, suggestionError),
    suggestionNotice &&
      React.createElement(
        'p',
        { className: 'meal-action-status', role: 'status' },
        suggestionNotice,
      ),
    liveSuggestion &&
      !isAffordableMeal(liveSuggestion, perMeal) &&
      React.createElement(
        'div',
        { className: 'po-ai-suggest-error', role: 'status' },
        'The suggestion no longer has a complete sourced estimate within your current budget. Choose an affordable meal below or request another suggestion.',
      ),
    liveSuggestion &&
      isAffordableMeal(liveSuggestion, perMeal) &&
      React.createElement(
        'div',
        { className: 'po-ai-suggestion' },
        React.createElement(
          'div',
          { className: 'po-ai-suggestion-heading' },
          React.createElement(
            'div',
            null,
            React.createElement('strong', null, suggestion.name),
            React.createElement(
              'span',
              null,
              suggestion.mealType,
              ' \xB7 ',
              formatEstimatedPrice(liveSuggestion.cost),
              ' (',
              pricingLabel(liveSuggestion),
              ') \xB7 ',
              suggestion.kcal,
              ' kcal',
            ),
          ),
          React.createElement('span', { className: 'po-ai-source' }, suggestion.source),
        ),
        React.createElement('p', null, suggestion.reason),
        React.createElement(
          'div',
          { className: 'po-ai-macros' },
          suggestion.protein,
          'g protein \xB7 ',
          suggestion.carbs,
          'g carbs \xB7 ',
          suggestion.fats,
          'g fat',
        ),
        React.createElement(
          'div',
          { className: 'po-ai-ingredients' },
          (suggestion.ingredients || []).map((ingredient, index) =>
            React.createElement(
              'span',
              { key: `${ingredient.fct_id || ingredient.name}-${index}` },
              ingredient.quantity,
              ' ',
              ingredient.name,
            ),
          ),
        ),
      ),
    React.createElement(
      'div',
      { className: 'po-summary-bar' },
      React.createElement(
        'div',
        { className: 'po-summary-item' },
        React.createElement('div', { className: 'po-summary-label' }, 'Daily Budget'),
        React.createElement(
          'div',
          { className: 'po-summary-value yellow' },
          '\u20B1',
          appliedBudget,
        ),
      ),
      React.createElement('div', { className: 'po-summary-divider' }),
      React.createElement(
        'div',
        { className: 'po-summary-item' },
        React.createElement('div', { className: 'po-summary-label' }, 'Per Meal'),
        React.createElement(
          'div',
          { className: 'po-summary-value yellow' },
          '\u20B1',
          perMeal.toFixed(2),
        ),
      ),
      React.createElement('div', { className: 'po-summary-divider' }),
      React.createElement(
        'div',
        { className: 'po-summary-item' },
        React.createElement('div', { className: 'po-summary-label' }, 'Affordable Meals'),
        React.createElement(
          'div',
          { className: 'po-summary-value green' },
          affordableCount,
          ' / ',
          meals.length,
        ),
      ),
      React.createElement('div', { className: 'po-summary-divider' }),
      React.createElement(
        'div',
        { className: 'po-summary-item' },
        React.createElement('div', { className: 'po-summary-label' }, 'Cheapest Full Day'),
        React.createElement(
          'div',
          {
            className: `po-summary-value ${cheapestDay !== null && cheapestDay <= appliedBudget ? 'green' : 'red'}`,
          },
          formatEstimatedPrice(cheapestDay),
        ),
      ),
      React.createElement('div', { className: 'po-summary-divider' }),
      React.createElement(
        'div',
        { className: 'po-budget-progress' },
        React.createElement(
          'div',
          { className: 'po-budget-bar-labels' },
          React.createElement('span', null, 'Cheapest day cost'),
          React.createElement(
            'span',
            null,
            cheapestDay === null
              ? 'Incomplete prices'
              : `${Math.round((cheapestDay / appliedBudget) * 100)}%`,
          ),
        ),
        React.createElement(
          'div',
          { className: 'po-budget-bar-bg' },
          React.createElement('div', {
            className: 'po-budget-bar-fill',
            style: {
              width: `${Math.min(Math.round((cheapestDay / appliedBudget) * 100), 100)}%`,
              background: cheapestDay <= appliedBudget ? '#2ddc7a' : '#f87171',
            },
          }),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'po-controls' },
      React.createElement('span', { className: 'po-sort-label' }, 'Sort by:'),
      React.createElement(
        'button',
        {
          type: 'button',
          className: `po-sort-btn ${sortMode === 'cost' ? 'active' : ''}`,
          onClick: () => setSortMode('cost'),
        },
        '\u20B1 Price',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: `po-sort-btn ${sortMode === 'kcal_per_peso' ? 'active' : ''}`,
          onClick: () => setSortMode('kcal_per_peso'),
        },
        '\u26A1 Best Value',
      ),
      React.createElement(
        'span',
        { className: 'po-count-badge' },
        React.createElement('span', null, visibleMeals.length),
        ' meals',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: `po-filter-toggle ${filterOver ? 'active' : ''}`,
          onClick: () => setFilterOver((prev) => !prev),
        },
        filterOver ? 'View all meals' : 'Affordable meals only',
      ),
    ),
    React.createElement(
      'div',
      { className: 'po-meals-list' },
      !visibleMeals.length &&
        React.createElement(
          'div',
          { className: 'po-ai-suggest-error', role: 'status' },
          'No meals with complete, verified source estimates fit your \u20B1',
          perMeal.toFixed(2),
          ' per-meal budget yet. Try a higher budget or view all meals to check which ingredients need pricing.',
        ),
      visibleMeals.map((meal) => {
        const isOver = isBudgetPriced(meal) && meal.cost > perMeal;
        const affordClass = !isBudgetPriced(meal)
          ? 'unknown'
          : meal.cost <= perMeal * 0.6
            ? 'cheap'
            : meal.cost <= perMeal
              ? 'okay'
              : meal.cost <= perMeal * 1.3
                ? 'pricey'
                : 'over';
        const valueScore =
          isBudgetPriced(meal) && meal.cost > 0
            ? Math.round((meal.kcal / meal.cost) * 10) / 10
            : '\u2014';
        const maxIngredientCost = Math.max(
          ...(meal.ingredients || []).map((ingredient) => ingredient.cost || 0),
          0,
        );
        return React.createElement(
          'div',
          { key: meal.id, className: `po-meal-row ${isOver ? 'over-budget' : ''}` },
          React.createElement(
            'div',
            { className: 'po-meal-main', onClick: () => toggleExpand(meal.id) },
            React.createElement('div', { className: 'po-meal-emoji' }, meal.emoji),
            React.createElement(
              'div',
              { className: 'po-meal-info' },
              React.createElement('div', { className: 'po-meal-name' }, meal.name),
              React.createElement(
                'div',
                { className: 'po-meal-meta' },
                React.createElement('span', null, meal.type),
                React.createElement('span', null, '\xB7 ', meal.kcal, ' kcal'),
                React.createElement('span', null, '\xB7 \u26A1 ', valueScore, ' kcal/\u20B1'),
              ),
            ),
            React.createElement(
              'div',
              { className: 'po-meal-cost-wrap' },
              React.createElement(
                'div',
                { className: 'po-meal-cost' },
                formatEstimatedPrice(meal.cost),
              ),
              React.createElement(
                'span',
                { className: `po-price-source ${meal.pricingSource === 'market' ? 'market' : ''}` },
                pricingLabel(meal),
              ),
              React.createElement(
                'span',
                { className: `po-afford-badge ${affordClass}` },
                affordClass === 'unknown'
                  ? 'Needs verification'
                  : affordClass === 'cheap'
                    ? 'Budget-Friendly'
                    : affordClass === 'okay'
                      ? 'Affordable'
                      : affordClass === 'pricey'
                        ? 'Slightly Over'
                        : 'Over Budget',
              ),
            ),
            React.createElement(
              'button',
              {
                className: `po-expand-btn ${expandedId === meal.id ? 'open' : ''}`,
                type: 'button',
                onClick: (event) => {
                  event.stopPropagation();
                  toggleExpand(meal.id);
                },
              },
              React.createElement(
                'svg',
                {
                  width: '14',
                  height: '14',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2.5',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                },
                React.createElement('path', { d: 'M6 9l6 6 6-6' }),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: `po-meal-detail ${expandedId === meal.id ? 'open' : ''}` },
            React.createElement(
              'div',
              { className: 'po-detail-inner' },
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: 11,
                    color: '#4d6e5a',
                    textTransform: 'uppercase',
                    letterSpacing: 0.7,
                    marginBottom: 8,
                  },
                },
                'Ingredient Cost Breakdown',
              ),
              React.createElement(
                'div',
                { className: 'po-ing-cost-table-wrap' },
                React.createElement(
                  'table',
                  { className: 'po-ing-cost-table' },
                  React.createElement(
                    'thead',
                    null,
                    React.createElement(
                      'tr',
                      null,
                      React.createElement('th', { scope: 'col' }, 'Ingredient'),
                      React.createElement('th', { scope: 'col' }, 'Quantity'),
                      React.createElement('th', { scope: 'col' }, 'Grams'),
                      React.createElement('th', { scope: 'col' }, 'Calories'),
                      React.createElement('th', { scope: 'col' }, 'Cost'),
                    ),
                  ),
                  React.createElement(
                    'tbody',
                    null,
                    (meal.ingredients || []).map((ing) => {
                      const barPct =
                        maxIngredientCost > 0
                          ? Math.round(((ing.cost || 0) / maxIngredientCost) * 100)
                          : 0;
                      return React.createElement(
                        'tr',
                        { key: ing.name },
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: 'po-ing-cost-name' },
                            React.createElement('span', { className: 'po-ing-dot' }),
                            ing.name,
                          ),
                          React.createElement(
                            'div',
                            { className: 'price-estimate-note' },
                            ing.evidence?.label,
                            React.createElement('br', null),
                            ing.priceRecords?.length
                              ? ing.priceRecords.map((p) =>
                                  React.createElement(
                                    'div',
                                    { key: p.sourceUrl },
                                    React.createElement(
                                      'a',
                                      { href: p.sourceUrl, target: '_blank', rel: 'noreferrer' },
                                      p.source,
                                    ),
                                    ' \xB7 ',
                                    p.observedAt,
                                    React.createElement('br', null),
                                    p.description,
                                    ' \xB7 ',
                                    formatPrice(p.price),
                                    ' / ',
                                    p.unit,
                                    React.createElement('br', null),
                                    p.notes,
                                    p.conversionNote &&
                                      React.createElement('div', null, p.conversionNote),
                                    p.conversionSourceUrl &&
                                      React.createElement(
                                        'div',
                                        null,
                                        React.createElement(
                                          'a',
                                          {
                                            href: p.conversionSourceUrl,
                                            target: '_blank',
                                            rel: 'noreferrer',
                                          },
                                          'View Philippine portion reference',
                                        ),
                                      ),
                                    ing.cost === null &&
                                      React.createElement(
                                        'div',
                                        null,
                                        'Needs a compatible volume or piece count.',
                                      ),
                                  ),
                                )
                              : 'No matching sourced price',
                          ),
                        ),
                        React.createElement('td', null, ing.quantity || '\u2014'),
                        React.createElement('td', null, ing.grams ? `${ing.grams} g` : '\u2014'),
                        React.createElement(
                          'td',
                          null,
                          ing.calories == null ? '\u2014' : `${ing.calories} kcal`,
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'po-ing-cost-cell' },
                            React.createElement(
                              'span',
                              { className: 'po-cost-bar-bg' },
                              React.createElement('span', {
                                className: 'po-cost-bar-fill',
                                style: { width: `${barPct}%` },
                              }),
                            ),
                            React.createElement(
                              'span',
                              { className: 'po-ing-cost-price' },
                              formatEstimatedPrice(ing.cost),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
              buildSubSuggestion(meal),
            ),
          ),
        );
      }),
    ),
  );
}
function computeCheapestDay(meals = [], perMeal) {
  const types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const costs = types.map((type) => {
    const mealsOfType = meals.filter((meal) => meal.type === type && isBudgetPriced(meal));
    if (mealsOfType.length === 0) return null;
    const cheapest = mealsOfType.reduce((a, b) => (a.cost < b.cost ? a : b));
    return cheapest.cost;
  });
  return costs.includes(null)
    ? null
    : Math.round(costs.reduce((sum, cost) => sum + cost, 0) * 100) / 100;
}
function SlotCard({
  slot,
  idx,
  completed,
  onToggleComplete,
  profile,
  appliedOptimization,
  onPortionApplied,
  onOriginalMeal,
  activeConstraints,
  constraintDefinitions,
  getMeal,
  totalMealsToday,
  groceryList,
  openOptimizerId,
  onSetOpenOptimizer,
  onRemove,
  onSwap,
  onAddGrocery,
}) {
  const meal = getMeal(slot.mealId);
  const displayedMeal = appliedMeal(meal, appliedOptimization);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [aiReview, setAiReview] = useState(null);
  const alreadyAdded = meal && groceryList.some((g) => g.mealId === meal.id);
  const seasonScore = meal ? scoreRecipe(meal.ingredients) : null;
  const violations = meal
    ? checkRecipeViolations(meal, activeConstraints, true, constraintDefinitions)
    : [];
  const reviewKey = mealReviewKey(displayedMeal || {}, profile || {}, violations);
  const currentAiVerdict = aiReview?.key === reviewKey ? aiReview.verdict : null;
  return React.createElement(
    'div',
    null,
    React.createElement(
      'div',
      { className: 'slot-header' },
      React.createElement(
        'div',
        { className: 'slot-time-pill' },
        '\u23F0 ',
        slot.time || (meal ? meal.prep : '--:--'),
      ),
      React.createElement('span', { className: 'slot-type-label' }, slot.type),
      React.createElement(
        'button',
        { className: 'slot-remove-btn', title: 'Remove slot', onClick: onRemove },
        '\u2715',
      ),
    ),
    !meal
      ? React.createElement(
          'div',
          {
            className: 'empty-slot',
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '24px',
            },
          },
          React.createElement('span', { className: 'empty-slot-icon' }, '\u{1F37D}\uFE0F'),
          React.createElement('span', null, 'No recipe assigned to this ', slot.type, ' slot.'),
          React.createElement(
            'button',
            {
              className: 'mp-btn mp-btn-outline',
              style: { fontSize: 13, marginTop: 4 },
              onClick: () => onSwap({ type: slot.type }, idx),
            },
            '+ Select Recipe',
          ),
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div',
            { className: 'meal-card', 'data-meal-id': meal.id },
            React.createElement(
              'div',
              { className: 'meal-card-top' },
              React.createElement('div', { className: 'meal-card-emoji' }, meal.emoji),
              React.createElement(
                'div',
                { className: 'meal-card-info' },
                React.createElement(
                  'div',
                  { className: 'meal-card-name-row' },
                  React.createElement('div', { className: 'meal-card-name' }, meal.name),
                  appliedOptimization &&
                    React.createElement(
                      'span',
                      { className: 'meal-optimized-badge' },
                      'Optimized meal',
                    ),
                  completed &&
                    React.createElement('span', { className: 'meal-completed-badge' }, 'Finished'),
                ),
                React.createElement(
                  'div',
                  { className: 'meal-card-meta' },
                  slot.time || 'Meal',
                  ' \xA0\xB7\xA0 ',
                  meal.prep,
                  ' prep',
                ),
                React.createElement(
                  'div',
                  { className: 'meal-macro-chips' },
                  React.createElement(
                    'div',
                    { className: 'macro-chip' },
                    React.createElement('b', null, displayedMeal.protein, 'g'),
                    ' Protein',
                  ),
                  React.createElement(
                    'div',
                    { className: 'macro-chip' },
                    React.createElement('b', null, displayedMeal.carbs, 'g'),
                    ' Carbs',
                  ),
                  React.createElement(
                    'div',
                    { className: 'macro-chip' },
                    React.createElement('b', null, displayedMeal.fats, 'g'),
                    ' Fats',
                  ),
                  seasonScore && React.createElement(SeasonBadge, { scoreResult: seasonScore }),
                  React.createElement(ViolationBadge, { violations, aiVerdict: currentAiVerdict }),
                ),
              ),
              React.createElement(
                'div',
                { className: 'meal-card-right' },
                React.createElement(
                  'div',
                  { className: 'meal-kcal-badge' },
                  React.createElement('span', null, displayedMeal.kcal),
                  React.createElement('small', null, 'kcal'),
                ),
                React.createElement(
                  'div',
                  {
                    className: `meal-cost-badge${!meal.cost ? ' meal-cost-badge--zero' : ''}`,
                    title: pricingLabel(meal),
                  },
                  formatEstimatedPrice(displayedMeal.cost),
                ),
                React.createElement(
                  'div',
                  { className: 'price-estimate-note' },
                  pricingLabel(meal),
                ),
              ),
            ),
            React.createElement(ViolationDetail, { violations }),
            React.createElement(
              'div',
              { className: 'meal-card-ingredients' + (ingredientsOpen ? ' open' : '') },
              React.createElement(
                'div',
                { className: 'ingredient-table-wrap' },
                React.createElement(
                  'table',
                  { className: 'ingredient-table' },
                  React.createElement(
                    'thead',
                    null,
                    React.createElement(
                      'tr',
                      null,
                      React.createElement('th', { scope: 'col' }, 'Ingredient'),
                      React.createElement('th', { scope: 'col' }, 'Quantity'),
                      React.createElement('th', { scope: 'col' }, 'Grams'),
                      React.createElement('th', { scope: 'col' }, 'Calories'),
                    ),
                  ),
                  React.createElement(
                    'tbody',
                    null,
                    meal.ingredients.map((ing) => {
                      const optimizedIngredient = appliedOptimization?.ingredients?.find(
                        (item) => item.name === ing.name,
                      );
                      const scaleFactor = appliedOptimization?.scaleFactor ?? 1;
                      const grams = Number(ing.grams) || 0;
                      const displayedGrams = grams ? Math.round(grams * scaleFactor) : null;
                      const quantityLabel = getIngredientQuantityLabel(
                        ing,
                        optimizedIngredient?.optimized,
                      );
                      const calories =
                        ing.calories == null ? null : Math.round(ing.calories * scaleFactor);
                      return React.createElement(
                        Fragment,
                        { key: ing.name },
                        React.createElement(
                          'tr',
                          null,
                          React.createElement(
                            'td',
                            null,
                            React.createElement(
                              'div',
                              { className: 'ingredient-table-name' },
                              React.createElement('div', { className: 'ingredient-dot' }),
                              React.createElement(
                                'span',
                                { className: 'ingredient-name' },
                                ing.name,
                              ),
                            ),
                          ),
                          React.createElement('td', null, quantityLabel),
                          React.createElement(
                            'td',
                            null,
                            displayedGrams == null ? '\u2014' : `${displayedGrams} g`,
                          ),
                          React.createElement(
                            'td',
                            null,
                            calories == null ? '\u2014' : `${calories} kcal`,
                          ),
                        ),
                        React.createElement(
                          'tr',
                          { className: 'ingredient-seasonal-row' },
                          React.createElement(
                            'td',
                            { colSpan: '4' },
                            React.createElement(SeasonalAltBanner, { ingredientName: ing.name }),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'meal-card-actions' },
              React.createElement(
                'button',
                {
                  className: 'meal-action-btn complete' + (completed ? ' completed' : ''),
                  'aria-pressed': completed,
                  onClick: onToggleComplete,
                },
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
                  React.createElement('path', { d: 'M5 12l4 4L19 6' }),
                ),
                completed ? 'Undo finished' : 'Mark as eaten',
              ),
              React.createElement(
                'button',
                { className: 'meal-action-btn swap', onClick: () => onSwap(meal, idx) },
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
                  React.createElement('path', { d: 'M8 3L4 7l4 4' }),
                  React.createElement('path', { d: 'M4 7h16' }),
                  React.createElement('path', { d: 'M16 21l4-4-4-4' }),
                  React.createElement('path', { d: 'M20 17H4' }),
                ),
                'Swap meal',
              ),
              React.createElement(
                'button',
                {
                  className: 'meal-action-btn grocery' + (alreadyAdded ? ' added' : ''),
                  onClick: () => onAddGrocery(meal),
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
                  React.createElement('path', {
                    d: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z',
                  }),
                  React.createElement('line', { x1: '3', y1: '6', x2: '21', y2: '6' }),
                  React.createElement('path', { d: 'M16 10a4 4 0 0 1-8 0' }),
                ),
                alreadyAdded ? 'Added \u2713' : 'Add to grocery',
              ),
              isProfileComplete(profile) ? React.createElement(OptimizeButton, {
                disabled: violations.length > 0 || !(Number(meal.kcal) > 0),
                onToggle: () => onSetOpenOptimizer(openOptimizerId === meal.id ? null : meal.id),
              }) : React.createElement(Link, { to: '/profile', className: 'meal-action-btn' }, 'Update profile for portions'),
              isProfileComplete(profile) && React.createElement(WhyButton, {
                key: reviewKey,
                meal: displayedMeal,
                profile,
                violations,
                onReview: verdict => setAiReview({ key: reviewKey, verdict }),
              }),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'toggle-ingredients-btn' + (ingredientsOpen ? ' open' : ''),
                  'aria-expanded': ingredientsOpen,
                  onClick: () => setIngredientsOpen((v) => !v),
                },
                'Ingredients ',
                React.createElement(
                  'svg',
                  {
                    viewBox: '0 0 24 24',
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: '2.5',
                    strokeLinecap: 'round',
                  },
                  React.createElement('path', { d: 'M6 9l6 6 6-6' }),
                ),
              ),
            ),
          ),
          React.createElement(PortionOptimizerPanel, {
            meal,
            profile,
            totalMealsToday,
            open: isProfileComplete(profile) && openOptimizerId === meal.id && violations.length === 0 && Number(meal.kcal) > 0,
            onClose: () => onSetOpenOptimizer(null),
            onApplied: onPortionApplied,
            onOriginalMeal,
          }),
        ),
  );
}
export { MealPlan as default };
