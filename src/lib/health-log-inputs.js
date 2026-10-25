export function parseHealthLog({ weight, sleep, waterCups, calories }) {
  const inputs = { weight_kg: weight, sleep_hours: sleep, water_cups: waterCups, calories_burned: calories };
  const values = {};
  for (const [key, raw] of Object.entries(inputs)) {
    if (raw == null || String(raw).trim() === '') { values[key] = null; continue; }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || (key === 'weight_kg' && value === 0)) throw new Error('Enter valid, nonnegative health values and a positive weight.');
    if (key === 'sleep_hours' && value > 24) throw new Error('Sleep must be between 0 and 24 hours.');
    values[key] = value;
  }
  if (Object.values(values).every(v => v === null)) throw new Error('Please fill in at least one metric.');
  const { water_cups, ...result } = values;
  return { ...result, water_ml: water_cups === null ? null : water_cups * 300 };
}
