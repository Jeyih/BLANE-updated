/* ============================================================
   BLANE — Recipe Recommendation Engine (Module 09)
   Replaces: js/recommend.js entirely + the .rec-widget markup
   block from dashboard.html.

   Scores all recipes against the user's profile (goal +
   constraint safety + calorie fit) and shows the top 3 picks.
   ============================================================ */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/recommend.css';

const REC_RECIPES = [
  { id:'r1',  emoji:'🍳', name:'Egg & Malunggay Scramble',       type:'Breakfast', kcal:380, cost:45,  protein:24, carbs:18,  fats:12,
    diet:['vegetarian'], goal:['maintain','gain_muscle'],
    ingredients:[{name:'Eggs'},{name:'Malunggay leaves'},{name:'Garlic'},{name:'Onion'},{name:'Cooking oil'}] },
  { id:'r2',  emoji:'🥣', name:'Oatmeal with Banana & Honey',    type:'Breakfast', kcal:320, cost:35,  protein:10, carbs:58,  fats:6,
    diet:['vegetarian','dairy_free'], goal:['lose_weight','boost_energy'],
    ingredients:[{name:'Rolled oats'},{name:'Banana'},{name:'Honey'},{name:'Milk'}] },
  { id:'r3',  emoji:'🍜', name:'Arroz Caldo',                    type:'Breakfast', kcal:340, cost:55,  protein:18, carbs:48,  fats:7,
    diet:[], goal:['improve_health','manage_condition'],
    ingredients:[{name:'Glutinous rice'},{name:'Chicken'},{name:'Ginger'},{name:'Garlic'},{name:'Fish sauce'},{name:'Spring onion'}] },
  { id:'r4',  emoji:'🥗', name:'Chicken & Veggie Rice Bowl',     type:'Lunch',     kcal:520, cost:95,  protein:38, carbs:52,  fats:10,
    diet:['gluten_free'], goal:['gain_muscle','maintain'],
    ingredients:[{name:'Chicken breast'},{name:'Brown rice'},{name:'Broccoli'},{name:'Soy sauce'},{name:'Sesame oil'},{name:'Garlic'}] },
  { id:'r5',  emoji:'🩵', name:'Tinolang Manok',                 type:'Lunch',     kcal:310, cost:75,  protein:28, carbs:20,  fats:8,
    diet:['gluten_free','dairy_free'], goal:['improve_health','lose_weight','manage_condition'],
    ingredients:[{name:'Chicken'},{name:'Green papaya'},{name:'Malunggay'},{name:'Ginger'},{name:'Fish sauce'}] },
  { id:'r6',  emoji:'🥩', name:'Grilled Pork Liempo',            type:'Lunch',     kcal:560, cost:110, protein:42, carbs:10,  fats:28,
    diet:['gluten_free','dairy_free'], goal:['gain_muscle','maintain'],
    ingredients:[{name:'Pork belly'},{name:'Calamansi'},{name:'Soy sauce'},{name:'Garlic'},{name:'Brown sugar'}] },
  { id:'r7',  emoji:'🍲', name:'Sinigang na Isda',               type:'Dinner',    kcal:280, cost:80,  protein:32, carbs:18,  fats:5,
    diet:['gluten_free','dairy_free'], goal:['lose_weight','improve_health','manage_condition'],
    ingredients:[{name:'Bangus'},{name:'Kangkong'},{name:'Tamarind mix'},{name:'Tomatoes'},{name:'Fish sauce'},{name:'Radish'}] },
  { id:'r8',  emoji:'🍛', name:'Monggo Guisado',                 type:'Dinner',    kcal:380, cost:55,  protein:22, carbs:50,  fats:6,
    diet:['dairy_free'], goal:['lose_weight','improve_health'],
    ingredients:[{name:'Mung beans'},{name:'Pork'},{name:'Ampalaya leaves'},{name:'Garlic'},{name:'Tomato'},{name:'Fish sauce'}] },
  { id:'r9',  emoji:'🍌', name:'Banana & Peanut Butter',         type:'Snack',     kcal:210, cost:25,  protein:6,  carbs:30,  fats:8,
    diet:['vegetarian','gluten_free'], goal:['boost_energy','gain_muscle'],
    ingredients:[{name:'Banana'},{name:'Peanut butter'}] },
  { id:'r10', emoji:'🧁', name:'Camote Cue',                     type:'Snack',     kcal:260, cost:30,  protein:2,  carbs:54,  fats:7,
    diet:['vegan','gluten_free','dairy_free'], goal:['boost_energy'],
    ingredients:[{name:'Sweet potato'},{name:'Brown sugar'},{name:'Cooking oil'}] },
  { id:'r11', emoji:'🥬', name:'Pinakbet',                       type:'Dinner',    kcal:220, cost:60,  protein:12, carbs:22,  fats:8,
    diet:['gluten_free','dairy_free'], goal:['lose_weight','improve_health','manage_condition'],
    ingredients:[{name:'Ampalaya'},{name:'Eggplant'},{name:'Squash'},{name:'String beans'},{name:'Bagoong alamang'},{name:'Pork'}] },
  { id:'r12', emoji:'🫙', name:'Ensaladang Talong',              type:'Snack',     kcal:120, cost:20,  protein:4,  carbs:12,  fats:6,
    diet:['vegan','gluten_free','dairy_free'], goal:['lose_weight','improve_health'],
    ingredients:[{name:'Eggplant'},{name:'Tomato'},{name:'Onion'},{name:'Salted egg'},{name:'Fish sauce'}] },
];

