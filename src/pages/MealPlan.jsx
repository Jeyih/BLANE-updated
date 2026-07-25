/* ============================================================
   BLANE — Meal Plan Page
   Replaces: mealplan.html + js/mealplan.js entirely.

   State that used to live in module-level `let` variables
   (currentWeekOffset, selectedDayIndex, daySlots, groceryList)
   is now React state on the page component. Modals are
   conditionally rendered instead of toggled via CSS classes.
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

const MEAL_DB = [
  { id: 'm1', emoji: '🍳', name: 'Egg & Malunggay Scramble', type: 'Breakfast', time: '7:00 AM', prep: '15 min', kcal: 380, cost: 45, protein: 24, carbs: 18, fats: 12,
    ingredients: [{ name: 'Eggs', qty: '2 pcs', status: 'avail' }, { name: 'Malunggay', qty: '1 handful', status: 'avail' }, { name: 'Garlic', qty: '2 cloves', status: 'avail' }, { name: 'Cooking oil', qty: '1 tsp', status: 'avail' }] },
  { id: 'm2', emoji: '🥗', name: 'Chicken & Veggie Rice Bowl', type: 'Lunch', time: '12:00 PM', prep: '25 min', kcal: 520, cost: 95, protein: 38, carbs: 52, fats: 10,
    ingredients: [{ name: 'Chicken breast', qty: '150g', status: 'avail' }, { name: 'Brown rice', qty: '1 cup', status: 'avail' }, { name: 'Broccoli', qty: '80g', status: 'warn' }, { name: 'Soy sauce', qty: '1 tbsp', status: 'avail' }] },
  { id: 'm3', emoji: '🍲', name: 'Sinigang na Isda', type: 'Dinner', time: '6:30 PM', prep: '35 min', kcal: 480, cost: 80, protein: 32, carbs: 28, fats: 8,
    ingredients: [{ name: 'Bangus / Tilapia', qty: '200g', status: 'avail' }, { name: 'Kangkong', qty: '1 bundle', status: 'avail' }, { name: 'Tamarind mix', qty: '1 pack', status: 'avail' }, { name: 'Tomatoes', qty: '2 pcs', status: 'avail' }] },
  { id: 'm4', emoji: '🍌', name: 'Banana & Peanut Butter', type: 'Snack', time: '3:00 PM', prep: '5 min', kcal: 210, cost: 25, protein: 6, carbs: 30, fats: 8,
    ingredients: [{ name: 'Ripe banana', qty: '1 pc', status: 'avail' }, { name: 'Peanut butter', qty: '1 tbsp', status: 'avail' }] },
  { id: 'm5', emoji: '🥣', name: 'Oatmeal with Banana & Honey', type: 'Breakfast', time: '7:00 AM', prep: '10 min', kcal: 320, cost: 35, protein: 10, carbs: 58, fats: 6,
    ingredients: [{ name: 'Rolled oats', qty: '1/2 cup', status: 'avail' }, { name: 'Banana', qty: '1 pc', status: 'avail' }, { name: 'Honey', qty: '1 tsp', status: 'avail' }, { name: 'Milk', qty: '1 cup', status: 'avail' }] },
  { id: 'm6', emoji: '🍜', name: 'Arroz Caldo', type: 'Breakfast', time: '7:30 AM', prep: '30 min', kcal: 340, cost: 50, protein: 18, carbs: 48, fats: 7,
    ingredients: [{ name: 'Glutinous rice', qty: '1/2 cup', status: 'avail' }, { name: 'Chicken', qty: '100g', status: 'avail' }, { name: 'Ginger', qty: '2 slices', status: 'avail' }] },
  { id: 'm7', emoji: '🥩', name: 'Grilled Pork Liempo', type: 'Lunch', time: '12:00 PM', prep: '40 min', kcal: 560, cost: 110, protein: 42, carbs: 10, fats: 28,
    ingredients: [{ name: 'Pork belly', qty: '200g', status: 'avail' }, { name: 'Calamansi', qty: '4 pcs', status: 'avail' }, { name: 'Garlic', qty: '4 cloves', status: 'avail' }] },
  { id: 'm8', emoji: '🍛', name: 'Monggo Soup', type: 'Dinner', time: '6:00 PM', prep: '45 min', kcal: 380, cost: 55, protein: 22, carbs: 45, fats: 6,
    ingredients: [{ name: 'Mung beans', qty: '1/2 cup', status: 'avail' }, { name: 'Ampalaya leaves', qty: '1 handful', status: 'warn' }, { name: 'Garlic & onion', qty: 'to taste', status: 'avail' }] },
];

const SLOT_PRESETS = [
  { type: 'Breakfast', icon: '🌅', time: '7:00 AM' },
  { type: 'Brunch', icon: '🍳', time: '10:00 AM' },
  { type: 'Lunch', icon: '☀️', time: '12:00 PM' },
  { type: 'Snack', icon: '🍎', time: '3:00 PM' },
  { type: 'Dinner', icon: '🌙', time: '6:30 PM' },
  { type: 'Custom', icon: '✏️', time: 'Your own' },
];

const CAL_GOAL = 1840;

function getMeal(id) { return MEAL_DB.find((m) => m.id === id) || null; }

export default function MealPlan() {
  const { user } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [currentWeekOffset, setWeekOffset]   = useState(0);
  const [selectedDayIndex, setSelectedDay]   = useState(new Date().getDay());
  const [daySlots, setDaySlots]              = useState(() => seedDemoSlots());
  const [groceryList, setGroceryList]        = useState(() => JSON.parse(sessionStorage.getItem('blane_grocery') || '[]'));
  const [openOptimizerId, setOpenOptimizerId] = useState(null);

  const [addSlotOpen, setAddSlotOpen]   = useState(false);
  const [slotTypeChoice, setSlotTypeChoice] = useState(null);
  const [customSlotName, setCustomSlotName] = useState('');

  const [swapTarget, setSwapTarget] = useState(null);
  const [swapChoice, setSwapChoice] = useState(null);

  useEffect(() => { loadProfile(); }, [user]);
  useEffect(() => { sessionStorage.setItem('blane_grocery', JSON.stringify(groceryList)); }, [groceryList]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) setProfile(data);
  }

  function seedDemoSlots() {
    const todayNum = new Date().getDay();
    const slots = {};
    slots[todayNum] = [
      { type: 'Breakfast', mealId: 'm1' }, { type: 'Lunch', mealId: 'm2' },
      { type: 'Snack', mealId: 'm4' }, { type: 'Dinner', mealId: 'm3' },
    ];
    slots[(todayNum + 6) % 7] = [{ type: 'Breakfast', mealId: 'm5' }, { type: 'Dinner', mealId: 'm8' }];
    slots[(todayNum + 1) % 7] = [{ type: 'Breakfast', mealId: 'm6' }, { type: 'Lunch', mealId: 'm7' }];
    return slots;
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
  const dayPct = Math.min(Math.round((totalKcal / CAL_GOAL) * 100), 100);

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
    if (type === 'Custom') {
      if (!customSlotName.trim()) { alert('Please enter a custom slot name.'); return; }
      type = customSlotName.trim();
    }
    const match = MEAL_DB.find((m) => m.type === type);
    setDaySlots((prev) => {
      const next = { ...prev };
      next[selectedDayIndex] = [...(next[selectedDayIndex] || []), { type, mealId: match ? match.id : null }];
      return next;
    });
    setAddSlotOpen(false);
    setSlotTypeChoice(null);
    setCustomSlotName('');
  }

  function openSwap(meal, slotIdx) {
    setSwapTarget({ meal, slotIdx });
    setSwapChoice(null);
  }

  function confirmSwap() {
    if (!swapChoice) { alert('Please select an alternative meal.'); return; }
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
    setGroceryList((prev) => {
      const filtered = prev.filter((g) => g.mealId !== meal.id);
      return [...filtered, ...meal.ingredients.map((ing) => ({ mealId: meal.id, name: ing.name, qty: ing.qty, checked: false }))];
    });
  }

  function toggleGroceryChecked(idx) {
    setGroceryList((prev) => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  }

  function removeGroceryItem(idx) {
    setGroceryList((prev) => prev.filter((_, i) => i !== idx));
  }

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
              <button className="mp-btn mp-btn-outline">Export Week</button>
              <button className="mp-btn mp-btn-primary">Regenerate Plan</button>
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
                const isActive = jsDay === selectedDayIndex && currentWeekOffset === 0;
                const hasMeals = daySlots[jsDay]?.length > 0;
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
                  <span className="day-summary-value green">{totalKcal} <small style={{ fontSize: 13, color: '#4d6e5a', fontWeight: 400 }}>kcal</small></span>
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

              {slots.length === 0 ? (
                <div className="empty-slot"><span className="empty-slot-icon">🍽️</span>No meals planned yet. Add a slot below!</div>
              ) : (
                slots.map((slot, idx) => (
                  <SlotCard
                    key={idx}
                    slot={slot}
                    idx={idx}
                    profile={profile}
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

              <button className="mp-btn mp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Download List</button>
            </div>
          </div>

        </div>
      </main>

      {addSlotOpen && (
        <div className="slot-modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setAddSlotOpen(false); }}>
          <div className="slot-modal">
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
            <button className="mp-btn mp-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={confirmAddSlot}>Add Slot</button>
          </div>
        </div>
      )}

      {swapTarget && (
        <div className="swap-modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setSwapTarget(null); }}>
          <div className="swap-modal">
            <button className="swap-close" onClick={() => setSwapTarget(null)}>✕</button>
            <div className="swap-modal-label">Swap Meal</div>
            <div className="swap-modal-title">Swapping: {swapTarget.meal.name}</div>
            <div className="swap-options">
              {MEAL_DB.filter((m) => m.type === swapTarget.meal.type && m.id !== swapTarget.meal.id).slice(0, 3).map((alt) => (
                <div key={alt.id} className={'swap-option-card' + (swapChoice === alt.id ? ' selected' : '')} onClick={() => setSwapChoice(alt.id)}>
                  <div className="swap-option-emoji">{alt.emoji}</div>
                  <div className="swap-option-info">
                    <div className="swap-option-name">{alt.name}</div>
                    <div className="swap-option-meta"><span>{alt.kcal} kcal</span> &nbsp;{alt.protein}g protein &nbsp;{alt.prep} prep</div>
                  </div>
                  <div className="swap-option-cost">₱{alt.cost}</div>
                </div>
              ))}
            </div>
            <button className="mp-btn mp-btn-primary swap-confirm-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={confirmSwap}>Confirm Swap</button>
          </div>
        </div>
      )}
    </>
  );
}

function SlotCard({ slot, idx, profile, totalMealsToday, groceryList, openOptimizerId, onSetOpenOptimizer, onRemove, onSwap, onAddGrocery }) {
  const meal = getMeal(slot.mealId);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const alreadyAdded = meal && groceryList.some((g) => g.mealId === meal.id);
  const seasonScore = meal ? scoreRecipe(meal.ingredients) : null;

  return (
    <div>
      <div className="slot-header">
        <div className="slot-time-pill">⏰ {meal ? meal.time : '--:--'}</div>
        <span className="slot-type-label">{slot.type}</span>
        <button className="slot-remove-btn" title="Remove slot" onClick={onRemove}>✕</button>
      </div>

      {!meal ? (
        <div className="empty-slot">No meal assigned to this slot.</div>
      ) : (
        <>
          <div className="meal-card" data-meal-id={meal.id}>
            <div className="meal-card-top">
              <div className="meal-card-emoji">{meal.emoji}</div>
              <div className="meal-card-info">
                <div className="meal-card-name">{meal.name}</div>
                <div className="meal-card-meta">{meal.time} &nbsp;·&nbsp; {meal.prep} prep</div>
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