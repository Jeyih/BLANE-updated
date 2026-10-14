export const DEFAULT_SLOTS = [
  { type: 'Breakfast', time: '7:00 AM' }, { type: 'Lunch', time: '12:00 PM' },
  { type: 'Snack', time: '3:00 PM' }, { type: 'Dinner', time: '6:30 PM' },
];
export function philippineClock(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila',
    weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return { dayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}
export function slotMinutes(time) {
  const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute > 59 || hour > (match[3] ? 12 : 23) || match[3] && hour < 1) return null;
  if (match[3]) hour = hour % 12 + (/pm/i.test(match[3]) ? 12 : 0);
  return hour * 60 + minute;
}
export function timedSlotIndex(slots, date = new Date()) {
  const now = philippineClock(date).minutes;
  const timed = slots.map((s, index) => ({ index, minute: slotMinutes(s.time) ?? slotMinutes(DEFAULT_SLOTS.find((p) => p.type === s.type)?.time) }))
    .filter((s) => s.minute !== null).sort((a, b) => a.minute - b.minute);
  if (!timed.length) return 0;
  return [...timed].reverse().find((s) => s.minute <= now)?.index ?? timed[0].index;
}
// Dashboard cutoffs are independent of saved preparation/serving times.
const MEAL_CUTOFFS = { Breakfast: 630, Brunch: 780, Lunch: 780, Snack: 1110, Dessert: 1110 };
export function availableMealSlots(slots, date = new Date()) {
  const minutes = philippineClock(date).minutes;
  return slots.filter((slot) => MEAL_CUTOFFS[slot.type] === undefined || minutes < MEAL_CUTOFFS[slot.type]);
}
export function currentMealType(date = new Date(), slots = DEFAULT_SLOTS) {
  let available = availableMealSlots(slots, date);
  if (!available.length) available = availableMealSlots(DEFAULT_SLOTS, date);
  return available[timedSlotIndex(available, date)].type;
}
export function isDessert(recipe) {
  return recipe.type === 'Dessert' || /cassava cake|bibingka|polvoron|banana cue|turon|camote cue|sweet potato.*sugar|banana.*sugar|puto|champorado|suman|ginataang monggo|biko|leche flan|halo.?halo/i.test(recipe.name || '')
    || recipe.ingredients?.some((i) => /rice cake|cookies, polvoron|banana, saba, w\/ sugar|sweet potato, w\/ sugar/i.test(i.name));
}
export function addMealForToday(recipe, { date = new Date(), type = recipe.type === 'Dessert' ? 'Snack' : recipe.type,
  storage = localStorage } = {}) {
  if (!recipe.id || !type) throw new Error('Choose a meal first.');
  let plan = {};
  try { const saved = JSON.parse(storage.getItem('blane_meal_plan') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) plan = saved; } catch { /* Create a new plan when stored data is damaged. */ }
  const day = philippineClock(date).dayIndex;
  const slots = Array.isArray(plan[day]) ? [...plan[day]] : DEFAULT_SLOTS.map((s) => ({ ...s, mealId: null }));
  const index = slots.findIndex((s) => s.type === type);
  const slot = { ...(index >= 0 ? slots[index] : DEFAULT_SLOTS.find((s) => s.type === type) || { type, time: '3:00 PM' }), mealId: recipe.id };
  if (index >= 0) slots[index] = slot; else slots.push(slot);
  plan[day] = slots;
  storage.setItem('blane_meal_plan', JSON.stringify(plan));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('blane-meal-plan-updated'));
  return { day, type, recipeId: recipe.id };
}
