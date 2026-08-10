/* ============================================================
   BLANE — Recipes Page
   Replaces: recipes.html + js/recipes.js + js/constraints.js
   entirely.

   Recipes now fetch from Supabase (recipes, recipe_ingredients,
   recipe_steps tables) — same tables the Admin Panel manages —
   instead of a hardcoded array.
   ============================================================ */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { scoreRecipe } from '../lib/seasonal';
import { SeasonBadge, IngSeasonTag, SeasonalAltBanner, CurrentSeasonPill } from '../components/SeasonalBadges';
import { getActiveConstraints, checkRecipeViolations } from '../lib/constraints';
import { ConstraintActiveBar, ViolationBadge, ViolationDetail } from '../components/ConstraintWarnings';
import '../styles/recipes.css';

const TYPE_FILTERS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const DIET_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'];
const DIFF_COLORS  = { easy: '#2ddc7a', medium: '#fbbf24', hard: '#f87171' };

export default function Recipes() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]   = useState(null);
  const [recipes, setRecipes]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [dietFilter, setDietFilter] = useState('');
  const [search, setSearch]     = useState('');
  const [openRecipeId, setOpenRecipeId] = useState(null);

  useEffect(() => { loadAll(); }, [user]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    setProfile(profileData);

    const { data: recipesData, error: recipesErr } = await supabase.from('recipes').select('*').order('name');
    if (recipesErr) { console.error(recipesErr.message); setRecipes([]); setLoading(false); return; }

    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').order('sort_order'),
      supabase.from('recipe_steps').select('*').order('step_order'),
    ]);

    const ingByRecipe = {};
    (ingRes.data || []).forEach((ing) => {
      if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
      ingByRecipe[ing.recipe_id].push({ name: ing.name, qty: ing.qty, status: ing.status });
    });

    const stepsByRecipe = {};
    (stepRes.data || []).forEach((s) => {
      if (!stepsByRecipe[s.recipe_id]) stepsByRecipe[s.recipe_id] = [];
      stepsByRecipe[s.recipe_id].push({ title: s.title, desc: s.description, timer: s.timer_seconds });
    });

    setRecipes((recipesData || []).map((r) => ({
      id: r.id, emoji: r.emoji, name: r.name, type: r.type,
      diet: r.diet_tags || [], goal: r.goal_tags || [],
      difficulty: r.difficulty, cookTime: r.cook_time_min, servings: r.servings,
      kcal: r.kcal, cost: r.cost, protein: r.protein_g, carbs: r.carbs_g, fats: r.fats_g,
      ingredients: ingByRecipe[r.id] || [], steps: stepsByRecipe[r.id] || [],
    })));

    setLoading(false);
  }

  const activeConstraints = getActiveConstraints(profile);

  const hasActiveSelection = Boolean(typeFilter || dietFilter || search.trim());
  const filtered = hasActiveSelection
    ? recipes.filter((r) => {
        const matchType = !typeFilter || r.type === typeFilter;
        const dietKey = dietFilter ? dietFilter.toLowerCase().replace('-', '_').replace(' ', '_') : '';
        const matchDiet = !dietFilter || r.diet.includes(dietKey);
        const q = search.trim().toLowerCase();
        const matchSearch = !q || r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) ||
          r.ingredients.some((i) => i.name.toLowerCase().includes(q));
        return matchType && matchDiet && matchSearch;
      })
    : [];

  const openRecipe = recipes.find((r) => r.id === openRecipeId);

  return (
    <>
      <Navbar />
      <main className="rp-main">
        <div className="rp-content">

          <div className="rp-page-header">
            <div>
              <h1 className="rp-page-title">Recipes</h1>
              <p className="rp-page-sub">Filipino meals matched to your nutrition goals</p>
              <div style={{ marginTop: 8 }}><CurrentSeasonPill /></div>
            </div>
            <span style={{ fontSize: 13, color: '#4d6e5a' }}>
              <span style={{ color: '#2ddc7a', fontWeight: 700 }}>{filtered.length}</span> recipes found
            </span>
          </div>

          <ConstraintActiveBar activeConstraints={activeConstraints} />

          <div className="rp-toolbar">
            <div className="rp-search-wrap">
              <span className="rp-search-icon">🔍</span>
              <input
                className="rp-search-input"
                placeholder="Search by name, ingredient, or meal type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rp-filter-row">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                className={'rp-filter-btn' + (typeFilter === f ? ' active' : '')}
                onClick={() => setTypeFilter((current) => (current === f ? '' : f))}
              >
                {f}
              </button>
            ))}
            <div className="rp-filter-divider"></div>
            {DIET_FILTERS.map((f) => (
              <button
                key={f}
                className={'rp-filter-btn' + (dietFilter === f ? ' active' : '')}
                onClick={() => setDietFilter((current) => (current === f ? '' : f))}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="rp-grid">
            {loading ? (
              <div className="rp-empty-state"><p className="rp-empty-text">Loading recipes…</p></div>
            ) : filtered.length === 0 ? (
              <div className="rp-empty-state">
                <span className="rp-empty-icon">🔍</span>
                <p className="rp-empty-text">No recipes match your search or filters.<br />Try adjusting the filters above.</p>
              </div>
            ) : (
              filtered.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  activeConstraints={activeConstraints}
                  onClick={() => setOpenRecipeId(recipe.id)}
                />
              ))
            )}
          </div>

        </div>
      </main>

      {openRecipe && (
        <RecipeModal
          recipe={openRecipe}
          activeConstraints={activeConstraints}
          onClose={() => setOpenRecipeId(null)}
          onAddToMealPlan={() => { setOpenRecipeId(null); navigate('/mealplan'); }}
        />
      )}
    </>
  );
}

