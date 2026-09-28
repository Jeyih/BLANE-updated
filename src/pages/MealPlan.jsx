/* ============================================================
   BLANE — Meal Plan Page
   Replaces: mealplan.html + js/mealplan.js entirely.

   Fetches real recipes from Supabase (recipes, recipe_ingredients)
   and manages weekly meal slots, calorie goals, swap options,
   and grocery list generation.
   ============================================================ */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import WhyButton from '../components/WhyButton';
import PortionOptimizerPanel, { OptimizeButton } from '../components/PortionOptimizerPanel';
import { scoreRecipe } from '../lib/seasonal';
import { SeasonBadge, IngSeasonTag, SeasonalAltBanner } from '../components/SeasonalBadges';
import { loadConstraintDefinitions, getActiveConstraints, checkRecipeViolations } from '../lib/constraints';
import { applyDynamicRecipePrices, loadMarketIngredientPrices } from '../lib/pricing';
import { ViolationBadge, ViolationDetail } from '../components/ConstraintWarnings';
import '../styles/mealplan.css';
import '../styles/priceopt.css';
import '../styles/constraints.css';

const SLOT_PRESETS = [
  { type: 'Breakfast', icon: '🌅', time: '7:00 AM' },
  { type: 'Brunch', icon: '🍳', time: '10:00 AM' },
  { type: 'Lunch', icon: '☀️', time: '12:00 PM' },
  { type: 'Snack', icon: '🍎', time: '3:00 PM' },
  { type: 'Dinner', icon: '🌙', time: '6:30 PM' },
  { type: 'Custom', icon: '✏️', time: 'Your own' },
];

function getCalorieGoal(profile) {
  if (!profile) return 1840;
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * 1.55;
  const adj = { lose_weight: 0.85, gain_muscle: 1.1, maintain: 1.0, improve_health: 1.0, boost_energy: 1.0, manage_condition: 0.9 };
  return Math.round(tdee * (adj[profile.goal] || 1.0)) || 1840;
}

function getIngredientQuantityLabel(ingredient, optimizedQuantity) {
  const hasQuantity = ingredient.quantity != null && ingredient.quantity !== '';
  if (!hasQuantity) return '—';
  const quantity = optimizedQuantity != null && optimizedQuantity !== ''
    ? optimizedQuantity
    : ingredient.quantity;
  return String(quantity);
}

function generateDefaultPlan(recipeList) {
  if (!recipeList || recipeList.length === 0) return {};
  const breakfasts = recipeList.filter((r) => r.type === 'Breakfast');
  const lunches    = recipeList.filter((r) => r.type === 'Lunch');
  const dinners    = recipeList.filter((r) => r.type === 'Dinner');
  const snacks     = recipeList.filter((r) => r.type === 'Snack');

  const defaultSlots = {};
  for (let day = 0; day < 7; day++) {
    const bMeal = breakfasts.length ? breakfasts[day % breakfasts.length] : recipeList[0];
    const lMeal = lunches.length ? lunches[day % lunches.length] : (recipeList[1] || recipeList[0]);
    const sMeal = snacks.length ? snacks[day % snacks.length] : null;
    const dMeal = dinners.length ? dinners[day % dinners.length] : (recipeList[2] || recipeList[0]);

    const dayArr = [];
    if (bMeal) dayArr.push({ type: 'Breakfast', time: '7:00 AM', mealId: bMeal.id });
    if (lMeal) dayArr.push({ type: 'Lunch', time: '12:00 PM', mealId: lMeal.id });
    if (sMeal) dayArr.push({ type: 'Snack', time: '3:00 PM', mealId: sMeal.id });
    if (dMeal) dayArr.push({ type: 'Dinner', time: '6:30 PM', mealId: dMeal.id });

    defaultSlots[day] = dayArr;
  }
  return defaultSlots;
}

