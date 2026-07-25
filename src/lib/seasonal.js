/* ============================================================
   BLANE — Seasonal Availability Engine (Module 06)
   Replaces: the data + scoring logic from js/seasonal.js.
   The HTML-string generator functions (badgeHTML, ingTagHTML,
   altBannerHTML, currentSeasonPillHTML) are now React
   components instead — see components/SeasonalBadges.jsx.

   Philippines seasons:
     Dry (Nov–May)  |  Wet (Jun–Oct)
   ============================================================ */

const DRY_MONTHS = [11, 12, 1, 2, 3, 4, 5];

export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

export function getCurrentSeason() {
  return DRY_MONTHS.includes(getCurrentMonth()) ? 'dry' : 'wet';
}

/* ---- Ingredient seasonal database (unchanged from seasonal.js) ---- */
const INGREDIENT_DB = {
  'eggs': { season: 'both', alt: null }, 'garlic': { season: 'both', alt: null },
  'onion': { season: 'both', alt: null }, 'ginger': { season: 'both', alt: null },
  'cooking oil': { season: 'both', alt: null }, 'salt': { season: 'both', alt: null },
  'fish sauce': { season: 'both', alt: null }, 'soy sauce': { season: 'both', alt: null },
  'brown sugar': { season: 'both', alt: null }, 'bagoong alamang': { season: 'both', alt: null },
  'tamarind mix': { season: 'both', alt: null }, 'vinegar': { season: 'both', alt: null },
  'black pepper': { season: 'both', alt: null }, 'calamansi': { season: 'both', alt: null },
  'banana': { season: 'both', alt: null }, 'papaya': { season: 'both', alt: null },
  'green papaya': { season: 'both', alt: null }, 'pineapple': { season: 'both', alt: null },
  'malunggay': { season: 'both', alt: null }, 'malunggay leaves': { season: 'both', alt: null },
  'kangkong': { season: 'both', alt: null }, 'eggplant': { season: 'both', alt: null },
  'sweet potato': { season: 'both', alt: null }, 'kamote': { season: 'both', alt: null },
  'squash': { season: 'both', alt: null }, 'ampalaya': { season: 'both', alt: null },
  'ampalaya leaves': { season: 'both', alt: null }, 'rice': { season: 'both', alt: null },
  'brown rice': { season: 'both', alt: null }, 'glutinous rice': { season: 'both', alt: null },
  'sinandomeng rice': { season: 'both', alt: null }, 'rolled oats': { season: 'both', alt: null },
  'peanut butter': { season: 'both', alt: null }, 'honey': { season: 'both', alt: null },
  'milk': { season: 'both', alt: null }, 'chicken': { season: 'both', alt: null },
  'chicken breast': { season: 'both', alt: null }, 'chicken thigh': { season: 'both', alt: null },
  'pork': { season: 'both', alt: null }, 'pork belly': { season: 'both', alt: null },
  'mung beans': { season: 'both', alt: null }, 'salted egg': { season: 'both', alt: null },
  'sesame oil': { season: 'both', alt: null }, 'tomato': { season: 'both', alt: null },
  'bangus': { season: 'both', peakSeason: 'dry', alt: null }, 'tilapia': { season: 'both', alt: null },

  'pechay': { season: 'dry', alt: 'Kangkong (wet season)' },
  'cabbage': { season: 'dry', alt: 'Pechay or Kangkong' },
  'lettuce': { season: 'dry', alt: 'Kangkong or Pechay' },
  'broccoli': { season: 'dry', alt: 'Kangkong or Pechay' },
  'cauliflower': { season: 'dry', alt: 'Cabbage or Pechay' },
  'carrot': { season: 'dry', alt: 'Squash (available year-round)' },
  'potato': { season: 'dry', alt: 'Kamote (year-round)' },
  'mango': { season: 'dry', alt: 'Banana or Papaya' },
  'watermelon': { season: 'dry', alt: 'Pineapple (year-round)' },
  'strawberry': { season: 'dry', alt: 'Mango (dry) or Banana' },
  'white onion': { season: 'dry', alt: null },
  'spring onion': { season: 'dry', alt: 'White onion sliced thinly' },
  'leeks': { season: 'dry', alt: 'Spring onion (dry season)' },
  'chinese cabbage': { season: 'dry', alt: 'Pechay or Kangkong' },

  'okra': { season: 'wet', alt: 'String beans (dry season)' },
  'sitaw': { season: 'wet', alt: 'Baguio beans (dry)' },
  'string beans': { season: 'wet', alt: 'Baguio beans (dry season)' },
  'patola': { season: 'wet', alt: 'Upo or Eggplant' },
  'upo': { season: 'wet', alt: 'Pechay or Squash' },
  'durian': { season: 'wet', alt: 'Jackfruit or Banana' },
  'lanzones': { season: 'wet', alt: 'Grapes or Rambutan (dry)' },
  'jackfruit': { season: 'wet', alt: 'Banana or Green papaya' },
  'rambutan': { season: 'wet', alt: 'Lychee or Grape' },
  'guava': { season: 'wet', alt: 'Papaya or Banana' },
  'corn': { season: 'wet', alt: 'Sweet potato (year-round)' },
  'chili': { season: 'wet', alt: null },
  'gabi': { season: 'wet', alt: 'Sweet potato (year-round)' },
};

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