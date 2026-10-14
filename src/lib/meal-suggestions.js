import { isAffordableMeal } from './meal-budget.js';

export function selectRecipeFallback(meals, { mealType, budget, isAllowed }) {
  return meals.filter((meal) => meal.type === mealType && isAffordableMeal(meal, budget) && isAllowed(meal))
    .sort((a, b) => a.cost - b.cost || String(a.id).localeCompare(String(b.id)))[0] || null;
}

// Memory only: no health profiles or suggestions are written to browser storage.
export function createSuggestionService({ now = Date.now, ttl = 15 * 60_000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let unavailableUntil = 0;
  async function run({ key, request, validate, fallback }) {
    const cached = cache.get(key);
    if (cached && cached.expires > now() && validate(cached.meal)) {
      return { meal: cached.meal, delivery: 'cached' };
    }
    cache.delete(key);
    if (now() >= unavailableUntil) {
      try {
        const meal = await request();
        if (!validate(meal)) throw new Error('Suggestion does not meet source, budget or dietary checks.');
        cache.set(key, { meal, expires: now() + ttl });
        if (cache.size > 50) cache.delete(cache.keys().next().value);
        return { meal, delivery: 'ai' };
      } catch (error) {
        const message = String(error?.message || '');
        const quota = error?.status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|\b429\b/i.test(message);
        const seconds = Number(message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/)?.[1]);
        unavailableUntil = now() + (quota ? Math.min(86_400_000, Math.max(60_000, seconds * 1000 || 15 * 60_000)) : 30_000);
      }
    }
    const meal = await fallback();
    if (!meal || !validate(meal)) throw new Error('AI is temporarily unavailable, and no existing recipe with complete sourced prices fits this meal type, budget and dietary preferences. Try another meal type or a higher budget.');
    return { meal, delivery: 'fallback' };
  }
  return {
    get(options) {
      if (!pending.has(options.key)) {
        const task = run(options).finally(() => pending.delete(options.key));
        pending.set(options.key, task);
      }
      return pending.get(options.key);
    },
  };
}

export const mealSuggestionService = createSuggestionService();
