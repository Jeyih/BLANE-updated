export function philippineClock(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    dayIndex: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function weekStartKey(date = new Date(), offset = 0) {
  const local = philippineClock(date);
  const monday = new Date(local.dateKey + 'T12:00:00Z');
  monday.setUTCDate(monday.getUTCDate() - ((local.dayIndex + 6) % 7) + offset * 7);
  return monday.toISOString().slice(0, 10);
}
export function slotOptimizationKey(week, day, slot) {
  return week + ':' + day + ':' + encodeURIComponent(slot.id) + ':' + encodeURIComponent(String(slot.mealId || 'empty'));
}
