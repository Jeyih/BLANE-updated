/* ============================================================
   BLANE — Meal Plan Page
   Replaces: mealplan.html + js/mealplan.js entirely.

   Fetches real recipes from Supabase (recipes, recipe_ingredients)
   and manages weekly meal slots, calorie goals, swap options,
   and grocery list generation.
   ============================================================ */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import WhyButton from '../components/WhyButton';
import PortionOptimizerPanel, { OptimizeButton } from '../components/PortionOptimizerPanel';
import { scoreRecipe } from '../lib/seasonal';
import { SeasonBadge, IngSeasonTag, SeasonalAltBanner } from '../components/SeasonalBadges';
import '../styles/mealplan.css';

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
  const [currentWeekOffset, setWeekOffset]     = useState(0);
  const [selectedDayIndex, setSelectedDay]     = useState(new Date().getDay());
  const [daySlots, setDaySlots]                = useState({});
  const [groceryList, setGroceryList]          = useState(() => JSON.parse(sessionStorage.getItem('blane_grocery') || '[]'));
  const [openOptimizerId, setOpenOptimizerId] = useState(null);

  const [addSlotOpen, setAddSlotOpen]             = useState(false);
  const [slotTypeChoice, setSlotTypeChoice]       = useState(null);
  const [customSlotName, setCustomSlotName]       = useState('');
  const [selectedRecipeForAdd, setSelectedRecipeForAdd] = useState('');

  const [swapTarget, setSwapTarget] = useState(null);
  const [swapChoice, setSwapChoice] = useState(null);

  useEffect(() => {
    loadProfile();
    loadRecipes();
  }, [user]);

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
    const ingByRecipe = {};
    (ingData || []).forEach((ing) => {
      if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
      ingByRecipe[ing.recipe_id].push({ name: ing.name, qty: ing.qty, status: ing.status || 'avail' });
    });

    const formatted = (recipesData || []).map((r) => ({
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
      ingredients: ingByRecipe[r.id] || [],
    }));

    setRecipes(formatted);
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
    setDaySlots(generateDefaultPlan(formatted));
  }

  useEffect(() => {
    if (Object.keys(daySlots).length > 0) {
      localStorage.setItem('blane_meal_plan', JSON.stringify(daySlots));
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

  const today = new Date();
  const base = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;
  base.setDate(today.getDate() - dayOfWeek + currentWeekOffset * 7);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekEnd = new Date(base); weekEnd.setDate(base.getDate() + 6);
  const weekLabel = months[base.getMonth()] + ' ' + base.getDate() + ' – ' + months[weekEnd.getMonth()] + ' ' + weekEnd.getDate() + ', ' + weekEnd.getFullYear();

  const totalKcal = slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.kcal || 0), 0);
  const totalCost = slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.cost || 0), 0);
  const totalProtein = slots.reduce((s, slot) => s + (getMeal(slot.mealId)?.protein || 0), 0);
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

function SlotCard({ slot, idx, profile, getMeal, totalMealsToday, groceryList, openOptimizerId, onSetOpenOptimizer, onRemove, onSwap, onAddGrocery }) {
  const meal = getMeal(slot.mealId);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const alreadyAdded = meal && groceryList.some((g) => g.mealId === meal.id);
  const seasonScore = meal ? scoreRecipe(meal.ingredients) : null;

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
                <div className="meal-card-name">{meal.name}</div>
                <div className="meal-card-meta">{slot.time || 'Meal'} &nbsp;·&nbsp; {meal.prep} prep</div>
                <div className="meal-macro-chips">
                  <div className="macro-chip"><b>{meal.protein}g</b> Protein</div>
                  <div className="macro-chip"><b>{meal.carbs}g</b> Carbs</div>
                  <div className="macro-chip"><b>{meal.fats}g</b> Fats</div>
                  {seasonScore && <SeasonBadge scoreResult={seasonScore} />}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="meal-kcal-badge">{meal.kcal}<small>kcal</small></div>
                <div className="meal-cost-badge">₱{meal.cost}</div>
              </div>
            </div>

            <div className={'meal-card-ingredients' + (ingredientsOpen ? ' open' : '')}>
              <div className="ingredients-title">Ingredients</div>
              {meal.ingredients.map((ing) => (
                <div key={ing.name}>
                  <div className="ingredient-row">
                    <div className="ingredient-dot"></div>
                    <span className="ingredient-name">{ing.name}</span>
                    <span className="ingredient-qty">{ing.qty}</span>
                    <IngSeasonTag ingredientName={ing.name} />
                    <span className={'ingredient-status ' + ing.status}>{ing.status === 'avail' ? '✓ Available' : '⚠ Check market'}</span>
                  </div>
                  <SeasonalAltBanner ingredientName={ing.name} />
                </div>
              ))}
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
          />
        </>
      )}
    </div>
  );
}