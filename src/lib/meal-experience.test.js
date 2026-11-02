import test from 'node:test';
import assert from 'node:assert/strict';
import {
  philippineClock,
  slotMinutes,
  timedSlotIndex,
  currentMealType,
  mealScheduleForDay,
  dashboardMealChoices,
  availableMealSlots,
  DEFAULT_SLOTS,
  isDessert,
  addMealForToday,
} from './meal-experience.js';
test('Dashboard changes meal at Philippine schedule boundaries and midnight', () => {
  assert.equal(currentMealType(new Date('2026-10-14T02:29:59Z')), 'Breakfast');
  assert.equal(currentMealType(new Date('2026-10-14T02:30:00Z')), 'Lunch');
  assert.equal(currentMealType(new Date('2026-10-14T04:00:00Z')), 'Lunch');
  assert.equal(currentMealType(new Date('2026-10-14T04:59:59Z')), 'Lunch');
  assert.equal(currentMealType(new Date('2026-10-14T05:00:00Z')), 'Lunch');
  assert.equal(currentMealType(new Date('2026-10-14T10:29:59Z')), 'Snack');
  assert.equal(currentMealType(new Date('2026-10-14T07:00:00Z')), 'Snack');
  assert.equal(currentMealType(new Date('2026-10-14T10:30:00Z')), 'Dinner');
  assert.equal(currentMealType(new Date('2026-10-14T16:00:00Z')), 'Breakfast');
  assert.equal(philippineClock(new Date('2026-10-14T16:00:00Z')).dateKey, '2026-10-15');
});

test('the recommendation schedule uses the current Philippine day and counts custom slots without crashing on malformed storage', () => {
  const date = new Date('2026-10-31T23:00:00Z'); // Sunday morning in the Philippines.
  const slots = [...DEFAULT_SLOTS, { type: 'Evening snack', time: '9:00 PM' }];
  const plan = { 0: slots, 6: [{ type: 'Breakfast' }] };
  assert.deepEqual(mealScheduleForDay(plan, date), slots);
  assert.equal(mealScheduleForDay(plan, date).length, 5);
  for (const value of [null, {}, { 0: [] }, { 0: 'invalid' }, { 0: [null, {}] }]) {
    assert.deepEqual(mealScheduleForDay(value, date), DEFAULT_SLOTS);
  }
});

