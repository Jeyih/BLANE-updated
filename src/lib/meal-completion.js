export const COMPLETED_MEALS_KEY = 'blane_completed_meals_v2';

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function getMealCompletionKey(date, slot, index) {
  return `${dateKey(date)}:slot:${encodeURIComponent(slot.id || `index-${index}`)}:${encodeURIComponent(slot.type || '')}:${encodeURIComponent(String(slot.mealId || 'empty'))}`;
}

export function legacyCompletionKey(date, slot, index) {
  return `${dateKey(date)}:${index}:${slot.type}:${slot.mealId || 'empty'}`;
}

export function readCompletionRecords(storage) {
  try {
    const stored = storage.getItem(COMPLETED_MEALS_KEY) ?? storage.getItem('blane_completed_meals');
    const parsed = JSON.parse(stored || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function migrateWeekCompletions(records, week, days) {
  let next = records;
  for (let day = 0; day < 7; day++) {
    const date = new Date(`${week}T12:00:00`);
    date.setDate(date.getDate() + ((day + 6) % 7));
    (days[day] || []).forEach((slot, index) => {
      const legacy = legacyCompletionKey(date, slot, index);
      if (!Object.hasOwn(next, legacy)) return;
      if (next === records) next = { ...records };
      const key = getMealCompletionKey(date, slot, index);
      if (next[legacy] === true && !Object.hasOwn(next, key)) next[key] = true;
      // Consume migrated keys, so Undo cannot resurrect a legacy Finished flag.
      // The original storage key remains untouched as a backup.
      delete next[legacy];
    });
  }
  return next;
}