function RecipeCard({ recipe, activeConstraints, onClick }) {
  const seasonScore = scoreRecipe(recipe.ingredients);
  const violations = checkRecipeViolations(recipe, activeConstraints);
  const bannerGlow = seasonScore.cssClass === 'in-season' ? ' in-season-glow' : '';
  const stripeClass = violations.some((v) => v.severity === 'allergy') ? ' violation-stripe' : '';
  const hasViolation = violations.length > 0;

  return (
    <div className={'recipe-card' + (hasViolation ? ' has-violation' : '')} onClick={onClick}>
      <div className={'recipe-card-banner' + bannerGlow + stripeClass}>
        {recipe.emoji}
        <span className="recipe-card-type-tag">{recipe.type}</span>
        <span className={'recipe-card-diff-tag ' + recipe.difficulty}>{recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</span>
      </div>
      <div className="recipe-card-body">
        <div className="recipe-card-name">{recipe.name}</div>
        <div className="recipe-card-meta">
          <span>⏱ {recipe.cookTime} min</span>
          <span>🍽️ {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}</span>
        </div>
        <div className="recipe-card-macros">
          <div className="rc-macro-chip"><b>{recipe.protein}g</b> P</div>
          <div className="rc-macro-chip"><b>{recipe.carbs}g</b> C</div>
          <div className="rc-macro-chip"><b>{recipe.fats}g</b> F</div>
          <SeasonBadge scoreResult={seasonScore} />
          <ViolationBadge violations={violations} />
        </div>
        <div className="recipe-card-footer">
          <div className="recipe-kcal">{recipe.kcal}<small> kcal</small></div>
          <div className="recipe-cost">₱{recipe.cost}</div>
          <div className="recipe-card-view-btn">View recipe →</div>
        </div>
      </div>
    </div>
  );
}

function RecipeModal({ recipe, activeConstraints, onClose, onAddToMealPlan }) {
  const macroMax = Math.max(recipe.protein, recipe.carbs, recipe.fats);
  const violations = checkRecipeViolations(recipe, activeConstraints);
  const dc = DIFF_COLORS[recipe.difficulty] || '#2ddc7a';

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div className="recipe-modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="recipe-modal">
        <button className="recipe-modal-close" onClick={onClose}>✕</button>
        <div className="modal-banner">{recipe.emoji}</div>

        <div className="modal-body">
          <div className="modal-recipe-title">{recipe.name}</div>

          <div className="modal-meta-row">
            <div className="modal-meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
              {recipe.cookTime} min
            </div>
            <div className="modal-meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
            </div>
            <div className="modal-meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <span style={{ color: dc, fontWeight: 600 }}>{recipe.difficulty.charAt(0).toUpperCase() + recipe.difficulty.slice(1)}</span>
            </div>
            <div className="modal-meta-chip" style={{ color: '#2ddc7a' }}>{recipe.type}</div>
          </div>

          <div className="modal-stats-row">
            <div className="modal-stat"><span className="modal-stat-value">{recipe.kcal}</span><span className="modal-stat-label">Calories</span></div>
            <div className="modal-stat"><span className="modal-stat-value yellow">₱{recipe.cost}</span><span className="modal-stat-label">Est. Cost</span></div>
            <div className="modal-stat"><span className="modal-stat-value">{recipe.protein}g</span><span className="modal-stat-label">Protein</span></div>
            <div className="modal-stat"><span className="modal-stat-value blue">{recipe.carbs}g</span><span className="modal-stat-label">Carbs</span></div>
          </div>

          <div className="modal-section-title">Macros</div>
          <div className="modal-macro-bars">
            <MacroBar label="Protein" value={recipe.protein} max={macroMax} color="#2ddc7a" />
            <MacroBar label="Carbs"   value={recipe.carbs}   max={macroMax} color="#60a5fa" />
            <MacroBar label="Fats"    value={recipe.fats}    max={macroMax} color="#fbbf24" />
          </div>

          <ViolationDetail violations={violations} />

          <div className="modal-section-title" style={{ marginTop: 22 }}>Ingredients</div>
          <div className="modal-ingredients">
            {recipe.ingredients.map((ing) => (
              <div key={ing.name}>
                <div className="modal-ingredient-row">
                  <div className="modal-ing-dot"></div>
                  <span className="modal-ing-name">{ing.name}</span>
                  <span className="modal-ing-qty">{ing.qty}</span>
                  <IngSeasonTag ingredientName={ing.name} />
                  <span className={'modal-ing-status ' + ing.status}>{ing.status === 'avail' ? '✓' : '⚠'}</span>
                </div>
                <SeasonalAltBanner ingredientName={ing.name} />
              </div>
            ))}
          </div>

          <div className="modal-section-title">How to Cook</div>
          <div className="modal-steps">
            {recipe.steps.map((step, i) => (
              <div key={i} className="modal-step">
                <div className="modal-step-num">{i + 1}</div>
                <div className="modal-step-content">
                  <div className="modal-step-title">{step.title}</div>
                  <div className="modal-step-desc">{step.desc}</div>
                  {step.timer && <div className="modal-step-timer">⏱ {formatTimer(step.timer)}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="modal-actions">
            <button className="rp-btn rp-btn-outline" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
              Back
            </button>
            <button className="rp-btn rp-btn-primary" onClick={onAddToMealPlan}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add to Meal Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="modal-macro-bar-row">
      <span className="modal-macro-bar-label">{label}</span>
      <div className="modal-macro-bar-bg"><div className="modal-macro-bar-fill" style={{ width: pct + '%', background: color }}></div></div>
      <span className="modal-macro-bar-val">{value}g</span>
    </div>
  );
}

function formatTimer(seconds) {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'min' + (s ? ' ' + s + 's' : '');
}