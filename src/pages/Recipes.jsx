import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useIngredientPrices } from '../context/PriceContext';
import {
  applyDynamicRecipePrices,
  formatPrice,
  formatEstimatedPrice,
  pricingLabel,
} from '../lib/pricing';
import { isDessert, addMealForToday } from '../lib/meal-experience';
import PriceEstimateNotice from '../components/PriceEstimateNotice';
import '../styles/meal-experience.css';
import Navbar from '../components/Navbar';
import RecipesTour from '../components/RecipesTour';
import { scoreRecipe } from '../lib/seasonal';
import {
  SeasonBadge,
  IngSeasonTag,
  SeasonalAltBanner,
  CurrentSeasonPill,
} from '../components/SeasonalBadges';
import {
  loadConstraintDefinitions,
  getActiveConstraints,
  checkRecipeViolations,
} from '../lib/constraints';
import {
  ConstraintActiveBar,
  ViolationBadge,
  ViolationDetail,
} from '../components/ConstraintWarnings';
import '../styles/recipes.css';
const TYPE_FILTERS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];
const DIET_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'];
const DIFF_COLORS = { easy: '#2ddc7a', medium: '#fbbf24', hard: '#f87171' };
const DAILY_RECIPE_LIMIT = 13;
function getLocalDateKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => (index === 0 ? part : String(part).padStart(2, '0')))
    .join('-');
}
function getDailyRecipeOrder(recipes, dateKey) {
  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index++) {
      result = Math.imul(result ^ value.charCodeAt(index), 16777619);
    }
    return result >>> 0;
  }
  return [...recipes].sort(
    (first, second) =>
      hash(`${dateKey}:${first.id}`) - hash(`${dateKey}:${second.id}`) ||
      String(first.id).localeCompare(String(second.id)),
  );
}
function Recipes() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [savedRecipes, setRecipes] = useState([]);
  const { records } = useIngredientPrices();
  const recipes = useMemo(
    () => applyDynamicRecipePrices(savedRecipes, records),
    [savedRecipes, records],
  );
  const [loading, setLoading] = useState(true);
  const [constraintsReady, setConstraintsReady] = useState(false);
  const [constraintDefinitions, setConstraintDefinitions] = useState({});
  const [constraintError, setConstraintError] = useState('');
  const [ingredientError, setIngredientError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dietFilter, setDietFilter] = useState('');
  const [search, setSearch] = useState('');
  const [openRecipeId, setOpenRecipeId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey());
  useEffect(() => {
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeout = setTimeout(
      () => setTodayKey(getLocalDateKey()),
      nextDay.getTime() - now.getTime(),
    );
    return () => clearTimeout(timeout);
  }, [todayKey]);
  useEffect(() => {
    loadAll();
  }, [user]);
  useEffect(() => {
    if (!user?.id) return;
    setTourOpen(localStorage.getItem(`blane_recipes_tour_completed_${user.id}`) !== 'true');
  }, [user?.id]);
  function closeTour() {
    if (user?.id) {
      localStorage.setItem(`blane_recipes_tour_completed_${user.id}`, 'true');
    }
    setTourOpen(false);
  }
  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setConstraintsReady(false);
    setConstraintError('');
    setIngredientError('');
    const definitionsLoaded = await loadConstraintDefinitions();
    if (!definitionsLoaded)
      setConstraintError('Constraint rules could not be loaded. Recipes cannot be checked safely.');
    else setConstraintDefinitions(definitionsLoaded);
    setConstraintsReady(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    setProfile(profileData);
    const { data: recipesData, error: recipesErr } = await supabase
      .from('recipes')
      .select('*')
      .order('name');
    if (recipesErr) {
      console.error(recipesErr.message);
      setRecipes([]);
      setLoading(false);
      return;
    }
    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').order('sort_order'),
      supabase.from('recipe_steps').select('*').order('step_order'),
    ]);
    if (ingRes.error) {
      console.error(ingRes.error.message);
      setIngredientError(
        'Recipe ingredients could not be loaded. Recipes cannot be checked safely.',
      );
    }
    const ingByRecipe = {};
    (ingRes.data || []).forEach((ing) => {
      if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
      ingByRecipe[ing.recipe_id].push({
        name: ing.name || ing.ingredient_name || ing.food_name,
        ingredient_name: ing.ingredient_name,
        food_name: ing.food_name,
        qty: ing.quantity ?? ing.qty,
        grams: ing.grams,
        status: ing.status,
      });
    });
    const stepsByRecipe = {};
    (stepRes.data || []).forEach((s) => {
      if (!stepsByRecipe[s.recipe_id]) stepsByRecipe[s.recipe_id] = [];
      stepsByRecipe[s.recipe_id].push({
        title: s.title,
        desc: s.description,
        timer: s.timer_seconds,
      });
    });
    setRecipes(
      (recipesData || []).map((r) => ({
        id: r.id,
        emoji: r.emoji,
        name: r.name,
        type: r.type,
        diet: r.diet_tags || [],
        goal: r.goal_tags || [],
        difficulty: r.difficulty,
        cookTime: r.cook_time_min,
        servings: r.servings,
        kcal: r.kcal,
        cost: r.cost,
        protein: r.protein_g,
        carbs: r.carbs_g,
        fats: r.fats_g,
        ingredients: ingByRecipe[r.id] || [],
        steps: stepsByRecipe[r.id] || [],
      })),
    );
    setLoading(false);
  }
  const activeConstraints = getActiveConstraints(profile, constraintDefinitions);
  const filtered = useMemo(
    () =>
      recipes.filter((r) => {
        const matchType =
          !typeFilter || (typeFilter === 'Dessert' ? isDessert(r) : r.type === typeFilter);
        const dietKey = dietFilter
          ? dietFilter.toLowerCase().replace('-', '_').replace(' ', '_')
          : '';
        const matchDiet = !dietFilter || r.diet.includes(dietKey);
        const q = search.trim().toLowerCase();
        const matchSearch =
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(q));
        return matchType && matchDiet && matchSearch;
      }),
    [recipes, typeFilter, dietFilter, search],
  );
  const displayedRecipes = useMemo(
    () => getDailyRecipeOrder(filtered, todayKey).slice(0, DAILY_RECIPE_LIMIT),
    [filtered, todayKey],
  );
  const openRecipe = recipes.find((r) => r.id === openRecipeId);
  const linkedRecipe = searchParams.get('recipe');
  useEffect(() => {
    if (!loading && linkedRecipe && recipes.some((r) => String(r.id) === linkedRecipe))
      setOpenRecipeId(linkedRecipe);
  }, [loading, linkedRecipe]);
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Navbar, null),
    React.createElement(RecipesTour, { isOpen: tourOpen, onClose: closeTour }),
    React.createElement(
      'main',
      { className: 'rp-main' },
      React.createElement(
        'div',
        { className: 'rp-content' },
        React.createElement(
          'div',
          { className: 'rp-page-header', 'data-recipes-tour': 'header' },
          React.createElement(
            'div',
            null,
            React.createElement('h1', { className: 'rp-page-title' }, 'Recipes'),
            React.createElement(
              'p',
              { className: 'rp-page-sub' },
              'Filipino meals matched to your nutrition goals',
            ),
            React.createElement(
              'div',
              { style: { marginTop: 8 } },
              React.createElement(CurrentSeasonPill, null),
            ),
          ),
          React.createElement(
            'div',
            { className: 'rp-header-actions' },
            React.createElement(
              'button',
              { className: 'rp-tour-trigger', type: 'button', onClick: () => setTourOpen(true) },
              React.createElement('span', { 'aria-hidden': 'true' }, '\u24D8'),
              ' Take a tour',
            ),
            React.createElement(
              'span',
              { style: { fontSize: 13, color: '#4d6e5a' } },
              React.createElement(
                'span',
                { style: { color: '#2ddc7a', fontWeight: 700 } },
                displayedRecipes.length,
              ),
              filtered.length > DAILY_RECIPE_LIMIT
                ? ` of ${filtered.length} recipes found`
                : ' recipes found',
            ),
          ),
        ),
        React.createElement(
          'div',
          { 'data-recipes-tour': 'constraints' },
          React.createElement(ConstraintActiveBar, { activeConstraints }),
        ),
        React.createElement(PriceEstimateNotice, null),
        actionMessage &&
          React.createElement(
            'p',
            { className: 'meal-action-status', role: 'status' },
            actionMessage,
          ),
        (constraintError || ingredientError) &&
          React.createElement(
            'div',
            { className: 'rp-empty-state' },
            React.createElement(
              'p',
              { className: 'rp-empty-text' },
              constraintError || ingredientError,
            ),
          ),
        React.createElement(
          'div',
          { className: 'rp-toolbar', 'data-recipes-tour': 'search' },
          React.createElement(
            'div',
            { className: 'rp-search-wrap' },
            React.createElement('span', { className: 'rp-search-icon' }, '\u{1F50D}'),
            React.createElement('input', {
              className: 'rp-search-input',
              placeholder: 'Search by name, ingredient, or meal type...',
              value: search,
              onChange: (e) => setSearch(e.target.value),
            }),
          ),
        ),
        React.createElement(
          'div',
          { className: 'rp-filter-row', 'data-recipes-tour': 'filters' },
          TYPE_FILTERS.map((f) =>
            React.createElement(
              'button',
              {
                key: f,
                className: 'rp-filter-btn' + (typeFilter === f ? ' active' : ''),
                onClick: () => setTypeFilter((current) => (current === f ? '' : f)),
              },
              f,
            ),
          ),
          React.createElement('div', { className: 'rp-filter-divider' }),
          DIET_FILTERS.map((f) =>
            React.createElement(
              'button',
              {
                key: f,
                className: 'rp-filter-btn' + (dietFilter === f ? ' active' : ''),
                onClick: () => setDietFilter((current) => (current === f ? '' : f)),
              },
              f,
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'rp-grid', 'data-recipes-tour': 'results' },
          loading || !constraintsReady
            ? React.createElement(
                'div',
                { className: 'rp-empty-state' },
                React.createElement('p', { className: 'rp-empty-text' }, 'Loading recipes\u2026'),
              )
            : constraintError || ingredientError
              ? null
              : filtered.length === 0
                ? React.createElement(
                    'div',
                    { className: 'rp-empty-state' },
                    React.createElement('span', { className: 'rp-empty-icon' }, '\u{1F50D}'),
                    React.createElement(
                      'p',
                      { className: 'rp-empty-text' },
                      'No recipes match your search or filters.',
                      React.createElement('br', null),
                      'Try adjusting the filters above.',
                    ),
                  )
                : displayedRecipes.map((recipe) =>
                    React.createElement(RecipeCard, {
                      key: recipe.id,
                      recipe,
                      activeConstraints,
                      constraintDefinitions,
                      onClick: () => setOpenRecipeId(recipe.id),
                      onUse: () => {
                        if (
                          checkRecipeViolations(
                            recipe,
                            activeConstraints,
                            true,
                            constraintDefinitions,
                          ).length
                        )
                          return;
                        try {
                          const saved = addMealForToday(recipe);
                          setActionMessage(
                            `Added ${recipe.name} to today's ${saved.type.toLowerCase()}.`,
                          );
                        } catch {
                          setActionMessage('Could not save this meal. Please try again.');
                        }
                      },
                    }),
                  ),
        ),
      ),
    ),
    openRecipe &&
      React.createElement(RecipeModal, {
        recipe: openRecipe,
        activeConstraints,
        constraintDefinitions,
        onClose: () => {
          setOpenRecipeId(null);
          if (linkedRecipe) setSearchParams({});
        },
        onAddToMealPlan: () => {
          if (
            checkRecipeViolations(openRecipe, activeConstraints, true, constraintDefinitions).length
          )
            return;
          try {
            const saved = addMealForToday(openRecipe);
            setActionMessage(`Added ${openRecipe.name} to today's ${saved.type.toLowerCase()}.`);
            setOpenRecipeId(null);
            if (linkedRecipe) setSearchParams({});
          } catch {
            setActionMessage('Could not save this meal. Please try again.');
          }
        },
      }),
  );
}
function RecipeCard({ recipe, activeConstraints, constraintDefinitions, onClick, onUse }) {
  const seasonScore = scoreRecipe(recipe.ingredients);
  const violations = checkRecipeViolations(recipe, activeConstraints, true, constraintDefinitions);
  const bannerGlow = seasonScore.cssClass === 'in-season' ? ' in-season-glow' : '';
  const stripeClass = violations.some((v) => v.severity === 'allergy') ? ' violation-stripe' : '';
  const hasViolation = violations.length > 0;
  return React.createElement(
    'div',
    { className: 'recipe-card' + (hasViolation ? ' has-violation' : ''), onClick },
    React.createElement(
      'div',
      { className: 'recipe-card-banner' + bannerGlow + stripeClass },
      recipe.emoji,
      React.createElement('span', { className: 'recipe-card-type-tag' }, recipe.type),
      React.createElement(
        'span',
        { className: 'recipe-card-diff-tag ' + recipe.difficulty },
        recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1),
      ),
    ),
    React.createElement(
      'div',
      { className: 'recipe-card-body' },
      React.createElement('div', { className: 'recipe-card-name' }, recipe.name),
      React.createElement(
        'div',
        { className: 'recipe-card-meta' },
        React.createElement('span', null, '\u23F1 ', recipe.cookTime, ' min'),
        React.createElement(
          'span',
          null,
          '\u{1F37D}\uFE0F ',
          recipe.servings,
          ' ',
          recipe.servings === 1 ? 'serving' : 'servings',
        ),
      ),
      React.createElement(
        'div',
        { className: 'recipe-card-macros' },
        React.createElement(
          'div',
          { className: 'rc-macro-chip' },
          React.createElement('b', null, recipe.protein, 'g'),
          ' P',
        ),
        React.createElement(
          'div',
          { className: 'rc-macro-chip' },
          React.createElement('b', null, recipe.carbs, 'g'),
          ' C',
        ),
        React.createElement(
          'div',
          { className: 'rc-macro-chip' },
          React.createElement('b', null, recipe.fats, 'g'),
          ' F',
        ),
        React.createElement(SeasonBadge, { scoreResult: seasonScore }),
        React.createElement(ViolationBadge, { violations }),
      ),
      React.createElement(
        'div',
        { className: 'recipe-card-footer' },
        React.createElement(
          'div',
          { className: 'recipe-kcal' },
          recipe.kcal,
          React.createElement('small', null, ' kcal'),
        ),
        React.createElement(
          'div',
          { className: 'recipe-cost' },
          formatEstimatedPrice(recipe.cost),
          React.createElement('div', { className: 'price-estimate-note' }, pricingLabel(recipe)),
        ),
        React.createElement('div', { className: 'recipe-card-view-btn' }, 'View recipe \u2192'),
        React.createElement(
          'button',
          {
            className: 'quick-meal-action',
            type: 'button',
            disabled: hasViolation,
            onClick: (event) => {
              event.stopPropagation();
              onUse();
            },
          },
          'Use today',
        ),
      ),
    ),
  );
}
function RecipeModal({
  recipe,
  activeConstraints,
  constraintDefinitions,
  onClose,
  onAddToMealPlan,
}) {
  const macroMax = Math.max(recipe.protein, recipe.carbs, recipe.fats);
  const violations = checkRecipeViolations(recipe, activeConstraints, true, constraintDefinitions);
  const dc = DIFF_COLORS[recipe.difficulty] || '#2ddc7a';
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return React.createElement(
    'div',
    {
      className: 'recipe-modal-overlay active',
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    React.createElement(
      'div',
      { className: 'recipe-modal' },
      React.createElement(
        'button',
        { className: 'recipe-modal-close', onClick: onClose },
        '\u2715',
      ),
      React.createElement('div', { className: 'modal-banner' }, recipe.emoji),
      React.createElement(
        'div',
        { className: 'modal-body' },
        React.createElement('div', { className: 'modal-recipe-title' }, recipe.name),
        React.createElement(
          'div',
          { className: 'modal-meta-row' },
          React.createElement(
            'div',
            { className: 'modal-meta-chip' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
              React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
              React.createElement('path', { d: 'M12 8v4l3 3' }),
            ),
            recipe.cookTime,
            ' min',
          ),
          React.createElement(
            'div',
            { className: 'modal-meta-chip' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
              React.createElement('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
              React.createElement('circle', { cx: '9', cy: '7', r: '4' }),
              React.createElement('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87' }),
              React.createElement('path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }),
            ),
            'Makes ',
            recipe.servings,
            ' ',
            Number(recipe.servings) === 1 ? 'serving' : 'servings',
          ),
          React.createElement(
            'div',
            { className: 'modal-meta-chip' },
            React.createElement(
              'svg',
              { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
              React.createElement('polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' }),
            ),
            React.createElement(
              'span',
              { style: { color: dc, fontWeight: 600 } },
              recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1),
            ),
          ),
          React.createElement(
            'div',
            { className: 'modal-meta-chip', style: { color: '#2ddc7a' } },
            recipe.type,
          ),
        ),
        React.createElement(
          'div',
          { className: 'modal-stats-row' },
          React.createElement(
            'div',
            { className: 'modal-stat' },
            React.createElement('span', { className: 'modal-stat-value' }, recipe.kcal),
            React.createElement('span', { className: 'modal-stat-label' }, 'Calories'),
          ),
          React.createElement(
            'div',
            { className: 'modal-stat' },
            React.createElement(
              'span',
              { className: 'modal-stat-value yellow' },
              formatEstimatedPrice(recipe.cost),
            ),
            React.createElement('span', { className: 'modal-stat-label' }, pricingLabel(recipe)),
          ),
          React.createElement(
            'div',
            { className: 'modal-stat' },
            React.createElement('span', { className: 'modal-stat-value' }, recipe.protein, 'g'),
            React.createElement('span', { className: 'modal-stat-label' }, 'Protein'),
          ),
          React.createElement(
            'div',
            { className: 'modal-stat' },
            React.createElement('span', { className: 'modal-stat-value blue' }, recipe.carbs, 'g'),
            React.createElement('span', { className: 'modal-stat-label' }, 'Carbs'),
          ),
        ),
        React.createElement('div', { className: 'modal-section-title' }, 'Macros'),
        React.createElement(
          'div',
          { className: 'modal-macro-bars' },
          React.createElement(MacroBar, {
            label: 'Protein',
            value: recipe.protein,
            max: macroMax,
            color: '#2ddc7a',
          }),
          React.createElement(MacroBar, {
            label: 'Carbs',
            value: recipe.carbs,
            max: macroMax,
            color: '#60a5fa',
          }),
          React.createElement(MacroBar, {
            label: 'Fats',
            value: recipe.fats,
            max: macroMax,
            color: '#fbbf24',
          }),
        ),
        React.createElement(ViolationDetail, { violations }),
        React.createElement(
          'div',
          { className: 'modal-section-title', style: { marginTop: 22 } },
          'Ingredients',
        ),
        React.createElement(
          'p',
          { className: 'modal-section-note' },
          'Amounts are in grams (g), unless another unit is listed.',
        ),
        React.createElement(
          'div',
          { className: 'modal-ingredients' },
          recipe.ingredients.map((ing) =>
            React.createElement(
              'div',
              { key: ing.name },
              React.createElement(
                'div',
                { className: 'modal-ingredient-row' },
                React.createElement('div', { className: 'modal-ing-dot' }),
                React.createElement('span', { className: 'modal-ing-name' }, ing.name),
                React.createElement(
                  'span',
                  { className: 'modal-ing-qty' },
                  formatIngredientQuantity(ing.qty),
                ),
                React.createElement(IngSeasonTag, { ingredientName: ing.name }),
                React.createElement(
                  'span',
                  { className: 'modal-ing-status ' + ing.status },
                  ing.status === 'avail' ? '\u2713' : '\u26A0',
                ),
              ),
              React.createElement(
                'div',
                { className: 'price-estimate-note' },
                formatEstimatedPrice(ing.cost),
                ' \xB7 ',
                ing.evidence?.label,
                ing.priceRecords?.map((p) =>
                  React.createElement(
                    'div',
                    { key: p.sourceUrl },
                    React.createElement(
                      'a',
                      { href: p.sourceUrl, target: '_blank', rel: 'noreferrer' },
                      p.source,
                    ),
                    ' \xB7 ',
                    p.observedAt,
                    React.createElement('br', null),
                    p.description,
                    ' \xB7 ',
                    formatPrice(p.price),
                    ' / ',
                    p.unit,
                    React.createElement('br', null),
                    p.notes,
                    p.conversionNote && React.createElement('div', null, p.conversionNote),
                    p.conversionSourceUrl &&
                      React.createElement(
                        'div',
                        null,
                        React.createElement(
                          'a',
                          { href: p.conversionSourceUrl, target: '_blank', rel: 'noreferrer' },
                          'View Philippine portion reference',
                        ),
                      ),
                  ),
                ),
              ),
              React.createElement(SeasonalAltBanner, { ingredientName: ing.name }),
            ),
          ),
        ),
        React.createElement('div', { className: 'modal-section-title' }, 'How to Cook'),
        React.createElement(
          'div',
          { className: 'modal-steps' },
          recipe.steps.map((step, i) =>
            React.createElement(
              'div',
              { key: i, className: 'modal-step' },
              React.createElement('div', { className: 'modal-step-num' }, i + 1),
              React.createElement(
                'div',
                { className: 'modal-step-content' },
                React.createElement('div', { className: 'modal-step-title' }, step.title),
                React.createElement('div', { className: 'modal-step-desc' }, step.desc),
                step.timer &&
                  React.createElement(
                    'div',
                    { className: 'modal-step-timer' },
                    '\u23F1 ',
                    formatTimer(step.timer),
                  ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'modal-actions' },
          React.createElement(
            'button',
            { className: 'rp-btn rp-btn-outline', onClick: onClose },
            React.createElement(
              'svg',
              {
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '2',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              React.createElement('path', { d: 'M19 12H5M12 5l-7 7 7 7' }),
            ),
            'Back',
          ),
          React.createElement(
            'button',
            {
              className: 'rp-btn rp-btn-primary',
              disabled: violations.length > 0,
              onClick: onAddToMealPlan,
            },
            React.createElement(
              'svg',
              {
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '2',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              },
              React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
              React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
            ),
            violations.length
              ? 'Check dietary conflicts'
              : `Use for today's ${recipe.type === 'Dessert' ? 'snack' : recipe.type.toLowerCase()}`,
          ),
        ),
      ),
    ),
  );
}
function formatIngredientQuantity(quantity) {
  if (quantity == null || quantity === '') return 'Amount not listed';
  if (typeof quantity === 'number')
    return Number.isFinite(quantity) ? `${quantity} g` : 'Amount not listed';
  const value = String(quantity).trim();
  if (!value) return 'Amount not listed';
  return /^\d+(?:\.\d+)?$/.test(value) ? `${value} g` : value;
}
function MacroBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return React.createElement(
    'div',
    { className: 'modal-macro-bar-row' },
    React.createElement('span', { className: 'modal-macro-bar-label' }, label),
    React.createElement(
      'div',
      { className: 'modal-macro-bar-bg' },
      React.createElement('div', {
        className: 'modal-macro-bar-fill',
        style: { width: pct + '%', background: color },
      }),
    ),
    React.createElement('span', { className: 'modal-macro-bar-val' }, value, 'g'),
  );
}
function formatTimer(seconds) {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'min' + (s ? ' ' + s + 's' : '');
}
export { Recipes as default };
