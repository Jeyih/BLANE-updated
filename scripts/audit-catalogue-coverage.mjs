// Read-only catalogue audit. A rule match is not medical or allergen certification.
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { loadAllPriceRows, applyDynamicRecipePrices } from '../src/lib/pricing.js';
import { loadPriceReferenceData } from '../src/lib/price-reference.js';
import { recipeEligible } from '../src/lib/constraint-rules.js';

const env = loadEnv('development', process.cwd(), 'VITE_');
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Supabase public configuration is missing.');
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const [recipes, ingredients, steps, definitions, references] = await Promise.all([
  loadAllPriceRows(db, 'recipes'), loadAllPriceRows(db, 'recipe_ingredients'),
  loadAllPriceRows(db, 'recipe_steps'), loadAllPriceRows(db, 'constraint_definitions'),
  loadPriceReferenceData(db),
]);
if (!definitions.length || !recipes.length) throw new Error('Catalogue or constraint definitions are empty.');
const rules = Object.fromEntries(definitions.map(definition => [definition.key, definition]));
const meals = applyDynamicRecipePrices(recipes.map(recipe => ({
  ...recipe, protein: recipe.protein_g, carbs: recipe.carbs_g, fats: recipe.fats_g,
  ingredients: ingredients.filter(ingredient => ingredient.recipe_id === recipe.id).map(ingredient => ({ ...ingredient, qty: ingredient.quantity })),
  steps: steps.filter(step => step.recipe_id === recipe.id),
})), [...references.daSnapshot.records, ...references.retailSnapshot.records], references);
const results = definitions.map(definition => ({
  key: definition.key, label: definition.label,
  meals: Object.fromEntries(['Breakfast', 'Lunch', 'Dinner'].map(type => [type,
    meals.filter(meal => meal.type === type && meal.budgetEligible && recipeEligible(meal, { dietary_restrictions: [definition.key] }, rules))
      .map(meal => ({ id: meal.id, name: meal.name, estimatedCost: meal.cost })),
  ])),
}));
const gaps = results.flatMap(result => Object.entries(result.meals).filter(([, meals]) => !meals.length).map(([type]) => ({ key: result.key, type })));
console.log(JSON.stringify({
  scope: 'Each built-in option checked individually; combinations and custom entries are not certified. Medical suitability, product labels, cross-contact and prescribed texture require qualified review.',
  recipeCount: recipes.length, optionCount: definitions.length, checks: definitions.length * 3, gaps, results,
}, null, 2));
if (gaps.length) process.exitCode = 1;