export default function MealPlan() {
  const { user } = useAuth();
  const [profile, setProfile]                 = useState(null);
  const [recipes, setRecipes]                 = useState([]);
  const [loadingRecipes, setLoadingRecipes]   = useState(true);
  const [constraintDefinitions, setConstraintDefinitions] = useState({});
  const [currentWeekOffset, setWeekOffset]     = useState(0);
  const [selectedDayIndex, setSelectedDay]     = useState(new Date().getDay());
  const [daySlots, setDaySlots]                = useState({});
  const [groceryList, setGroceryList]          = useState(() => JSON.parse(sessionStorage.getItem('blane_grocery') || '[]'));
  const [openOptimizerId, setOpenOptimizerId] = useState(null);
  const [appliedOptimizations, setAppliedOptimizations] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('blane_optimized_v2') || '{}');
    } catch {
      return {};
    }
  });

  const [addSlotOpen, setAddSlotOpen]             = useState(false);
  const [slotTypeChoice, setSlotTypeChoice]       = useState(null);
  const [customSlotName, setCustomSlotName]       = useState('');
  const [selectedRecipeForAdd, setSelectedRecipeForAdd] = useState('');

  const [swapTarget, setSwapTarget] = useState(null);
  const [swapChoice, setSwapChoice] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    loadProfile();
    if (recipes.length === 0) loadRecipes();
    loadConstraintDefinitions().then((definitions) => {
      if (definitions) setConstraintDefinitions(definitions);
    });
  }, [user?.id]);

  useEffect(() => {
    localStorage.setItem('blane_meal_plan_day', String(selectedDayIndex));
    window.dispatchEvent(new Event('blane-meal-plan-updated'));
  }, [selectedDayIndex]);

  useEffect(() => {
    sessionStorage.setItem('blane_grocery', JSON.stringify(groceryList));
  }, [groceryList]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) setProfile(data);
  }

  async function loadRecipes() {
    setLoadingRecipes(true);
    const { data: recipesData, error: recipesErr } = await supabase.from('recipes').select('*').order('name');
    if (recipesErr) {
      console.error('Failed to load recipes:', recipesErr.message);
      setRecipes([]);
      setLoadingRecipes(false);
      return;
    }

    const { data: ingData } = await supabase.from('recipe_ingredients').select('*').order('sort_order');
    const marketPrices = await loadMarketIngredientPrices(supabase);
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
          ? Math.round((Number(nutrientByFctId[ing.fct_id].energy_kcal) || 0) * (Number(ing.grams) || 0) / 100)
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
          carbs: nutrient?.available_carbohydrate_g == null ? null : Number(nutrient.available_carbohydrate_g) * servingFactor,
          fats: nutrient?.total_fat_g == null ? null : Number(nutrient.total_fat_g) * servingFactor,
          cost: Number(((r.cost || 0) / Math.max((ingByRecipe[r.id] || []).length, 1)).toFixed(2)),
        };
      });

      return {
        id: r.id,
        emoji: r.emoji || '🍲',
        name: r.name,
        type: r.type,
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

    const dynamicallyPricedRecipes = applyDynamicRecipePrices(formatted, marketPrices);
    setRecipes(dynamicallyPricedRecipes);
    setLoadingRecipes(false);

    // Initialize daySlots if empty
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
    setDaySlots(generateDefaultPlan(dynamicallyPricedRecipes));
  }

  useEffect(() => {
    if (Object.keys(daySlots).length > 0) {
      localStorage.setItem('blane_meal_plan', JSON.stringify(daySlots));
      window.dispatchEvent(new Event('blane-meal-plan-updated'));
    }
  }, [daySlots]);

  function getMeal(id) {
    if (!id) return null;
    return recipes.find((m) => m.id === id || String(m.id) === String(id)) || null;
  }

  function regeneratePlan() {
    if (recipes.length === 0) return;
    const newSlots = {};
    for (let day = 0; day < 7; day++) {
      const breakfasts = recipes.filter((r) => r.type === 'Breakfast');
      const lunches    = recipes.filter((r) => r.type === 'Lunch');
      const dinners    = recipes.filter((r) => r.type === 'Dinner');
      const snacks     = recipes.filter((r) => r.type === 'Snack');

      const getRandom = (arr) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : recipes[Math.floor(Math.random() * recipes.length)];

      const b = getRandom(breakfasts);
      const l = getRandom(lunches);
      const s = getRandom(snacks);
      const d = getRandom(dinners);

      newSlots[day] = [
        { type: 'Breakfast', time: '7:00 AM', mealId: b?.id },
        { type: 'Lunch', time: '12:00 PM', mealId: l?.id },
        { type: 'Snack', time: '3:00 PM', mealId: s?.id },
        { type: 'Dinner', time: '6:30 PM', mealId: d?.id },
      ].filter((slot) => slot.mealId);
    }
    setDaySlots(newSlots);
  }

  function exportWeekPlan() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let text = `=== BLANE WEEKLY MEAL PLAN ===\nWeek of ${weekLabel}\n\n`;

    const dayIndices = [1, 2, 3, 4, 5, 6, 0];
    dayIndices.forEach((dIdx, i) => {
      text += `--- ${days[i]} ---\n`;
      const dayArr = daySlots[dIdx] || [];
      if (dayArr.length === 0) {
        text += `  No meals planned.\n`;
      } else {
        dayArr.forEach((s) => {
          const m = getMeal(s.mealId);
          if (m) {
            text += `  [${s.type} - ${s.time || 'Meal'}] ${m.name} (${m.kcal} kcal, ${m.protein}g P, ₱${m.cost})\n`;
          } else {
            text += `  [${s.type}] No meal assigned\n`;
          }
        });
      }
      text += `\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BLANE_MealPlan_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const slots = daySlots[selectedDayIndex] || [];
  const activeConstraints = getActiveConstraints(profile, constraintDefinitions);

  const today = new Date();
  const base = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;
  base.setDate(today.getDate() - dayOfWeek + currentWeekOffset * 7);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekEnd = new Date(base); weekEnd.setDate(base.getDate() + 6);
  const weekLabel = months[base.getMonth()] + ' ' + base.getDate() + ' – ' + months[weekEnd.getMonth()] + ' ' + weekEnd.getDate() + ', ' + weekEnd.getFullYear();

  const totalKcal = slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.kcal || 0), 0);
  const totalCost = Math.round(slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.cost || 0), 0));
  const totalProtein = Math.round(slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.protein || 0), 0));
  const calGoal = getCalorieGoal(profile);
  const dayPct = Math.min(Math.round((totalKcal / calGoal) * 100), 100);

  function removeSlot(idx) {
    setDaySlots((prev) => {
      const next = { ...prev };
      next[selectedDayIndex] = [...(next[selectedDayIndex] || [])];
      next[selectedDayIndex].splice(idx, 1);
      return next;
    });
  }

  function confirmAddSlot() {
    if (!slotTypeChoice) { alert('Please select a meal type.'); return; }
    let type = slotTypeChoice;
    let time = SLOT_PRESETS.find((p) => p.type === type)?.time || '12:00 PM';
    if (type === 'Custom') {
      if (!customSlotName.trim()) { alert('Please enter a custom slot name.'); return; }
      type = customSlotName.trim();
      time = 'Your own';
    }

    setDaySlots((prev) => {
      const next = { ...prev };
      next[selectedDayIndex] = [
        ...(next[selectedDayIndex] || []),
        { type, time, mealId: selectedRecipeForAdd || null }
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
  }

  function confirmSwap() {
    if (!swapChoice) { alert('Please select a recipe.'); return; }
    setDaySlots((prev) => {
      const next = { ...prev };
      const arr = [...(next[selectedDayIndex] || [])];
      arr[swapTarget.slotIdx] = { ...arr[swapTarget.slotIdx], mealId: swapChoice };
      next[selectedDayIndex] = arr;
      return next;
    });
    setSwapTarget(null);
  }

  function addMealToGrocery(meal) {
    if (!meal || !meal.ingredients) return;
    setGroceryList((prev) => {
      const filtered = prev.filter((g) => g.mealId !== meal.id);
      return [...filtered, ...meal.ingredients.map((ing) => ({ mealId: meal.id, name: ing.name, qty: ing.qty, checked: false }))];
    });
  }

  function addAllTodayToGrocery() {
    const todayMeals = slots.map((s) => getMeal(s.mealId)).filter(Boolean);
    if (todayMeals.length === 0) return;
    setGroceryList((prev) => {
      let current = [...prev];
      todayMeals.forEach((meal) => {
        current = current.filter((g) => g.mealId !== meal.id);
        const newItems = meal.ingredients.map((ing) => ({ mealId: meal.id, name: ing.name, qty: ing.qty, checked: false }));
        current = [...current, ...newItems];
      });
      return current;
    });
  }

  function toggleGroceryChecked(idx) {
    setGroceryList((prev) => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  }

  function removeGroceryItem(idx) {
    setGroceryList((prev) => prev.filter((_, i) => i !== idx));
  }

  // Filter candidate recipes for Add/Swap modals
  const availableRecipesForAdd = slotTypeChoice
    ? recipes.filter((r) => r.type === slotTypeChoice || slotTypeChoice === 'Custom' || slotTypeChoice === 'Brunch')
    : recipes;

  return (
    <>
      <Navbar />
      <main className="mp-main">
        <div className="mp-content">

          <div className="mp-page-header">
            <div>
              <h1 className="mp-page-title">Meal Plan</h1>
              <p className="mp-page-sub">Weekly adaptive plan — updated by BLANE AI</p>
            </div>
            <div className="mp-header-actions">
              <button className="mp-btn mp-btn-outline" onClick={exportWeekPlan}>Export Week</button>
              <button className="mp-btn mp-btn-primary" onClick={regeneratePlan}>Regenerate Plan</button>
            </div>
          </div>

          <div className="week-nav">
            <button className="week-arrow" onClick={() => setWeekOffset((o) => o - 1)}>‹</button>
            <span className="week-label">{weekLabel}</span>
            <div className="week-days">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(base); d.setDate(base.getDate() + i);
                const jsDay = d.getDay();
                const isToday = d.toDateString() === today.toDateString();
                const isActive = jsDay === selectedDayIndex;
                const hasMeals = (daySlots[jsDay] || []).some((s) => s.mealId);
                return (
                  <button
                    key={i}
                    className={'week-day-btn' + (isActive ? ' active' : '') + (isToday ? ' today' : '') + (hasMeals ? ' has-meals' : '')}
                    onClick={() => setSelectedDay(jsDay)}
                  >
                    <span className="day-name">{days[i]}</span>
                    <span className="day-num">{d.getDate()}</span>
                    <span className="day-dot"></span>
                  </button>
                );
              })}
            </div>
            <button className="week-arrow" onClick={() => setWeekOffset((o) => o + 1)}>›</button>
          </div>

          <div className="day-view">
            <div className="meal-slots-col">
              <div className="day-summary-bar">
                <div className="day-summary-item">
                  <span className="day-summary-label">Calories</span>
                  <span className="day-summary-value green">{totalKcal} <small style={{ fontSize: 13, color: '#4d6e5a', fontWeight: 400 }}>/ {calGoal} kcal</small></span>
                </div>
                <div className="day-summary-divider"></div>
                <div className="day-summary-item">
                  <span className="day-summary-label">Protein</span>
                  <span className="day-summary-value">{totalProtein}<small style={{ fontSize: 12, color: '#4d6e5a', fontWeight: 400 }}>g</small></span>
                </div>
                <div className="day-summary-divider"></div>
                <div className="day-summary-item">
                  <span className="day-summary-label">Est. Cost</span>
                  <span className="day-summary-value yellow">₱{totalCost}</span>
                </div>
                <div className="day-summary-divider"></div>
                <div className="day-cal-bar-wrap">
                  <div className="day-cal-bar-label"><span>Progress</span><span>{dayPct}%</span></div>
                  <div className="day-cal-bar-bg"><div className="day-cal-bar-fill" style={{ width: dayPct + '%' }}></div></div>
                </div>
              </div>

              {loadingRecipes ? (
                <div className="empty-slot">Loading recipes from database…</div>
              ) : slots.length === 0 ? (
                <div className="empty-slot"><span className="empty-slot-icon">🍽️</span>No meals planned yet. Add a slot below!</div>
              ) : (
                slots.map((slot, idx) => (
                  <SlotCard
                    key={idx}
                    slot={slot}
                    idx={idx}
                    profile={profile}
                    appliedOptimization={appliedOptimizations[slot.mealId]}
                    onPortionApplied={(mealId, result) => setAppliedOptimizations((prev) => ({
                      ...prev,
                      [mealId]: {
                        scaleFactor: result.scaleFactor,
                        ingredients: result.ingredients,
                        optimizedKcal: result.optimizedKcal,
                      },
                    }))}
                    onOriginalMeal={(mealId) => setAppliedOptimizations((prev) => {
                      const next = { ...prev };
                      delete next[mealId];
                      return next;
                    })}
                    activeConstraints={activeConstraints}
                    constraintDefinitions={constraintDefinitions}
                    getMeal={getMeal}
                    totalMealsToday={slots.length}
                    groceryList={groceryList}
                    openOptimizerId={openOptimizerId}
                    onSetOpenOptimizer={setOpenOptimizerId}
                    onRemove={() => removeSlot(idx)}
                    onSwap={openSwap}
                    onAddGrocery={addMealToGrocery}
                  />
                ))
              )}

                            <button className="add-slot-btn" onClick={() => setAddSlotOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add meal slot
              </button>

              <PriceOptimizerPanel meals={recipes} profile={profile} />

            </div>

            <div className="grocery-panel">
              <div className="grocery-panel-header">
                <div className="grocery-panel-title-row">
                  <div className="grocery-panel-icon">🛒</div>
                  <span className="grocery-panel-title">Grocery List</span>
                  <span className="grocery-count-badge">{groceryList.length}</span>
                </div>
                <button className="grocery-clear-btn" onClick={() => setGroceryList([])}>Clear all</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <button
                  className="mp-btn mp-btn-outline"
                  style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '8px 12px' }}
                  onClick={addAllTodayToGrocery}
                >
                  + Add all today's meals to list
                </button>
              </div>

              <div className="grocery-list">
                {groceryList.length === 0 ? (
                  <div className="grocery-empty"><span className="grocery-empty-icon">🛒</span>No items yet. Add meals to build your list.</div>
                ) : (
                  groceryList.map((item, i) => (
                    <div key={i} className={'grocery-item' + (item.checked ? ' checked' : '')}>
                      <div className="grocery-checkbox" onClick={() => toggleGroceryChecked(i)}>{item.checked ? '✓' : ''}</div>
                      <span className="grocery-item-name">{item.name}</span>
                      <span className="grocery-item-qty">{item.qty}</span>
                      <button className="grocery-remove-btn" onClick={() => removeGroceryItem(i)}>✕</button>
                    </div>
                  ))
                )}
              </div>

              <div className="grocery-cost-total">
                <span className="grocery-cost-label">Est. today's total</span>
                <span className="grocery-cost-value">₱{totalCost}</span>
              </div>

              <button
                className="mp-btn mp-btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  if (groceryList.length === 0) { alert('Grocery list is empty.'); return; }
                  const text = groceryList.map((g) => `[${g.checked ? 'x' : ' '}] ${g.name} (${g.qty})`).join('\n');
                  const blob = new Blob([`BLANE GROCERY LIST\n\n${text}`], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'BLANE_Grocery_List.txt'; a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download List
              </button>
            </div>
          </div>

        </div>
      </main>

      {addSlotOpen && (
        <div className="slot-modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setAddSlotOpen(false); }}>
          <div className="slot-modal" style={{ maxWidth: 440 }}>
            <button className="slot-modal-close" onClick={() => setAddSlotOpen(false)}>✕</button>
            <div className="slot-modal-title">Add Meal Slot</div>
            <div className="slot-type-grid">
              {SLOT_PRESETS.map((p) => (
                <div key={p.type} className={'slot-type-option' + (slotTypeChoice === p.type ? ' selected' : '')} onClick={() => setSlotTypeChoice(p.type)}>
                  <span className="slot-type-option-icon">{p.icon}</span>
                  <span className="slot-type-option-label">{p.type}</span>
                  <span className="slot-type-option-time">{p.time}</span>
                </div>
              ))}
            </div>

            {slotTypeChoice === 'Custom' && (
              <div className="slot-custom-input-wrap show">
                <label className="form-label">Custom slot name</label>
                <input className="form-input" value={customSlotName} onChange={(e) => setCustomSlotName(e.target.value)} placeholder="e.g. Pre-workout, Late night..." />
              </div>
            )}

            {slotTypeChoice && (
              <div style={{ marginTop: 14, marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, color: '#8aab96', marginBottom: 6, display: 'block' }}>
                  Assign Recipe (Optional)
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%', background: '#111f16', color: '#e8f5ee', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(45, 220, 122, 0.2)' }}
                  value={selectedRecipeForAdd}
                  onChange={(e) => setSelectedRecipeForAdd(e.target.value)}
                >
                  <option value="">-- Choose a recipe from database --</option>
                  {(availableRecipesForAdd.length > 0 ? availableRecipesForAdd : recipes).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.emoji} {r.name} ({r.kcal} kcal · ₱{r.cost})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button className="mp-btn mp-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={confirmAddSlot}>
              Add Slot
            </button>
          </div>
        </div>
      )}

      {swapTarget && (
        <div className="swap-modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setSwapTarget(null); }}>
          <div className="swap-modal" style={{ maxWidth: 520 }}>
            <button className="swap-close" onClick={() => setSwapTarget(null)}>✕</button>
            <div className="swap-modal-label">Choose Recipe</div>
            <div className="swap-modal-title">
              {swapTarget.meal?.name ? `Swapping: ${swapTarget.meal.name}` : `Select recipe for ${swapTarget.meal?.type || 'slot'}`}
            </div>
            <div className="swap-options" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {recipes
                .filter((r) => !swapTarget.meal?.id || r.id !== swapTarget.meal.id)
                .map((alt) => (
                  <div
                    key={alt.id}
                    className={'swap-option-card' + (swapChoice === alt.id ? ' selected' : '')}
                    onClick={() => setSwapChoice(alt.id)}
                    style={{ cursor: 'pointer', padding: 12, borderRadius: 12, marginBottom: 8, background: swapChoice === alt.id ? 'rgba(45, 220, 122, 0.12)' : '#111f16', border: swapChoice === alt.id ? '1px solid #2ddc7a' : '1px solid rgba(45, 220, 122, 0.1)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="swap-option-emoji" style={{ fontSize: 24 }}>{alt.emoji}</div>
                      <div className="swap-option-info" style={{ flex: 1 }}>
                        <div className="swap-option-name" style={{ fontWeight: 600, color: '#e8f5ee' }}>{alt.name}</div>
                        <div className="swap-option-meta" style={{ fontSize: 12, color: '#8aab96' }}>
                          <span>{alt.type}</span> &nbsp;·&nbsp; <span>{alt.kcal} kcal</span> &nbsp;·&nbsp; {alt.protein}g protein &nbsp;·&nbsp; {alt.prep}
                        </div>
                      </div>
                      <div className="swap-option-cost" style={{ color: '#fbbf24', fontWeight: 600 }}>₱{alt.cost}</div>
                    </div>
                  </div>
                ))}
            </div>
            <button className="mp-btn mp-btn-primary swap-confirm-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={confirmSwap}>
              Confirm Selection
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PriceOptimizerPanel({ meals = [], profile }) {
  const [dailyBudget, setDailyBudget] = useState(200);
  const [appliedBudget, setAppliedBudget] = useState(200);
  const [sortMode, setSortMode] = useState('cost');
  const [filterOver, setFilterOver] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [suggestionType, setSuggestionType] = useState('Lunch');
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');

  const perMeal = Math.round(appliedBudget / 4);

  const sortedMeals = useMemo(() => {
    const list = [...meals];
    if (sortMode === 'cost') {
      return list.sort((a, b) => a.cost - b.cost);
    }
    return list.sort((a, b) => (b.kcal / b.cost || 0) - (a.kcal / a.cost || 0));
  }, [sortMode, meals]);

  const visibleMeals = filterOver ? sortedMeals.filter((meal) => meal.cost <= perMeal) : sortedMeals;
  const affordableCount = sortedMeals.filter((meal) => meal.cost <= perMeal).length;
  const cheapestDay = computeCheapestDay(meals, perMeal);

  async function suggestMeal() {
    setSuggestionLoading(true);
    setSuggestionError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in to get a personalized FNRI meal suggestion.');
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/optimize-meal`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: 'suggest', profile, budget: appliedBudget, mealType: suggestionType }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not generate a meal suggestion.');
      setSuggestion(payload);
    } catch (error) {
      setSuggestionError(error.message);
    } finally {
      setSuggestionLoading(false);
    }
  }

  function applyBudget() {
    const nextBudget = Math.max(50, Math.min(2000, Number(dailyBudget) || 200));
    setDailyBudget(nextBudget);
    setAppliedBudget(nextBudget);
    setSuggestion(null);
    setSuggestionError('');
  }

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function buildSubSuggestion(meal) {
    const ingredients = meal.ingredients || [];
    if (!ingredients.length) {
      return (
        <div className="po-sub-suggestion">
          <span className="po-sub-suggestion-icon">📍</span>
          <div className="po-sub-suggestion-text">Shop at local palengke or talipapa for better value on this meal.</div>
        </div>
      );
    }

    const expensiveIngredient = [...ingredients].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0];
    if (!expensiveIngredient) {
      return (
        <div className="po-sub-suggestion">
          <span className="po-sub-suggestion-icon">📍</span>
          <div className="po-sub-suggestion-text">Shop at local palengke or talipapa for better value on this meal.</div>
        </div>
      );
    }

    return (
      <div className="po-sub-suggestion">
        <span className="po-sub-suggestion-icon">💡</span>
        <div className="po-sub-suggestion-text">
          Keep this meal under budget by using a local substitute for <strong>{expensiveIngredient.name}</strong> when it is cheaper at nearby markets.
        </div>
        <div className="po-sub-saving">Save on local pricing</div>
      </div>
    );
  }

  return (
    <div className="po-panel">
      <div className="po-header">
        <div className="po-header-left">
          <div className="po-header-icon">💸</div>
          <div>
            <div className="po-title">Price-Aware Meal Optimizer</div>
            <div className="po-sub">Costs use current market averages (₱/kg); unmatched ingredients use recipe estimates.</div>
          </div>
        </div>
      </div>

      <div className="po-budget-row">
        <div className="po-budget-input-wrap">
          <span className="po-currency-prefix">₱</span>
          <input
            className="po-budget-input"
            type="number"
            value={dailyBudget}
            min={50}
            max={2000}
            step={10}
            onChange={(event) => setDailyBudget(parseInt(event.target.value, 10) || 200)}
          />
        </div>
        <span className="po-budget-label">Budget</span>
        <div className="po-per-meal-chip">≈ <strong>₱{perMeal}</strong> / meal</div>
        <button className="po-apply-btn" type="button" onClick={applyBudget}>
          Apply Budget
        </button>
      </div>

      <div className="po-ai-suggest-row">
        <div>
          <div className="po-ai-suggest-title">Suggest an affordable meal</div>
          <div className="po-ai-suggest-sub">Gemini uses DOST-FNRI nutrition data and your health profile.</div>
        </div>
        <select value={suggestionType} onChange={(event) => setSuggestionType(event.target.value)} aria-label="Suggested meal type">
          <option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option>
        </select>
        <button className="po-apply-btn" type="button" onClick={suggestMeal} disabled={suggestionLoading}>
          {suggestionLoading ? 'Analyzing...' : 'Suggest with AI'}
        </button>
      </div>
      {suggestionError && <div className="po-ai-suggest-error">{suggestionError}</div>}
      {suggestion && (
        <div className="po-ai-suggestion">
          <div className="po-ai-suggestion-heading">
            <div><strong>{suggestion.name}</strong><span>{suggestion.mealType} · ₱{Math.round(suggestion.estimatedCost)} estimated · {suggestion.kcal} kcal</span></div>
            <span className="po-ai-source">{suggestion.source}</span>
          </div>
          <p>{suggestion.reason}</p>
          <div className="po-ai-macros">{suggestion.protein}g protein · {suggestion.carbs}g carbs · {suggestion.fats}g fat</div>
          <div className="po-ai-ingredients">{(suggestion.ingredients || []).map((ingredient) => <span key={ingredient.fct_id}>{ingredient.quantity} {ingredient.name}</span>)}</div>
        </div>
      )}

      <div className="po-summary-bar">
        <div className="po-summary-item">
          <div className="po-summary-label">Daily Budget</div>
          <div className="po-summary-value yellow">₱{appliedBudget}</div>
        </div>
        <div className="po-summary-divider" />
        <div className="po-summary-item">
          <div className="po-summary-label">Per Meal</div>
          <div className="po-summary-value yellow">₱{perMeal}</div>
        </div>
        <div className="po-summary-divider" />
        <div className="po-summary-item">
          <div className="po-summary-label">Affordable Meals</div>
          <div className="po-summary-value green">{affordableCount} / {meals.length}</div>
        </div>
        <div className="po-summary-divider" />
        <div className="po-summary-item">
          <div className="po-summary-label">Cheapest Full Day</div>
          <div className={`po-summary-value ${cheapestDay <= appliedBudget ? 'green' : 'red'}`}>₱{cheapestDay}</div>
        </div>
        <div className="po-summary-divider" />
        <div className="po-budget-progress">
          <div className="po-budget-bar-labels"><span>Cheapest day cost</span><span>{Math.min(Math.round((cheapestDay / appliedBudget) * 100), 120)}%</span></div>
          <div className="po-budget-bar-bg">
            <div
              className="po-budget-bar-fill"
              style={{
                width: `${Math.min(Math.round((cheapestDay / appliedBudget) * 100), 100)}%`,
                background: cheapestDay <= appliedBudget ? '#2ddc7a' : '#f87171',
              }}
            />
          </div>
        </div>
      </div>

      <div className="po-controls">
        <span className="po-sort-label">Sort by:</span>
        <button
          type="button"
          className={`po-sort-btn ${sortMode === 'cost' ? 'active' : ''}`}
          onClick={() => setSortMode('cost')}
        >
          ₱ Price
        </button>
        <button
          type="button"
          className={`po-sort-btn ${sortMode === 'kcal_per_peso' ? 'active' : ''}`}
          onClick={() => setSortMode('kcal_per_peso')}
        >
          ⚡ Best Value
        </button>
        <span className="po-count-badge"><span>{visibleMeals.length}</span> meals</span>
        <button
          type="button"
          className={`po-filter-toggle ${filterOver ? 'active' : ''}`}
          onClick={() => setFilterOver((prev) => !prev)}
        >
          {filterOver ? 'Show all meals' : 'Hide over budget'}
        </button>
      </div>

      <div className="po-meals-list">
        {visibleMeals.map((meal) => {
          const isOver = meal.cost > perMeal;
          const affordClass = meal.cost <= perMeal * 0.6 ? 'cheap'
            : meal.cost <= perMeal ? 'okay'
            : meal.cost <= perMeal * 1.3 ? 'pricey'
            : 'over';
          const valueScore = Math.round((meal.kcal / meal.cost) * 10) / 10;
          const maxIngredientCost = Math.max(...(meal.ingredients || []).map((ingredient) => ingredient.cost || 0), 0);

          return (
            <div key={meal.id} className={`po-meal-row ${isOver ? 'over-budget' : ''}`}>
              <div className="po-meal-main" onClick={() => toggleExpand(meal.id)}>
                <div className={`po-meal-rank ${meal.id.startsWith('m') && parseInt(meal.id.slice(1), 10) <= 3 ? 'top3' : ''}`}>{meal.id.startsWith('m') ? `#${meal.id.slice(1)}` : meal.id}</div>
                <div className="po-meal-emoji">{meal.emoji}</div>
                <div className="po-meal-info">
                  <div className="po-meal-name">{meal.name}</div>
                  <div className="po-meal-meta">
                    <span>{meal.type}</span>
                    <span>· {meal.kcal} kcal</span>
                    <span>· ⚡ {valueScore} kcal/₱</span>
                  </div>
                </div>
                <div className="po-meal-cost-wrap">
                  <div className="po-meal-cost">₱{meal.cost}</div>
                  <span className={`po-price-source ${meal.pricingSource === 'market' ? 'market' : ''}`}>
                    {meal.pricingSource === 'market' ? 'Market estimate' : 'Recipe estimate'}
                  </span>
                  <span className={`po-afford-badge ${affordClass}`}>{affordClass === 'cheap' ? 'Budget-Friendly' : affordClass === 'okay' ? 'Affordable' : affordClass === 'pricey' ? 'Slightly Over' : 'Over Budget'}</span>
                </div>
                <button className={`po-expand-btn ${expandedId === meal.id ? 'open' : ''}`} type="button" onClick={(event) => { event.stopPropagation(); toggleExpand(meal.id); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
              </div>
              <div className={`po-meal-detail ${expandedId === meal.id ? 'open' : ''}`}>
                <div className="po-detail-inner">
                  <div style={{ fontSize: 11, color: '#4d6e5a', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                    Ingredient Cost Breakdown
                  </div>
                  <div className="po-ing-cost-table-wrap">
                    <table className="po-ing-cost-table">
                      <thead>
                        <tr>
                          <th scope="col">Ingredient</th>
                          <th scope="col">Quantity</th>
                          <th scope="col">Grams</th>
                          <th scope="col">Calories</th>
                          <th scope="col">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(meal.ingredients || []).map((ing) => {
                          const barPct = maxIngredientCost > 0 ? Math.round(((ing.cost || 0) / maxIngredientCost) * 100) : 0;
                          return (
                            <tr key={ing.name}>
                              <td><span className="po-ing-cost-name"><span className="po-ing-dot" />{ing.name}</span></td>
                              <td>{ing.quantity || '—'}</td>
                              <td>{ing.grams ? `${ing.grams} g` : '—'}</td>
                              <td>{ing.calories == null ? '—' : `${ing.calories} kcal`}</td>
                              <td>
                                <div className="po-ing-cost-cell">
                                  <span className="po-cost-bar-bg"><span className="po-cost-bar-fill" style={{ width: `${barPct}%` }} /></span>
                                  <span className="po-ing-cost-price">₱{ing.cost || 0}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {buildSubSuggestion(meal)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function computeCheapestDay(meals = [], perMeal) {
  const types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  return types.reduce((total, type) => {
    const mealsOfType = meals.filter((meal) => meal.type === type);
    if (mealsOfType.length === 0) return total;
    const cheapest = mealsOfType.reduce((a, b) => (a.cost < b.cost ? a : b));
    return total + cheapest.cost;
  }, 0);
}

function SlotCard({ slot, idx, profile, appliedOptimization, onPortionApplied, onOriginalMeal, activeConstraints, constraintDefinitions, getMeal, totalMealsToday, groceryList, openOptimizerId, onSetOpenOptimizer, onRemove, onSwap, onAddGrocery }) {
  const meal = getMeal(slot.mealId);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const alreadyAdded = meal && groceryList.some((g) => g.mealId === meal.id);
  const seasonScore = meal ? scoreRecipe(meal.ingredients) : null;
  const violations = meal ? checkRecipeViolations(meal, activeConstraints, true, constraintDefinitions) : [];

  return (
    <div>
      <div className="slot-header">
        <div className="slot-time-pill">⏰ {slot.time || (meal ? meal.prep : '--:--')}</div>
        <span className="slot-type-label">{slot.type}</span>
        <button className="slot-remove-btn" title="Remove slot" onClick={onRemove}>✕</button>
      </div>

      {!meal ? (
        <div className="empty-slot" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px' }}>
          <span className="empty-slot-icon">🍽️</span>
          <span>No recipe assigned to this {slot.type} slot.</span>
          <button className="mp-btn mp-btn-outline" style={{ fontSize: 13, marginTop: 4 }} onClick={() => onSwap({ type: slot.type }, idx)}>
            + Select Recipe
          </button>
        </div>
      ) : (
        <>
          <div className="meal-card" data-meal-id={meal.id}>
            <div className="meal-card-top">
              <div className="meal-card-emoji">{meal.emoji}</div>
              <div className="meal-card-info">
                <div className="meal-card-name-row">
                  <div className="meal-card-name">{meal.name}</div>
                  {appliedOptimization && <span className="meal-optimized-badge">Optimized meal</span>}
                </div>
                <div className="meal-card-meta">{slot.time || 'Meal'} &nbsp;·&nbsp; {meal.prep} prep</div>
                <div className="meal-macro-chips">
                  <div className="macro-chip"><b>{meal.protein}g</b> Protein</div>
                  <div className="macro-chip"><b>{meal.carbs}g</b> Carbs</div>
                  <div className="macro-chip"><b>{meal.fats}g</b> Fats</div>
                  {seasonScore && <SeasonBadge scoreResult={seasonScore} />}
                  <ViolationBadge violations={violations} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="meal-kcal-badge"><span>{meal.kcal}</span><small>kcal</small></div>
                <div className={`meal-cost-badge${!meal.cost ? ' meal-cost-badge--zero' : ''}`}>₱{meal.cost}</div>
              </div>
            </div>

            <ViolationDetail violations={violations} />

            <div className={'meal-card-ingredients' + (ingredientsOpen ? ' open' : '')}>
              <div className="ingredient-table-wrap">
                <table className="ingredient-table">
                  <thead>
                    <tr>
                      <th scope="col">Ingredient</th>
                      <th scope="col">Quantity</th>
                      <th scope="col">Grams</th>
                      <th scope="col">Calories</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meal.ingredients.map((ing) => {
                      const optimizedIngredient = appliedOptimization?.ingredients?.find((item) => item.name === ing.name);
                      const scaleFactor = appliedOptimization?.scaleFactor ?? 1;
                      const grams = Number(ing.grams) || 0;
                      const displayedGrams = grams ? Math.round(grams * scaleFactor) : null;
                      const quantityLabel = getIngredientQuantityLabel(ing, optimizedIngredient?.optimized);
                      const calories = ing.calories == null ? null : Math.round(ing.calories * scaleFactor);
                      return (
                      <Fragment key={ing.name}>
                        <tr>
                          <td>
                            <div className="ingredient-table-name">
                              <div className="ingredient-dot"></div>
                              <span className="ingredient-name">{ing.name}</span>
                            </div>
                          </td>
                          <td>{quantityLabel}</td>
                          <td>{displayedGrams == null ? '—' : `${displayedGrams} g`}</td>
                          <td>{calories == null ? '—' : `${calories} kcal`}</td>
                        </tr>
                        <tr className="ingredient-seasonal-row">
                          <td colSpan="4"><SeasonalAltBanner ingredientName={ing.name} /></td>
                        </tr>
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="meal-card-actions">
              <button className="meal-action-btn swap" onClick={() => onSwap(meal, idx)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" /></svg>
                Swap meal
              </button>
              <button className={'meal-action-btn grocery' + (alreadyAdded ? ' added' : '')} onClick={() => onAddGrocery(meal)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                {alreadyAdded ? 'Added ✓' : 'Add to grocery'}
              </button>
              <OptimizeButton onToggle={() => onSetOpenOptimizer(openOptimizerId === meal.id ? null : meal.id)} />
              <WhyButton meal={meal} profile={profile} />
              <button className={'toggle-ingredients-btn' + (ingredientsOpen ? ' open' : '')} onClick={() => setIngredientsOpen((v) => !v)}>
                Ingredients <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
              </button>
            </div>
          </div>

          <PortionOptimizerPanel
            meal={meal}
            profile={profile}
            totalMealsToday={totalMealsToday}
            open={openOptimizerId === meal.id}
            onClose={() => onSetOpenOptimizer(null)}
            onApplied={onPortionApplied}
            onOriginalMeal={onOriginalMeal}
          />
        </>
      )}
    </div>
  );
}