import { isAffordableMeal, isReviewEstimate } from './meal-budget.js';
function selectCatalogueRecipe(meals, { mealType, budget, isAllowed, includeEstimates = false, previousName, random = Math.random }) {
  const eligible = meals
      .filter((meal) => meal.type === mealType &&
        (isAffordableMeal(meal, budget) || (includeEstimates && Number.isFinite(budget) && budget >= 0 && isReviewEstimate(meal) && meal.cost <= budget)) && isAllowed(meal));
  const alternatives = eligible.filter(meal => meal.name?.trim().toLowerCase() !== previousName?.trim().toLowerCase());
  const pool = alternatives.length ? alternatives : eligible;
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
function createSuggestionService({ now = Date.now, ttl = 15 * 6e4 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let unavailableUntil = 0;
  async function run({ key, request, validate, fallback, localOnly = false, fresh = false, isRepeat = () => false }) {
    if (localOnly) {
      const meal = await fallback();
      if (!meal || !validate(meal)) throw new Error('No existing recipe passes the selected meal type, dietary and price checks. Review price gaps or enable estimates needing review.');
      return { meal, delivery: 'local' };
    }
    const cached = cache.get(key);
    if (!fresh && cached && cached.expires > now() && validate(cached.meal)) {
      return { meal: cached.meal, delivery: 'cached' };
    }
    cache.delete(key);
    if (now() >= unavailableUntil) {
      try {
        const meal2 = await request();
        if (!validate(meal2))
          throw new Error('Suggestion does not meet source, budget or dietary checks.');
        if (isRepeat(meal2)) {
          const alternative = await fallback();
          if (alternative && validate(alternative) && !isRepeat(alternative)) {
            return { meal: alternative, delivery: 'alternative' };
          }
        }
        cache.set(key, { meal: meal2, expires: now() + ttl });
        if (cache.size > 50) cache.delete(cache.keys().next().value);
        return { meal: meal2, delivery: 'ai' };
      } catch (error) {
        const message = String(error?.message || '');
        const quota =
          error?.status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|\b429\b/i.test(message);
        const seconds = Number(message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/)?.[1]);
        unavailableUntil =
          now() + (quota ? Math.min(864e5, Math.max(6e4, seconds * 1e3 || 15 * 6e4)) : 3e4);
      }
    }
    const meal = await fallback();
    if (!meal || !validate(meal))
      throw new Error(
        'There is no existing recipe or AI suggestion that passes the current meal-type, dietary and price checks. Review ingredient price gaps, try another meal type, or enable estimates needing review. A higher budget alone cannot resolve missing price evidence.',
      );
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
const mealSuggestionService = createSuggestionService();
const selectRecipeFallback = selectCatalogueRecipe;
export { createSuggestionService, mealSuggestionService, selectCatalogueRecipe, selectRecipeFallback };
