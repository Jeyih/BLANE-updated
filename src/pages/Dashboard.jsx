/* ============================================================
   BLANE — Dashboard Page
   Replaces: dashboard.html (markup) + js/dashboard.js
   (initGreeting, initDateHeader, initBmiWidget, initMealTabs —
   nav dropdown/mobile logic is now handled entirely by <Navbar />).

   Widget order matches dashboard.html exactly:
   Meal Plan (col-8) -> BMI & Body Stats (col-4) ->
   Recommended for You -> Real-Time Body Feedback Loop ->
   Health Drift Detection.

   Note: dashboard.js still referenced initWaterTracker() /
   initMarketWidget(), but dashboard.html never actually
   contained the matching markup for a water tracker or market
   widget — they were dead code in the old build, so they're
   intentionally left out here to keep the UI a 1:1 match.

   Composes the 3 modular feature widgets built separately:
   FeedbackWidget (01), DriftWidget (02), RecommendWidget (09).
   BMI and meal tabs stay inline here since they were part of
   dashboard.js itself, not separate feature files, in the
   original build.
   ============================================================ */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import FeedbackWidget from '../components/FeedbackWidget';
import DriftWidget from '../components/DriftWidget';
import RecommendWidget from '../components/RecommendWidget';
import '../styles/dashboard.css';

const DEMO_MEALS = {
  breakfast: { emoji: '🍳', name: 'Egg & Malunggay Scramble', time: '7:00 AM', prep: '15 min prep', difficulty: 'Easy', protein: 24, carbs: 18, fats: 12, kcal: 380,
    ingredients: [
      { name: 'Eggs', amount: '2 pcs', avail: true },
      { name: 'Malunggay leaves', amount: '1 handful', avail: true },
      { name: 'Garlic', amount: '2 cloves', avail: true },
      { name: 'Cooking oil', amount: '1 tsp', avail: true },
    ] },
  lunch: { emoji: '🥗', name: 'Chicken & Veggie Rice Bowl', time: '12:00 PM', prep: '25 min prep', difficulty: 'Medium', protein: 38, carbs: 52, fats: 10, kcal: 520,
    ingredients: [
      { name: 'Chicken breast', amount: '150g', avail: true },
      { name: 'Brown rice', amount: '1 cup cooked', avail: true },
      { name: 'Broccoli', amount: '80g', avail: false },
    ] },
  dinner: { emoji: '🍲', name: 'Sinigang na Isda', time: '6:30 PM', prep: '35 min prep', difficulty: 'Medium', protein: 32, carbs: 28, fats: 8, kcal: 480,
    ingredients: [
      { name: 'Bangus / Tilapia', amount: '200g', avail: true },
      { name: 'Kangkong', amount: '1 bundle', avail: true, label: '✓ Seasonal' },
      { name: 'Tamarind mix', amount: '1 pack', avail: true },
    ] },
  snack: { emoji: '🍌', name: 'Banana & Peanut Butter', time: '3:00 PM', prep: '5 min prep', difficulty: 'Easy', protein: 6, carbs: 30, fats: 8, kcal: 210,
    ingredients: [
      { name: 'Ripe banana', amount: '1 pc', avail: true },
      { name: 'Peanut butter', amount: '1 tbsp', avail: true },
    ] },
};

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

  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <Navbar />
      <main className="dash-main">
        <div className="dash-content">

          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Good day, &nbsp;<span style={{ color: '#2ddc7a' }}>{firstName}</span> 👋</h1>
              <p className="dash-page-date">{today}</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="widget-badge" style={{ fontSize: 12, padding: '6px 14px' }}>● Live sync active</span>
            </div>
          </div>

          <div className="dash-grid">
            <MealPlanWidget />
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
   WIDGET 1 — TODAY'S MEAL PLAN (static demo, tabs)
   ============================================================ */
function MealPlanWidget() {
  const [tab, setTab] = useState('breakfast');
  const meal = DEMO_MEALS[tab];

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
        <span className="widget-badge">AI Generated</span>
      </div>

      <div className="meal-tabs">
        {Object.keys(DEMO_MEALS).map((key) => (
          <button
            key={key}
            className={'meal-tab-btn' + (tab === key ? ' active' : '')}
            onClick={() => setTab(key)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      <div className="meal-panel active">
        <div className="meal-main-card">
          <div className="meal-emoji-big">{meal.emoji}</div>
          <div className="meal-main-info">
            <div className="meal-main-name">{meal.name}</div>
            <div className="meal-main-meta">{meal.time} &nbsp;·&nbsp; {meal.prep} &nbsp;·&nbsp; {meal.difficulty}</div>
            <div className="meal-macros-row">
              <div className="meal-macro-chip"><span>{meal.protein}g</span> <small>Protein</small></div>
              <div className="meal-macro-chip"><span>{meal.carbs}g</span> <small>Carbs</small></div>
              <div className="meal-macro-chip"><span>{meal.fats}g</span> <small>Fats</small></div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="meal-kcal-tag">{meal.kcal}<small>kcal</small></div>
          </div>
        </div>
        <div className="meal-ingredients">
          {meal.ingredients.map((ing) => (
            <div key={ing.name} className="meal-ingredient-row">
              <div className="ingredient-dot"></div>
              <span className="ingredient-name">{ing.name}</span>
              <span className="ingredient-amount">{ing.amount}</span>
              <span className={'ingredient-avail ' + (ing.avail ? 'yes' : 'no')}>
                {ing.label || (ing.avail ? '✓ Available' : '⚠ Check market')}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="daily-cal-summary">
        <div className="daily-cal-row">
          <span className="daily-cal-label">Daily calories</span>
          <span className="daily-cal-numbers"><span>1,590</span> / 1,840 kcal</span>
        </div>
        <div className="daily-cal-bar-bg">
          <div className="daily-cal-bar-fill" style={{ width: '86%' }}></div>
        </div>
      </div>
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