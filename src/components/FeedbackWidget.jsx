/* ============================================================
   BLANE — Real-Time Body Feedback Loop (Module 01)
   Replaces: js/feedback.js entirely + the #fb-widget markup
   block from dashboard.html.

   Manual logging of weight/sleep/water/calories, recalculates
   BMI + calorie/macro targets, runs 7-day drift alerts, shows
   sparkline trends. All local component state now — no more
   fb* global variables or direct DOM writes.
   ============================================================ */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/feedback.css';

const ACTIVITY_MULT = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra_active: 1.9 };
const GOAL_ADJUST   = { lose_weight: 0.85, gain_muscle: 1.10, maintain: 1.0, improve_health: 1.0, boost_energy: 1.0, manage_condition: 1.0 };
const DRIFT = { weightGain: 0.5, weightLoss: 1.5, sleepMin: 6, waterMin: 1800, calLowPct: 0.75 };

export default function FeedbackWidget({ profile, onProfileUpdate, onLogsChange }) {
  const [logs, setLogs]           = useState([]);
  const [todayLogged, setTodayLogged] = useState(false);
  const [weight, setWeight]       = useState('');
  const [sleep, setSleep]         = useState('');
  const [waterCups, setWaterCups] = useState('');
  const [calories, setCalories]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [alerts, setAlerts]       = useState([]);
  const [recalcBanner, setRecalcBanner] = useState(null);
  const [toast, setToast]         = useState(null);

  useEffect(() => { loadRecentLogs(); }, [profile]);

  async function loadRecentLogs() {
    if (!profile?.id) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', profile.id)
      .gte('logged_at', sevenDaysAgo.toISOString().split('T')[0])
      .order('logged_at', { ascending: false });

    if (data) {
      setLogs(data);
      const todayStr = new Date().toISOString().split('T')[0];
      const isLogged = data.some((l) => l.logged_at === todayStr);
      setTodayLogged(isLogged);

      const todayLog = data.find((l) => l.logged_at === todayStr);
      if (todayLog) {
        if (todayLog.weight_kg)       setWeight(todayLog.weight_kg);
        if (todayLog.sleep_hours)     setSleep(todayLog.sleep_hours);
        if (todayLog.water_ml)        setWaterCups(Math.round(todayLog.water_ml / 300));
        if (todayLog.calories_burned) setCalories(todayLog.calories_burned);
      }

      if (data.length >= 2) setAlerts(detectDrift(data, profile));
      onLogsChange?.(data);
    }
  }

  const yesterday = logs.find((l) => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return l.logged_at === d.toISOString().split('T')[0];
  });

  async function handleLogSubmit() {
    const w = parseFloat(weight) || null;
    const s = parseFloat(sleep)  || null;
    const wc = parseInt(waterCups) || null;
    const c = parseInt(calories)   || null;

    if (!w && !s && !wc && !c) {
      showToast('Please fill in at least one metric.', true);
      return;
    }

    setSaving(true);
    const todayStr = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('health_logs').upsert({
      user_id: profile.id, logged_at: todayStr,
      weight_kg: w, sleep_hours: s,
      water_ml: wc ? wc * 300 : null, calories_burned: c,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,logged_at' });

    if (error) {
      showToast('Could not save: ' + error.message, true);
      setSaving(false);
      return;
    }

    let updatedProfile = profile;
    if (w && w !== profile.weight_kg) {
      await supabase.from('profiles').upsert({ id: profile.id, weight_kg: w, updated_at: new Date().toISOString() });
      updatedProfile = { ...profile, weight_kg: w };
      onProfileUpdate?.(updatedProfile);
    }

    await loadRecentLogs();

    const targets = recalculateTargets(updatedProfile);
    setRecalcBanner(targets);
    setTimeout(() => setRecalcBanner(null), 6000);

    setSaving(false);
    showToast('✓ Health data logged and targets updated');
  }

  function showToast(msg, isError) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  const metrics = [
    { key: 'weight_kg', label: 'Weight', icon: '⚖️' },
    { key: 'sleep_hours', label: 'Sleep', icon: '😴' },
    { key: 'water_ml', label: 'Water', icon: '💧' },
    { key: 'calories_burned', label: 'Activity', icon: '🔥' },
  ];
  const todayLog = logs.find((l) => l.logged_at === new Date().toISOString().split('T')[0]);

  return (
    <div className="fb-widget col-12" data-dashboard-tour="feedback">
      <div className="fb-widget-header">
        <div className="fb-widget-title-row">
          <div className="fb-widget-icon">🔄</div>
          <div>
            <div className="fb-widget-title">Real-Time Body Feedback Loop</div>
            <div className="fb-widget-sub">Log today's health data — targets recalculate automatically</div>
          </div>
        </div>
        <span className={'fb-last-logged' + (todayLogged ? ' today' : '')}>
          {todayLogged ? '✓ Logged today' : logs.length > 0 ? 'Last: ' + formatDate(logs[0].logged_at) : 'Not logged yet'}
        </span>
      </div>

      <div className="fb-today-status">
        {metrics.map((m) => {
          const logged = todayLog && todayLog[m.key] != null;
          return (
            <div key={m.key} className={'fb-status-chip' + (logged ? ' logged' : ' pending')}>
              {(logged ? '✓ ' : '○ ') + m.label}
            </div>
          );
        })}
      </div>

      <div className="fb-metric-grid">
        <div className="fb-metric-card">
          <div className="fb-metric-label">⚖️ Weight</div>
          <div className="fb-metric-input-row">
            <input className="fb-metric-input" type="number" placeholder="--" min="20" max="300" step="0.1"
              value={weight} onChange={(e) => setWeight(e.target.value)} />
            <span className="fb-metric-unit">kg</span>
          </div>
          <div className="fb-metric-prev">{yesterday?.weight_kg ? 'Yesterday: ' + yesterday.weight_kg + ' kg' : ''}</div>
        </div>

        <div className="fb-metric-card">
          <div className="fb-metric-label">😴 Sleep</div>
          <div className="fb-metric-input-row">
            <input className="fb-metric-input" type="number" placeholder="--" min="0" max="24" step="0.5"
              value={sleep} onChange={(e) => setSleep(e.target.value)} />
            <span className="fb-metric-unit">hrs</span>
          </div>
        </div>

        <div className="fb-metric-card">
          <div className="fb-metric-label">💧 Water</div>
          <div className="fb-metric-input-row">
            <input className="fb-metric-input" type="number" placeholder="--" min="0" max="20" step="1"
              value={waterCups} onChange={(e) => setWaterCups(e.target.value)} />
            <span className="fb-metric-unit">cups</span>
          </div>
          <div className="fb-metric-prev" style={{ fontSize: '11px', color: '#4d6e5a', marginTop: '5px' }}>1 cup = 300 ml</div>
        </div>

        <div className="fb-metric-card">
          <div className="fb-metric-label">🔥 Calories Burned</div>
          <div className="fb-metric-input-row">
            <input className="fb-metric-input" type="number" placeholder="--" min="0" max="5000" step="10"
              value={calories} onChange={(e) => setCalories(e.target.value)} />
            <span className="fb-metric-unit">kcal</span>
          </div>
          <div className="fb-metric-prev">{yesterday?.calories_burned ? 'Yesterday: ' + yesterday.calories_burned + ' kcal' : ''}</div>
        </div>
      </div>

      <button className="fb-log-btn" onClick={handleLogSubmit} disabled={saving}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        {saving ? 'Saving...' : todayLogged ? "Update Today's Log" : "Log Today's Health"}
      </button>

      {recalcBanner && (
        <div className="fb-recalc-banner show">
          <span className="fb-recalc-icon">⚡</span>
          <div className="fb-recalc-text">
            Targets updated — Daily goal: <strong>{recalcBanner.target.toLocaleString()} kcal</strong> &nbsp;·&nbsp;
            <strong> {recalcBanner.protein}g</strong> protein &nbsp;·&nbsp;
            <strong> {recalcBanner.carbs}g</strong> carbs &nbsp;·&nbsp;
            <strong> {recalcBanner.fats}g</strong> fats
          </div>
        </div>
      )}

      <div className="fb-drift-panel">
        {alerts.map((a, i) => (
          <div key={i} className={'fb-drift-alert ' + a.type}>
            <span className="fb-drift-icon">{a.icon}</span>
            <div className="fb-drift-text"><strong>{a.title}</strong>{a.text}</div>
          </div>
        ))}
      </div>

      <div className="fb-history-row">
        <Sparkline label="Weight (7d)"   values={logs.map((l) => l.weight_kg).reverse()}        color="#2ddc7a" />
        <Sparkline label="Sleep (7d)"    values={logs.map((l) => l.sleep_hours).reverse()}       color="#60a5fa" />
        <Sparkline label="Activity (7d)" values={logs.map((l) => l.calories_burned).reverse()}   color="#fbbf24" />
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#0d1a12', border: '1px solid ' + (toast.isError ? 'rgba(248,113,113,0.35)' : 'rgba(45,220,122,0.35)'),
          borderRadius: 12, padding: '12px 22px', fontSize: 14,
          color: toast.isError ? '#f87171' : '#2ddc7a', zIndex: 999, whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---- Sparkline sub-component ---- */
function Sparkline({ label, values, color }) {
  const valid = values.filter((v) => v != null);
  const W = 120, H = 32;

  let content;
  let isEmpty = valid.length < 2;

  if (isEmpty) {
    content = (
      <text
        x="60" y="20"
        fill="#4d6e5a"
        fontSize="9"
        fontFamily="DM Sans,sans-serif"
        textAnchor="middle"
      >
        Not enough data yet
      </text>
    );
  } else {
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    const step = W / Math.max(values.length - 1, 1);
    const pts = [];
    values.forEach((v, i) => {
      if (v == null) return;
      pts.push({ x: Math.round(i * step), y: Math.round(H - ((v - min) / range) * (H - 4) - 2) });
    });
    const last = pts[pts.length - 1];
    content = (
      <>
        <polyline points={pts.map((p) => p.x + ',' + p.y).join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
        <circle cx={last.x} cy={last.y} r="3" fill={color} />
      </>
    );
  }

  return (
    <div className="fb-sparkline-wrap">
      <div className="fb-sparkline-label">{label}</div>
      <svg
        className="fb-sparkline-svg"
        viewBox="0 0 120 32"
        preserveAspectRatio={isEmpty ? 'xMidYMid meet' : 'none'}
      >
        {content}
      </svg>
    </div>
  );
}

/* ============================================================
   PURE HELPER FUNCTIONS (ported unchanged from feedback.js)
   ============================================================ */
function recalculateTargets(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = Math.round(bmr * (ACTIVITY_MULT[profile.activity_level] || 1.55));
  const target = Math.round(tdee * (GOAL_ADJUST[profile.goal] || 1.0));
  return {
    tdee, target,
    protein: Math.round((target * 0.30) / 4),
    carbs: Math.round((target * 0.45) / 4),
    fats: Math.round((target * 0.25) / 9),
  };
}

function computeTDEE(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  return Math.round(bmr * (ACTIVITY_MULT[profile.activity_level] || 1.55));
}

function detectDrift(logs, profile) {
  const alerts = [];
  if (!logs?.length) return alerts;
  const today = logs[0];
  const past = logs.slice(1);

  const weightLogs = past.filter((l) => l.weight_kg);
  if (today.weight_kg && weightLogs.length > 0) {
    const avg = weightLogs.reduce((s, l) => s + l.weight_kg, 0) / weightLogs.length;
    const diff = today.weight_kg - avg;
    if (diff > DRIFT.weightGain) {
      alerts.push({ type: 'warning', icon: '⚖️', title: 'Weight Increase Detected', text: 'Your weight is +' + diff.toFixed(1) + ' kg above your 7-day average (' + avg.toFixed(1) + ' kg). Consider reviewing your calorie intake.' });
    } else if (diff < -DRIFT.weightLoss) {
      alerts.push({ type: 'warning', icon: '⚖️', title: 'Rapid Weight Drop', text: 'Your weight dropped ' + Math.abs(diff).toFixed(1) + ' kg from your 7-day average. Ensure you\'re eating enough to meet your nutrition targets.' });
    } else {
      alerts.push({ type: 'good', icon: '✓', title: 'Weight Stable', text: 'Your weight is within ' + Math.abs(diff).toFixed(1) + ' kg of your 7-day average. Keep it up!' });
    }
  }

  if (today.sleep_hours != null) {
    if (today.sleep_hours < DRIFT.sleepMin) {
      alerts.push({ type: 'danger', icon: '😴', title: 'Sleep Deficit', text: 'You slept ' + today.sleep_hours + ' hours — below the recommended 6–8 hours. Poor sleep affects metabolism and increases cravings.' });
    } else if (today.sleep_hours >= 7) {
      alerts.push({ type: 'good', icon: '😴', title: 'Good Sleep Quality', text: today.sleep_hours + ' hours of sleep supports healthy hormone levels and better food choices throughout the day.' });
    }
  }

  if (today.water_ml != null && today.water_ml < DRIFT.waterMin) {
    alerts.push({ type: 'warning', icon: '💧', title: 'Low Hydration', text: 'You\'ve logged ' + (today.water_ml / 1000).toFixed(1) + ' L — below the 1.8 L minimum. Dehydration can suppress appetite signals and reduce energy.' });
  }

  if (today.calories_burned != null && profile) {
    const tdee = computeTDEE(profile);
    const pct = today.calories_burned / tdee;
    if (pct < DRIFT.calLowPct) {
      alerts.push({ type: 'warning', icon: '🔥', title: 'Low Activity Today', text: 'You burned ' + today.calories_burned + ' kcal — ' + Math.round(pct * 100) + '% of your daily TDEE. Try adding a short walk or light exercise.' });
    } else {
      alerts.push({ type: 'good', icon: '🔥', title: 'Active Day', text: 'Great effort — ' + today.calories_burned + ' kcal burned, which is ' + Math.round(pct * 100) + '% of your daily energy expenditure.' });
    }
  }

  return alerts;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}