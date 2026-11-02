import { weekStartKey, slotOptimizationKey } from './meal-calendar.js';

export const WEEK_PLANS_KEY = 'blane_meal_plan_weeks_v1';
export const SLOT_OPTIMIZATIONS_KEY = 'blane_slot_optimizations_v1';
const LEGACY_WEEK_KEY = 'blane_meal_plan_legacy_week';

function readObject(storage, key) {
  try { const value = JSON.parse(storage.getItem(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}

export function newSlotId() {
  return globalThis.crypto?.randomUUID?.() || `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeWeek(week, freshIds = false) {
  const next = {};
  for (let day = 0; day < 7; day++) {
    if (!Array.isArray(week?.[day])) continue;
    const used = new Set();
    const reserved = new Set(week[day].filter(Boolean).map(slot => slot.id).filter(Boolean).map(String));
    next[day] = week[day].filter(slot => slot && typeof slot === 'object' && !Array.isArray(slot)).map((slot, index) => {
      let id = freshIds ? newSlotId() : String(slot.id || `slot-${day}-${index}`);
      while (used.has(id) || ((!slot.id || freshIds) && reserved.has(id))) id += '-copy';
      used.add(id);
      return { ...slot, id };
    });
  }
  return next;
}

export function readWeekPlan(storage, week = weekStartKey(), now = new Date()) {
  const plans = readObject(storage, WEEK_PLANS_KEY);
  if (Object.hasOwn(plans, week)) return normalizeWeek(plans[week]);
  const marker = storage.getItem(LEGACY_WEEK_KEY);
  if (week !== weekStartKey(now) || (marker && marker !== week)) return null;
  const legacy = normalizeWeek(readObject(storage, 'blane_meal_plan'));
  return Object.keys(legacy).length ? legacy : null;
}

export function writeWeekPlan(storage, week, days, now = new Date()) {
  const plans = readObject(storage, WEEK_PLANS_KEY);
  const currentWeek = weekStartKey(now);
  // Preserve the old current-week plan even if the first new edit is to a future week.
  if (!Object.hasOwn(plans, currentWeek)) {
    const legacy = readWeekPlan(storage, currentWeek, now);
    if (legacy) plans[currentWeek] = legacy;
  }
  const next = normalizeWeek(days);
  plans[week] = next;
  const serialized = JSON.stringify(plans);
  const changed = storage.getItem(WEEK_PLANS_KEY) !== serialized;
  storage.setItem(WEEK_PLANS_KEY, serialized);
  if (!storage.getItem(LEGACY_WEEK_KEY)) storage.setItem(LEGACY_WEEK_KEY, currentWeek);
  if (week === currentWeek) {
    storage.setItem('blane_meal_plan', JSON.stringify(next));
    storage.setItem(LEGACY_WEEK_KEY, currentWeek);
  }
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('blane-meal-plan-updated', { detail: { week } }));
  return next;
}

export function readSlotOptimizations(storage, week, days) {
  if (storage.getItem(SLOT_OPTIMIZATIONS_KEY) !== null) return readObject(storage, SLOT_OPTIMIZATIONS_KEY);
  const legacy = readObject(storage, 'blane_optimized_v2');
  const result = {};
  for (let day = 0; day < 7; day++) for (const slot of normalizeWeek(days)[day] || []) {
    if (legacy[slot.mealId]) result[slotOptimizationKey(week, day, slot)] = { ...legacy[slot.mealId] };
  }
  // Migrate once; retain the old data as a backup, but do not reapply it to new weeks.
  storage.setItem(SLOT_OPTIMIZATIONS_KEY, JSON.stringify(result));
  return result;
}
