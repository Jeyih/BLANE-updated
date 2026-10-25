const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function ingredientStatus(name, database, month) {
  const normalized = key(name);
  const entry = Object.entries(database).find(([name]) => key(name) === normalized)?.[1];
  if (!entry || !['dry', 'wet', 'both'].includes(entry.season)) return { status: 'unknown', season: null, alt: null };
  if (entry.season === 'both') return { status: 'year_round', season: 'both', alt: entry.alt || null };
  const season = [11,12,1,2,3,4,5].includes(month) ? 'dry' : 'wet';
  return { status: entry.season === season ? 'in_season' : 'out_of_season', season: entry.season, alt: entry.season === season ? null : entry.alt || null };
}
export function recipeSeasonScore(ingredients, statusFor) {
  const counts = { inCount: 0, outCount: 0, yrCount: 0, unknownCount: 0 };
  for (const ing of ingredients || []) {
    const status = statusFor(typeof ing === 'string' ? ing : ing?.name).status;
    counts[status === 'in_season' ? 'inCount' : status === 'out_of_season' ? 'outCount' : status === 'year_round' ? 'yrCount' : 'unknownCount']++;
  }
  const total = (ingredients || []).length;
  if (!total || counts.unknownCount) return { ...counts, score: null, label: !total || counts.unknownCount === total ? 'Season unknown' : 'Season data incomplete', cssClass: 'unknown' };
  const { inCount, outCount, yrCount } = counts;
  return { ...counts, score: Math.round((inCount + yrCount * 0.8) / total * 100), label: outCount === 0 ? inCount === 0 ? 'Year-Round' : 'In Season' : outCount < total / 2 ? 'Mostly Season' : 'Out of Season', cssClass: outCount === 0 ? inCount === 0 ? 'year-round' : 'in-season' : outCount < total / 2 ? 'partial' : 'out-of-season' };
}
