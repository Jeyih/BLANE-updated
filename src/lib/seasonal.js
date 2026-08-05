/* ============================================================
   BLANE — Seasonal Availability Engine (Module 06)
   Replaces: the data + scoring logic from js/seasonal.js.
   The HTML-string generator functions (badgeHTML, ingTagHTML,
   altBannerHTML, currentSeasonPillHTML) are now React
   components instead — see components/SeasonalBadges.jsx.

   Philippines seasons:
     Dry (Nov–May)  |  Wet (Jun–Oct)
   ============================================================ */

import { supabase } from './supabase';

const DRY_MONTHS = [11, 12, 1, 2, 3, 4, 5];

export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function getCurrentSeason() {
  return DRY_MONTHS.includes(getCurrentMonth()) ? 'dry' : 'wet';
}

const INGREDIENT_DB = {};

export async function loadIngredientSeasons() {
  const { data, error } = await supabase
    .from('ingredient_seasons')
    .select('*')
    .order('ingredient_name');

  if (error) {
    console.error('Failed to load ingredient seasons:', error);
    return false;
  }

  Object.keys(INGREDIENT_DB).forEach((key) => delete INGREDIENT_DB[key]);

  (data || []).forEach((row) => {
    if (!row.ingredient_name) return;
    const key = row.ingredient_name.toLowerCase().trim();
    INGREDIENT_DB[key] = {
      season: row.season || 'both',
      alt: row.alt || null,
    };
  });

  return true;
}

export function getIngredientStatus(name) {
  const key = name.toLowerCase().trim();
  const season = getCurrentSeason();

  let entry = INGREDIENT_DB[key];
  if (!entry) {
    const found = Object.keys(INGREDIENT_DB).find(
      (k) => key.includes(k) || k.includes(key.split(' ')[0])
    );
    if (found) entry = INGREDIENT_DB[found];
  }

  if (!entry) return { status: 'year_round', season: 'both', alt: null };
  if (entry.season === 'both') return { status: 'year_round', season: 'both', alt: entry.alt };
  if (entry.season === season) return { status: 'in_season', season: entry.season, alt: null };
  return { status: 'out_of_season', season: entry.season, alt: entry.alt };
}

export function scoreRecipe(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return { score: 100, label: 'Year-Round', cssClass: 'year-round', inCount: 0, outCount: 0, yrCount: 0 };
  }

  let inCount = 0, outCount = 0, yrCount = 0;
  ingredients.forEach((ing) => {
    const name = typeof ing === 'string' ? ing : ing.name;
    const result = getIngredientStatus(name);
    if (result.status === 'in_season') inCount++;
    else if (result.status === 'out_of_season') outCount++;
    else yrCount++;
  });

  const total = ingredients.length;
  const raw = (inCount * 1.0 + yrCount * 0.8) / total;
  const score = Math.round(raw * 100);

  let label, cssClass;
  if (outCount === 0 && inCount === 0) { label = 'Year-Round'; cssClass = 'year-round'; }
  else if (outCount === 0) { label = 'In Season'; cssClass = 'in-season'; }
  else if (outCount < total / 2) { label = 'Mostly Season'; cssClass = 'partial'; }
  else { label = 'Out of Season'; cssClass = 'out-of-season'; }

  return { score, label, cssClass, inCount, outCount, yrCount };
}