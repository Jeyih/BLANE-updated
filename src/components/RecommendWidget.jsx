/* ============================================================
   BLANE — Recipe Recommendation Engine (Module 09)
   Replaces: js/recommend.js entirely + the .rec-widget markup
   block from dashboard.html.

   Scores all recipes against the user's profile (goal +
   constraint safety + calorie fit) and shows the top 3 picks.
   ============================================================ */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../styles/recommend.css';

// Data-driven metadata is loaded from the database.
const CONSTRAINT_BLOCKS = {};
const ALLERGY_KEYS = [];
const GOAL_IDEALS = {
  maintain: {
    minProtein: 15,
    maxKcal: 550,
    maxFats: 25,
    minCarbs: 20,
  },
};

async function loadRecommendationData() {
  const { data: constraintData, error: constraintErr } = await supabase
    .from('constraint_definitions')
    .select('*')
    .order('sort_order');

  if (constraintErr) {
    console.error('Failed to load recommendation constraints:', constraintErr);
  } else {
    Object.keys(CONSTRAINT_BLOCKS).forEach((key) => delete CONSTRAINT_BLOCKS[key]);
    ALLERGY_KEYS.length = 0;

    (constraintData || []).forEach((row) => {
      if (row.active === false || !row.key) return;
      const blocked = Array.isArray(row.blocked)
        ? row.blocked.map((item) => item.trim()).filter(Boolean)
        : typeof row.blocked === 'string'
          ? row.blocked.split(',').map((item) => item.trim()).filter(Boolean)
          : [];

      CONSTRAINT_BLOCKS[row.key] = blocked;
      if (row.severity === 'allergy') ALLERGY_KEYS.push(row.key);
    });
  }

  const { data: goalData, error: goalErr } = await supabase.from('goal_ideals').select('*');
  if (goalErr) {
    console.error('Failed to load goal ideals:', goalErr);
  } else {
    Object.keys(GOAL_IDEALS).forEach((key) => { if (key !== 'maintain') delete GOAL_IDEALS[key]; });
    (goalData || []).forEach((row) => {
      if (!row.goal_key) return;
      GOAL_IDEALS[row.goal_key] = {
        minProtein: row.min_protein || 0,
        maxKcal: row.max_kcal || 9999,
        maxFats: row.max_fats || 9999,
        minCarbs: row.min_carbs || 0,
      };
    });
  }
}

export default function RecommendWidget({ profile }) {
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState([]);
  const [top3, setTop3]       = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecipes() {
      setLoading(true);
      const { data: recipesData, error: recipesErr } = await supabase.from('recipes').select('*').order('name');
      if (cancelled) return;
      if (recipesErr) {
        console.error('Failed to load recommended recipes:', recipesErr.message);
        setRecipes([]);
        setLoading(false);
        return;
      }

      const { data: ingData, error: ingErr } = await supabase.from('recipe_ingredients').select('*').order('sort_order');
      if (cancelled) return;
      if (ingErr) {
        console.error('Failed to load recipe ingredients:', ingErr.message);
        setRecipes([]);
        setLoading(false);
        return;
      }

      const ingByRecipe = {};
      (ingData || []).forEach((ing) => {
        if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
        ingByRecipe[ing.recipe_id].push({ name: ing.name });
      });

      setRecipes((recipesData || []).map((r) => ({
        id: r.id,
        emoji: r.emoji,
        name: r.name,
        type: r.type,
        diet: r.diet_tags || [],
        goal: r.goal_tags || [],
        kcal: r.kcal,
        cost: r.cost,
        protein: r.protein_g,
        carbs: r.carbs_g,
        fats: r.fats_g,
        ingredients: ingByRecipe[r.id] || [],
      })));
      setLoading(false);
    }

    loadRecipes();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function prepareMetadata() {
      await loadRecommendationData();
      if (!cancelled) setLoading(false);
    }
    prepareMetadata();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!profile || recipes.length === 0) {
      setTop3([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      setTop3(scoreAndRankRecipes(profile, recipes));
      setLoading(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profile, recipes]);

  return (
    <div className="rec-widget col-12">
      <div className="rec-header">
        <div className="rec-header-left">
          <div className="rec-header-icon">⭐</div>
          <div>
            <div className="rec-header-title">Recommended for You</div>
            <div className="rec-header-sub">Top 3 picks · Based on your goal &amp; dietary profile</div>
          </div>
        </div>
        <Link to="/recipes" className="rec-view-all-btn">View all recipes →</Link>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : !profile?.goal && !profile?.height_cm ? (
        <div className="rec-no-profile">
          <span className="rec-no-profile-icon">🍽️</span>
          <p>Complete your <Link to="/onboarding">health profile</Link> to receive personalised recipe recommendations.</p>
        </div>
      ) : (
        <div className="rec-cards-grid">
          {top3.map((item, i) => <RecCard key={item.recipe.id} item={item} rank={i} />)}
        </div>
      )}
    </div>
  );
}