const CONSTRAINT_BLOCKS = {
  nut_allergy: ['peanut butter','ground peanuts'],
  shellfish_allergy: ['bagoong alamang','shrimp','bagoong'],
  egg_free: ['eggs','salted egg'],
  soy_free: ['soy sauce','tofu'],
  vegetarian: ['chicken','pork','bangus','tilapia','fish sauce','beef'],
  vegan: ['chicken','pork','bangus','tilapia','fish sauce','eggs','salted egg','milk','honey'],
  halal: ['pork','pork belly','bagoong'],
  gluten_free: ['soy sauce'],
  dairy_free: ['milk','butter','cream','yogurt'],
  low_sodium: ['fish sauce','soy sauce','bagoong alamang','salted egg'],
  low_sugar: ['brown sugar','honey','sugar'],
  diabetes_t1: ['brown sugar','honey','sugar'],
  diabetes_t2: ['brown sugar','honey','sugar'],
  hypertension: ['fish sauce','soy sauce','bagoong alamang','salted egg'],
  high_cholesterol: ['pork belly','butter'],
  gerd: ['calamansi','vinegar','chili','tomato'],
  gout: ['pork belly','beef','bagoong'],
};
const ALLERGY_KEYS = ['nut_allergy','shellfish_allergy','egg_free','soy_free'];
const GOAL_IDEALS = {
  lose_weight: { maxKcal:500, minProtein:20, maxFats:18, minCarbs:0 },
  gain_muscle: { maxKcal:999, minProtein:30, maxFats:999, minCarbs:40 },
  maintain: { maxKcal:650, minProtein:15, maxFats:999, minCarbs:0 },
  improve_health: { maxKcal:999, minProtein:15, maxFats:20, minCarbs:0 },
  boost_energy: { maxKcal:999, minProtein:0, maxFats:999, minCarbs:35 },
  manage_condition: { maxKcal:500, minProtein:15, maxFats:18, minCarbs:0 },
};

export default function RecommendWidget({ profile }) {
  const [loading, setLoading] = useState(true);
  const [top3, setTop3]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      if (cancelled) return;
      setTop3(profile ? scoreAndRankRecipes(profile) : []);
      setLoading(false);
    }, 400); /* perceived "thinking" delay, matches old widget */
    return () => { cancelled = true; clearTimeout(timer); };
  }, [profile]);

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
function scoreAndRankRecipes(profile) {
  const goal = profile.goal || 'maintain';
  const dietary = profile.dietary_restrictions || [];
  const medical = profile.medical_conditions || [];
  const allConstraints = [...dietary, ...medical];
  const ideals = GOAL_IDEALS[goal] || GOAL_IDEALS.maintain;
  const dailyTarget = computeDailyTarget(profile);
  const perMealKcal = Math.round(dailyTarget / 4);

  const scored = REC_RECIPES.map((recipe) => {
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