test('Dashboard choices include Brunch, custom meals and each repeated meal slot with a distinct label', () => {
  const morning = new Date('2026-11-01T00:00:00Z');
  const slots = [
    { id:'a', type:'Breakfast', time:'7:00 AM', mealId:'rice' },
    { id:'b', type:'Breakfast', time:'8:00 AM', mealId:'rice' },
    { id:'c', type:'Brunch', time:'10:00 AM', mealId:'soup' },
    { id:'d', type:'Extra snack', time:'Your own', mealId:'corn' },
    { id:'e', type:'Dinner', time:'6:30 PM', mealId:'soup' },
  ];
  const choices = dashboardMealChoices(slots, morning);
  assert.deepEqual(choices.map(choice => choice.id), ['a','b','c','d','e']);
  assert.notEqual(choices[0].label, choices[1].label);
  assert.equal(choices[timedSlotIndex(choices.map(choice=>choice.slot), morning)].id, 'b');
  assert.deepEqual(dashboardMealChoices(slots, new Date('2026-11-01T06:00:00Z')).map(choice=>choice.id), ['d','e']);
  assert.deepEqual(dashboardMealChoices([], morning), []);
});
test('expired Dashboard options stay hidden until Philippine midnight without changing saved slots', () => {
  const slots = DEFAULT_SLOTS.map((slot, i) => ({ ...slot, mealId: `meal-${i}` }));
  const saved = JSON.stringify(slots);
  const typesAt = (time) => availableMealSlots(slots, new Date(time)).map((slot) => slot.type);
  assert.deepEqual(typesAt('2026-10-14T02:29:59Z'), ['Breakfast', 'Lunch', 'Snack', 'Dinner']);
  assert.deepEqual(typesAt('2026-10-14T02:30:00Z'), ['Lunch', 'Snack', 'Dinner']);
  assert.deepEqual(typesAt('2026-10-14T06:29:59Z'), ['Lunch', 'Snack', 'Dinner']);
  assert.deepEqual(typesAt('2026-10-14T06:30:00Z'), ['Snack', 'Dinner']);
  assert.deepEqual(typesAt('2026-10-14T10:59:59Z'), ['Snack', 'Dinner']);
  assert.deepEqual(typesAt('2026-10-14T11:00:00Z'), ['Dinner']);
  assert.deepEqual(typesAt('2026-10-14T15:59:59Z'), ['Dinner']);
  assert.deepEqual(typesAt('2026-10-14T16:00:00Z'), ['Breakfast', 'Lunch', 'Snack', 'Dinner']);
  assert.equal(JSON.stringify(slots), saved);
});
test('custom serving times and missing upcoming slots never restore an expired meal', () => {
  const date = new Date('2026-10-14T05:00:00Z');
  const slots = [
    { type: 'Dinner', time: '7:30 PM' },
    { type: 'Breakfast', time: '11:00 AM' },
    { type: 'Lunch', time: '1:15 PM' },
  ];
  assert.deepEqual(availableMealSlots(slots, date), [slots[0], slots[2]]);
  assert.equal(currentMealType(date, slots), 'Lunch');
  assert.equal(currentMealType(date, [slots[1], slots[2]]), 'Lunch');
  assert.equal(currentMealType(new Date('2026-10-14T10:30:00Z'), []), 'Dinner');
  assert.deepEqual(availableMealSlots([], date), []);
});
test('custom slots select by actual time instead of their array order', () => {
  const slots = [
    { type: 'Dinner', time: '7:30 PM' },
    { type: 'Breakfast', time: '8:00 AM' },
    { type: 'Lunch', time: '1:15 PM' },
  ];
  assert.equal(timedSlotIndex(slots, new Date('2026-10-14T05:15:00Z')), 2);
  assert.equal(slotMinutes('12:00 AM'), 0);
  assert.equal(slotMinutes('12:00 PM'), 720);
  assert.equal(slotMinutes('18:30'), 1110);
  assert.equal(slotMinutes('25:00'), null);
  assert.equal(timedSlotIndex([], new Date()), 0);
});
test('one-click meal selection preserves other meals, custom times and other days', () => {
  let value = JSON.stringify({
    3: [
      { type: 'Lunch', time: '1:00 PM', mealId: 'old' },
      { type: 'Dinner', time: '7:00 PM', mealId: 'dinner' },
    ],
    4: [{ mealId: 'tomorrow' }],
  });
  const data = new Map([['blane_meal_plan', value]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, next) => { data.set(key, next); if (key === 'blane_meal_plan') value = next; } };
  const date = new Date('2026-10-14T04:00:00Z');
  addMealForToday({ id: 'new', type: 'Lunch' }, { date, storage });
  const plan = JSON.parse(value);
  assert.equal(plan[3][0].mealId, 'new');
  assert.equal(plan[3][0].time, '1:00 PM');
  assert.equal(plan[3][1].mealId, 'dinner');
  assert.equal(plan[4][0].mealId, 'tomorrow');
  addMealForToday({ id: 'new', type: 'Lunch' }, { date, storage });
  assert.equal(
    JSON.parse(value)[3].length,
    2,
    'Repeated tap replaces the slot instead of duplicating it',
  );
});
test('dessert records use their database meal type and are added to the snack slot', () => {
  const dessert = { name: 'Cassava Cake', type: 'Snack', is_dessert: true, ingredients: [] };
  assert.equal(isDessert(dessert), true);
  assert.equal(isDessert({ name: 'Chicken Curry', type: 'Lunch', ingredients: [] }), false);
  assert.equal(isDessert({ name: 'Old dessert', type: 'Dessert' }), true);
  let value = 'broken data';
  const data = new Map([['blane_meal_plan', value]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, next) => { data.set(key, next); if (key === 'blane_meal_plan') value = next; } };
  addMealForToday(
    { id: 'cake', type: 'Snack', is_dessert: true },
    { date: new Date('2026-10-14T07:00:00Z'), storage },
  );
  assert.equal(JSON.parse(value)[3].find((s) => s.type === 'Snack').mealId, 'cake');
  assert.equal(JSON.parse(value)[3].length, DEFAULT_SLOTS.length);
});