function RecCard({ item, rank }) {
  const ranks  = ['🥇', '🥈', '🥉'];
  const colors = ['#2ddc7a', '#60a5fa', '#a78bfa'];
  const color  = item.allergyHit ? '#f87171' : item.violations > 0 ? '#fbbf24' : colors[rank];
  const pct    = Math.min(Math.round((item.score / 70) * 100), 100);
  const circumf = 2 * Math.PI * 13;
  const arcFill = (pct / 100) * circumf;
  const recipe  = item.recipe;

  return (
    <Link to="/recipes" className="rec-card" style={{ position: 'relative' }}>
      <div className="rec-card-banner">
        {recipe.emoji}
        <span className="rec-card-rank">{ranks[rank]}</span>
        <span className="rec-card-type-tag">{recipe.type}</span>
      </div>
      <div className="rec-card-body">
        <div className="rec-card-name">{recipe.name}</div>
        <div className="rec-score-row">
          <div className="rec-score-ring">
            <svg viewBox="0 0 36 36" width="36" height="36">
              <circle cx="18" cy="18" r="13" fill="none" stroke="#111f16" strokeWidth="4" />
              <circle cx="18" cy="18" r="13" fill="none" stroke={color} strokeWidth="4"
                strokeDasharray={arcFill.toFixed(1) + ' ' + circumf.toFixed(1)} strokeLinecap="round"
                transform="rotate(-90 18 18)" />
            </svg>
            <div className="rec-score-center" style={{ color }}>{pct}</div>
          </div>
          <div className="rec-score-info">
            <div className="rec-score-label">Match Score</div>
            <div className="rec-score-bar-bg">
              <div className="rec-score-bar-fill" style={{ width: pct + '%', background: color }} />
            </div>
          </div>
        </div>
        <div className="rec-stats">
          <span className="rec-stat-chip"><b>{recipe.kcal}</b> kcal</span>
          <span className="rec-stat-chip"><b>{recipe.protein}g</b> P</span>
          <span className="rec-stat-chip">₱<b>{recipe.cost}</b></span>
        </div>
        <div className="rec-reason">{item.reason}</div>
      </div>
    </Link>
  );
}

function SkeletonLoader() {
  const card = (
    <div className="rec-skeleton-card">
      <div className="rec-skeleton-banner"></div>
      <div className="rec-skeleton-body">
        <div className="rec-skeleton-line" style={{ width: '80%' }}></div>
        <div className="rec-skeleton-line" style={{ width: '55%' }}></div>
        <div className="rec-skeleton-line" style={{ width: '90%', marginTop: '4px' }}></div>
      </div>
    </div>
  );
  return <div className="rec-loading">{card}{card}{card}</div>;
}

/* ============================================================
   SCORING ENGINE (ported unchanged from recommend.js)
   ============================================================ */
