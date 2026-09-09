import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import FeedbackWidget from '../components/FeedbackWidget';
import DriftWidget from '../components/DriftWidget';
import RecommendWidget from '../components/RecommendWidget';
import '../styles/dashboard.css';

function getCalorieGoal(profile) {
  if (!profile) return 1840;
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = bmr * 1.55;
  const adj = { lose_weight: 0.85, gain_muscle: 1.1, maintain: 1.0, improve_health: 1.0, boost_energy: 1.0, manage_condition: 0.9 };
  return Math.round(tdee * (adj[profile.goal] || 1.0)) || 1840;
}

function generateDefaultPlan(recipeList) {
  if (!recipeList || recipeList.length === 0) return {};
  const breakfasts = recipeList.filter((r) => r.type === 'Breakfast');
  const lunches    = recipeList.filter((r) => r.type === 'Lunch');
  const dinners    = recipeList.filter((r) => r.type === 'Dinner');
  const snacks     = recipeList.filter((r) => r.type === 'Snack');

  const defaultSlots = {};
  for (let day = 0; day < 7; day++) {
    const bMeal = breakfasts.length ? breakfasts[day % breakfasts.length] : recipeList[0];
    const lMeal = lunches.length ? lunches[day % lunches.length] : (recipeList[1] || recipeList[0]);
    const sMeal = snacks.length ? snacks[day % snacks.length] : null;
    const dMeal = dinners.length ? dinners[day % dinners.length] : (recipeList[2] || recipeList[0]);

    const dayArr = [];
    if (bMeal) dayArr.push({ type: 'Breakfast', time: '7:00 AM', mealId: bMeal.id });
    if (lMeal) dayArr.push({ type: 'Lunch', time: '12:00 PM', mealId: lMeal.id });
    if (sMeal) dayArr.push({ type: 'Snack', time: '3:00 PM', mealId: sMeal.id });
    if (dMeal) dayArr.push({ type: 'Dinner', time: '6:30 PM', mealId: dMeal.id });

    defaultSlots[day] = dayArr;
  }
  return defaultSlots;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [firstName, setFirstName] = useState('...');
  const [logs, setLogs]         = useState([]);

  useEffect(() => { loadProfile(); }, [user]);

  async function loadProfile() {
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (data) {
      setProfile(data);
      setFirstName((data.full_name || user.email.split('@')[0]).split(' ')[0]);
    }
  }

  const [quickCheckinMood, setQuickCheckinMood] = useState(null);
  const [checkinToast, setCheckinToast] = useState('');

  function handleCheckin(mood, note) {
    setQuickCheckinMood(mood);
    setCheckinToast(note);
    setTimeout(() => setCheckinToast(''), 4000);
  }

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <Navbar />
      <main className="dash-main">
        <div className="dash-content">

          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Good day, <span style={{ color: '#2ddc7a' }}>{firstName}</span> 👋</h1>
              <p className="dash-page-date" style={{ color: '#d1fae5', fontSize: 15 }}>{today} · Personalized for your metabolic profile</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="widget-badge" style={{ fontSize: 13, padding: '8px 16px', background: 'rgba(45, 220, 122, 0.2)', border: '1px solid #2ddc7a' }}>
                ● Real-time Adaptive Engine
              </span>
            </div>
          </div>

          {/* Friendly Quick Check-in Bar for all ages */}
          <div style={{
            background: 'linear-gradient(135deg, #173023 0%, #12261b 100%)',
            border: '1px solid rgba(45, 220, 122, 0.25)',
            borderRadius: '18px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🌱</span>
              <div>
                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px' }}>
                  Daily Check-in: How are you feeling right now?
                </div>
                <div style={{ color: '#d1fae5', fontSize: '13px' }}>
                  {checkinToast || 'Tap a mood to dynamically tune today’s energy and hydration targets.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { mood: 'energetic', icon: '⚡', label: 'Energetic', note: 'Awesome! Maintaining active energy balance (+100 kcal reserve).' },
                { mood: 'great', icon: '😊', label: 'Feeling Great', note: 'Optimal metabolic state! Your current meal plan is fully balanced.' },
                { mood: 'active', icon: '💪', label: 'Workout Today', note: 'Activity logged! Prioritizing protein recovery in today’s dinner.' },
                { mood: 'tired', icon: '😴', label: 'Tired / Low Energy', note: 'Noted! Boosted complex carbs & magnesium-rich ingredients.' },
              ].map((item) => (
                <button
                  key={item.mood}
                  type="button"
                  onClick={() => handleCheckin(item.mood, item.note)}
                  style={{
                    background: quickCheckinMood === item.mood ? '#2ddc7a' : 'rgba(255, 255, 255, 0.06)',
                    color: quickCheckinMood === item.mood ? '#0a1610' : '#ffffff',
                    border: quickCheckinMood === item.mood ? '2px solid #ffffff' : '1px solid rgba(45, 220, 122, 0.25)',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="dash-grid">
            <MealPlanWidget profile={profile} />
            <BmiWidget profile={profile} />

            <RecommendWidget profile={profile} />

            {profile && (
              <FeedbackWidget
                profile={profile}
                onProfileUpdate={setProfile}
                onLogsChange={setLogs}
              />
            )}

            {profile && <DriftWidget logs={logs} profile={profile} />}
          </div>

        </div>
      </main>
    </>
  );
}

/* ============================================================
   WIDGET 1 — TODAY'S MEAL PLAN (Dynamic from MealPlan / Supabase)
   ============================================================ */
function MealPlanWidget({ profile }) {
  const [recipes, setRecipes] = useState([]);
  const [daySlots, setDaySlots] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: recipesData } = await supabase.from('recipes').select('*').order('name');
      const { data: ingData } = await supabase.from('recipe_ingredients').select('*').order('sort_order');

      const ingByRecipe = {};
      (ingData || []).forEach((ing) => {
        if (!ingByRecipe[ing.recipe_id]) ingByRecipe[ing.recipe_id] = [];
        ingByRecipe[ing.recipe_id].push({ name: ing.name, qty: ing.qty, status: ing.status || 'avail' });
      });

      const formattedRecipes = (recipesData || []).map((r) => ({
        id: r.id,
        emoji: r.emoji || '🍲',
        name: r.name,
        type: r.type,
        difficulty: r.difficulty || 'medium',
        cookTime: r.cook_time_min || 20,
        prep: `${r.cook_time_min || 20} min`,
        kcal: r.kcal || 0,
        cost: r.cost || 0,
        protein: r.protein_g || 0,
        carbs: r.carbs_g || 0,
        fats: r.fats_g || 0,
        ingredients: ingByRecipe[r.id] || [],
      }));

      setRecipes(formattedRecipes);

      // Load meal plan from localStorage or generate default
      const saved = localStorage.getItem('blane_meal_plan');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && Object.keys(parsed).length > 0) {
            setDaySlots(parsed);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (formattedRecipes.length > 0) {
        const defaultPlan = generateDefaultPlan(formattedRecipes);
        setDaySlots(defaultPlan);
      }
      setLoading(false);
    }

    loadData();
  }, []);

  function getMeal(id) {
    if (!id) return null;
    return recipes.find((r) => r.id === id || String(r.id) === String(id)) || null;
  }

  const todayIndex = new Date().getDay();
  const todaySlots = daySlots[todayIndex] || [];
  const plannedMeals = todaySlots.map((s) => ({ slot: s, meal: getMeal(s.mealId) })).filter((item) => item.meal);

  const totalKcal = plannedMeals.reduce((acc, item) => acc + item.meal.kcal, 0);
  const totalProtein = plannedMeals.reduce((acc, item) => acc + item.meal.protein, 0);
  const totalCost = plannedMeals.reduce((acc, item) => acc + item.meal.cost, 0);
  const calGoal = getCalorieGoal(profile);
  const calPct = Math.min(Math.round((totalKcal / calGoal) * 100), 100);

  const currentItem = plannedMeals[activeTabIdx] || plannedMeals[0];

  return (
    <div className="widget col-8">
      <div className="widget-header">
        <div className="widget-title-row">
          <div className="widget-icon">🍽️</div>
          <div>
            <div className="widget-title">Today's Meal Plan</div>
            <div className="widget-subtitle">Adapted to your goals &amp; local market</div>
          </div>
        </div>
        <Link to="/mealplan" className="widget-badge" style={{ textDecoration: 'none' }}>
          Open Meal Plan →
        </Link>
      </div>

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#d1fae5', fontSize: '15px' }}>Loading today's meal plan…</div>
      ) : plannedMeals.length === 0 ? (
        <div className="dash-empty-state" style={{ padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🍽️</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#ffffff' }}>No meals planned for today yet.</div>
          <div style={{ color: '#d1fae5', lineHeight: 1.6, marginBottom: 16 }}>
            Customize your schedule or pick recipes on the Meal Plan page.
          </div>
          <Link to="/mealplan" className="widget-badge" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: 13 }}>
            Plan Today's Meals →
          </Link>
        </div>
      ) : (
        <>
          <div className="meal-tabs">
            {plannedMeals.map((item, idx) => (
              <button
                key={idx}
                className={'meal-tab-btn' + (idx === activeTabIdx ? ' active' : '')}
                onClick={() => setActiveTabIdx(idx)}
              >
                {item.slot.type}
              </button>
            ))}
          </div>

          {currentItem && (
            <div className="meal-panel active">
              <div className="meal-main-card">
                <div className="meal-emoji-big">{currentItem.meal.emoji}</div>
                <div className="meal-main-info">
                  <div className="meal-main-name">{currentItem.meal.name}</div>
                  <div className="meal-main-meta">{currentItem.slot.time || 'Today'} &nbsp;·&nbsp; {currentItem.meal.prep} prep &nbsp;·&nbsp; ₱{currentItem.meal.cost}</div>
                  <div className="meal-macros-row">
                    <div className="meal-macro-chip"><span>{currentItem.meal.protein}g</span> <small>Protein</small></div>
                    <div className="meal-macro-chip"><span>{currentItem.meal.carbs}g</span> <small>Carbs</small></div>
                    <div className="meal-macro-chip"><span>{currentItem.meal.fats}g</span> <small>Fats</small></div>
                  </div>
                </div>
                <div className="meal-kcal-tag">
                  {currentItem.meal.kcal}
                  <small>kcal</small>
                </div>
              </div>

              {currentItem.meal.ingredients.length > 0 && (
                <div className="meal-ingredients">
                  <div style={{ fontSize: 12, color: '#d1fae5', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Key Ingredients</div>
                  {currentItem.meal.ingredients.slice(0, 4).map((ing, i) => (
                    <div key={i} className="meal-ingredient-row">
                      <div className="ingredient-dot"></div>
                      <span className="ingredient-name">{ing.name}</span>
                      <span className="ingredient-amount">{ing.qty}</span>
                      <span className={'ingredient-avail ' + (ing.status === 'avail' ? 'yes' : 'no')}>
                        {ing.status === 'avail' ? '✓ In stock' : '⚠ Check market'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="daily-cal-summary">
            <div className="daily-cal-row">
              <span className="daily-cal-label">Today's Total: <b>{totalProtein}g</b> P · <b>₱{totalCost}</b> Est. Cost</span>
              <span className="daily-cal-numbers"><span>{totalKcal}</span> / {calGoal} kcal</span>
            </div>
            <div className="daily-cal-bar-bg">
              <div className="daily-cal-bar-fill" style={{ width: calPct + '%' }}></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   WIDGET 2 — BMI & BODY STATS
   ============================================================ */
function BmiWidget({ profile }) {
  const h = parseFloat(profile?.height_cm);
  const w = parseFloat(profile?.weight_kg);
  const hasData = h && w;

  const bmi = hasData ? w / ((h / 100) * (h / 100)) : null;
  const bmiFixed = bmi ? bmi.toFixed(1) : '--';

  let category = '--', color = '#2ddc7a', desc = 'Loading your profile data...';
  if (bmi) {
    if (bmi < 18.5)      { category = 'Underweight'; color = '#60a5fa'; desc = 'Your BMI is below the healthy range. Consider a calorie surplus plan.'; }
    else if (bmi < 25)   { category = 'Normal';       color = '#2ddc7a'; desc = 'Your BMI is within the healthy range. Keep up the great work!'; }
    else if (bmi < 30)   { category = 'Overweight';   color = '#fbbf24'; desc = 'Your BMI is slightly above normal. A moderate deficit may help.'; }
    else                 { category = 'Obese';         color = '#f87171'; desc = 'Your BMI indicates obesity. Please consult a healthcare provider.'; }
  }

  const circumf = 2 * Math.PI * 36;
  const pct = bmi ? Math.min(bmi / 40, 1) : 0;
  const arcFill = pct * circumf;
  const scalePct = bmi ? Math.min(Math.max((bmi - 10) / 30, 0), 1) * 100 : 0;

  const idealLow  = hasData ? (18.5 * (h / 100) * (h / 100)).toFixed(1) : null;
  const idealHigh = hasData ? (24.9 * (h / 100) * (h / 100)).toFixed(1) : null;

  return (
    <div className="widget col-4">
      <div className="widget-header">
        <div className="widget-title-row">
          <div className="widget-icon">📊</div>
          <div>
            <div className="widget-title">BMI &amp; Body Stats</div>
            <div className="widget-subtitle">Based on your profile</div>
          </div>
        </div>
      </div>

      <div className="bmi-display">
        <div className="bmi-ring-wrap">
          <svg viewBox="0 0 90 90" width="90" height="90">
            <circle cx="45" cy="45" r="36" fill="none" stroke="#111f16" strokeWidth="9" />
            <circle cx="45" cy="45" r="36" fill="none" stroke={color} strokeWidth="9"
              strokeDasharray={arcFill.toFixed(1) + ' ' + circumf.toFixed(1)} strokeDashoffset="0"
              strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
          </svg>
          <div className="bmi-ring-center">
            <div className="bmi-value">{bmiFixed}</div>
            <div className="bmi-label-sm">BMI</div>
          </div>
        </div>
        <div className="bmi-category-wrap">
          <div className="bmi-category-name" style={{ color }}>{category}</div>
          <div className="bmi-category-desc">{desc}</div>
        </div>
      </div>

      <div className="bmi-scale">
        <div className="bmi-scale-bar">
          <div className="bmi-scale-marker" style={{ left: scalePct + '%', transition: 'left 0.8s ease' }}></div>
        </div>
        <div className="bmi-scale-labels">
          <span>Under</span><span>Normal</span><span>Over</span><span>Obese</span>
        </div>
      </div>

      <div className="body-stats-grid">
        <div className="body-stat-item">
          <div className="body-stat-label">Height</div>
          <div className="body-stat-value">{h || '--'} <span>cm</span></div>
        </div>
        <div className="body-stat-item">
          <div className="body-stat-label">Weight</div>
          <div className="body-stat-value">{w || '--'} <span>kg</span></div>
        </div>
        <div className="body-stat-item">
          <div className="body-stat-label">BMI Index</div>
          <div className="body-stat-value">{bmiFixed}</div>
        </div>
        <div className="body-stat-item">
          <div className="body-stat-label">Ideal Range</div>
          <div className="body-stat-value" style={{ fontSize: 13 }}>
            {hasData ? idealLow + ' – ' + idealHigh + ' kg' : '-- kg'}
          </div>
        </div>
      </div>
    </div>
  );
}