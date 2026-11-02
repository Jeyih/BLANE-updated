import { philippineClock, weekStartKey } from './meal-calendar.js';
import { readWeekPlan, writeWeekPlan } from './week-plans.js';
import { localMealStorage as localStorage } from './account-storage.js';
const DEFAULT_SLOTS = [
  { type: 'Breakfast', time: '7:00 AM' },
  { type: 'Lunch', time: '12:00 PM' },
  { type: 'Snack', time: '3:00 PM' },
  { type: 'Dinner', time: '6:30 PM' },
];
function slotMinutes(time) {
  const match = String(time || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return null;
  if (match[3]) hour = (hour % 12) + (/pm/i.test(match[3]) ? 12 : 0);
  return hour * 60 + minute;
}
function timedSlotIndex(slots, date = new Date()) {
  const now = philippineClock(date).minutes;
  const timed = slots
    .map((s, index) => ({
      index,
      minute:
        slotMinutes(s.time) ?? slotMinutes(DEFAULT_SLOTS.find((p) => p.type === s.type)?.time),
    }))
    .filter((s) => s.minute !== null)
    .sort((a, b) => a.minute - b.minute);
  if (!timed.length) return 0;
  return [...timed].reverse().find((s) => s.minute <= now)?.index ?? timed[0].index;
}
const MEAL_CUTOFFS = { Breakfast: 630, Brunch: 780, Lunch: 870, Snack: 1140, Dessert: 1140 };
function availableMealSlots(slots, date = new Date()) {
  const minutes = philippineClock(date).minutes;
  return slots.filter(
    (slot) => MEAL_CUTOFFS[slot.type] === void 0 || minutes < MEAL_CUTOFFS[slot.type],
  );
}
function currentMealType(date = new Date(), slots = DEFAULT_SLOTS) {
  let available = availableMealSlots(slots, date);
  if (!available.length) available = availableMealSlots(DEFAULT_SLOTS, date);
  return available[timedSlotIndex(available, date)].type;
}
function mealScheduleForDay(plan, date = new Date()) {
  const slots = plan?.[philippineClock(date).dayIndex];
  if (!Array.isArray(slots)) return DEFAULT_SLOTS;
  const valid = slots.filter(slot => slot && typeof slot.type === 'string' && slot.type.trim());
  return valid.length ? valid : DEFAULT_SLOTS;
}
function dashboardMealChoices(slots, date = new Date()) {
  const visible = availableMealSlots(slots.filter(slot => slot && typeof slot.type === 'string' && slot.type.trim()), date);
  const counts = new Map();
  visible.forEach(slot => counts.set(slot.type, (counts.get(slot.type) || 0) + 1));
  const seen = new Map();
  return visible.map((slot, index) => {
    const ordinal = (seen.get(slot.type) || 0) + 1;
    seen.set(slot.type, ordinal);
    const repeated = counts.get(slot.type) > 1;
    const time = slotMinutes(slot.time) !== null ? slot.time : '';
    return {
      id: slot.id || `dashboard-slot-${index}`,
      slot,
      label: repeated ? `${slot.type} ${ordinal}${time ? ` · ${time}` : ''}` : slot.type,
    };
  });
}
function isDessert(recipe) {
  return recipe.is_dessert === true || recipe.type === 'Dessert';
}
function addMealForToday(
  recipe,
  {
    date = new Date(),
    type = isDessert(recipe) ? 'Snack' : recipe.type,
    storage = localStorage,
  } = {},
) {
  if (!recipe.id || !type) throw new Error('Choose a meal first.');
  const week = weekStartKey(date);
  const plan = readWeekPlan(storage, week, date) || {};
  const day = philippineClock(date).dayIndex;
  const slots = Array.isArray(plan[day])
    ? [...plan[day]]
    : DEFAULT_SLOTS.map((s) => ({ ...s, mealId: null }));
  const index = slots.findIndex((s) => s.type === type);
  const slot = {
    ...(index >= 0
      ? slots[index]
      : DEFAULT_SLOTS.find((s) => s.type === type) || { type, time: '3:00 PM' }),
    mealId: recipe.id,
  };
  if (index >= 0) slots[index] = slot;
  else slots.push(slot);
  plan[day] = slots;
  writeWeekPlan(storage, week, plan, date);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('blane-meal-plan-updated'));
  return { day, type, recipeId: recipe.id };
}
export {
  DEFAULT_SLOTS,
  addMealForToday,
  availableMealSlots,
  currentMealType,
  mealScheduleForDay,
  dashboardMealChoices,
  isDessert,
  philippineClock,
  slotMinutes,
  timedSlotIndex,
};