function scoreAndRankRecipes(profile, recipes) {
  const goal = profile.goal || 'maintain';
  const dietary = profile.dietary_restrictions || [];
  const medical = profile.medical_conditions || [];
  const allConstraints = [...dietary, ...medical];
  const ideals = GOAL_IDEALS[goal] || GOAL_IDEALS.maintain;
  const dailyTarget = computeDailyTarget(profile);
  const perMealKcal = Math.round(dailyTarget / 4);

  const scored = (recipes || []).map((recipe) => {
    let score = 0;
    let goalScore = 0;

    if (recipe.goal?.includes(goal)) goalScore += 20;
    if (recipe.protein >= ideals.minProtein) goalScore += 8;
    if (recipe.kcal <= ideals.maxKcal) goalScore += 6;
    if (recipe.fats <= ideals.maxFats) goalScore += 3;
    if (recipe.carbs >= ideals.minCarbs) goalScore += 3;
    score += Math.min(40, goalScore);

    let violations = 0, allergyHit = false;
    allConstraints.forEach((key) => {
      const blocked = CONSTRAINT_BLOCKS[key] || [];
      const isAllergy = ALLERGY_KEYS.includes(key);
      recipe.ingredients.forEach((ing) => {
        const ingLower = ing.name.toLowerCase();
        blocked.forEach((b) => {
          if (ingLower.includes(b) || b.includes(ingLower.split(' ')[0])) {
            violations++;
            if (isAllergy) allergyHit = true;
          }
        });
      });
    });

    if (allergyHit) score -= 30;
    else if (violations > 0) score -= violations * 20;

    const calDiff = Math.abs(recipe.kcal - perMealKcal);
    if (calDiff <= 50) score += 15;
    else if (calDiff <= 120) score += 10;
    else if (calDiff <= 200) score += 5;

    if (violations === 0 && allConstraints.length > 0) score += 10;

    const reason = generateReason(recipe, goal, violations, perMealKcal, profile);

    return { recipe, score: Math.max(0, score), reason, violations, allergyHit };
  });

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : Math.random() - 0.5));
  return scored.slice(0, 3);
}

function generateReason(recipe, goal, violations, perMealKcal, profile) {
  if (violations > 0 && ALLERGY_KEYS.some((k) =>
    (profile.dietary_restrictions || []).includes(k) || (profile.medical_conditions || []).includes(k)
  )) {
    return 'Flagged — contains an ingredient that may conflict with your allergy profile.';
  }

  if (goal === 'lose_weight') {
    if (recipe.kcal <= 350 && recipe.protein >= 20) {
      return 'High-protein at only ' + recipe.kcal + ' kcal — ideal for staying in a calorie deficit while preserving muscle.';
    }
    return 'At ' + recipe.kcal + ' kcal with ' + recipe.protein + 'g protein, this supports your weight loss goal with good satiety.';
  }
  if (goal === 'gain_muscle') {
    if (recipe.protein >= 30) return recipe.protein + 'g protein directly fuels muscle protein synthesis — a top pick for your muscle gain goal.';
    return 'Solid ' + recipe.protein + 'g protein and ' + recipe.carbs + 'g carbs for energy — supports your muscle-building plan.';
  }
  if (goal === 'improve_health') {
    return 'Nutrient-dense Filipino ingredients with ' + recipe.protein + 'g protein and only ' + recipe.fats + 'g fat — great for overall wellness.';
  }
  if (goal === 'boost_energy') {
    return recipe.carbs + 'g of complex carbohydrates gives you sustained energy throughout the day.';
  }
  if (goal === 'manage_condition') {
    return 'Low in fat (' + recipe.fats + 'g) and moderate calories (' + recipe.kcal + ' kcal) — suitable for condition management.';
  }

  const diff = Math.abs(recipe.kcal - perMealKcal);
  if (diff <= 80) return 'Nearly matches your per-meal calorie target of ' + perMealKcal + ' kcal — a well-balanced choice.';
  return 'Balanced macros with ' + recipe.protein + 'g protein, ' + recipe.carbs + 'g carbs, and ' + recipe.fats + 'g fat — fits your maintenance plan.';
}

function computeDailyTarget(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * 1.55;
  const adj = { lose_weight:0.85, gain_muscle:1.1, maintain:1.0, improve_health:1.0, boost_energy:1.0, manage_condition:0.9 };
  return Math.round(tdee * (adj[profile.goal] || 1.0));
}