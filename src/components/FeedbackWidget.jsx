import React from 'react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/feedback.css';
const ACTIVITY_MULT = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};
const GOAL_ADJUST = {
  lose_weight: 0.85,
  gain_muscle: 1.1,
  maintain: 1,
  improve_health: 1,
  boost_energy: 1,
  manage_condition: 1,
};
const DRIFT = { weightGain: 0.5, weightLoss: 1.5, sleepMin: 6, waterMin: 1800, calLowPct: 0.75 };
function FeedbackWidget({ profile, onProfileUpdate, onLogsChange }) {
  const [logs, setLogs] = useState([]);
  const [todayLogged, setTodayLogged] = useState(false);
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [waterCups, setWaterCups] = useState('');
  const [calories, setCalories] = useState('');
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [recalcBanner, setRecalcBanner] = useState(null);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    loadRecentLogs();
  }, [profile]);
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
      const todayLog2 = data.find((l) => l.logged_at === todayStr);
      if (todayLog2) {
        if (todayLog2.weight_kg) setWeight(todayLog2.weight_kg);
        if (todayLog2.sleep_hours) setSleep(todayLog2.sleep_hours);
        if (todayLog2.water_ml) setWaterCups(Math.round(todayLog2.water_ml / 300));
        if (todayLog2.calories_burned) setCalories(todayLog2.calories_burned);
      }
      if (data.length >= 2) setAlerts(detectDrift(data, profile));
      onLogsChange?.(data);
    }
  }
  const yesterday = logs.find((l) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return l.logged_at === d.toISOString().split('T')[0];
  });
  async function handleLogSubmit() {
    const w = parseFloat(weight) || null;
    const s = parseFloat(sleep) || null;
    const wc = parseInt(waterCups) || null;
    const c = parseInt(calories) || null;
    if (!w && !s && !wc && !c) {
      showToast('Please fill in at least one metric.', true);
      return;
    }
    setSaving(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('health_logs')
      .upsert(
        {
          user_id: profile.id,
          logged_at: todayStr,
          weight_kg: w,
          sleep_hours: s,
          water_ml: wc ? wc * 300 : null,
          calories_burned: c,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,logged_at' },
      );
    if (error) {
      showToast('Could not save: ' + error.message, true);
      setSaving(false);
      return;
    }
    let updatedProfile = profile;
    if (w && w !== profile.weight_kg) {
      await supabase
        .from('profiles')
        .upsert({ id: profile.id, weight_kg: w, updated_at: new Date().toISOString() });
      updatedProfile = { ...profile, weight_kg: w };
      onProfileUpdate?.(updatedProfile);
    }
    await loadRecentLogs();
    const targets = recalculateTargets(updatedProfile);
    setRecalcBanner(targets);
    setTimeout(() => setRecalcBanner(null), 6e3);
    setSaving(false);
    showToast('\u2713 Health data logged and targets updated');
  }
  function showToast(msg, isError) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }
  const metrics = [
    { key: 'weight_kg', label: 'Weight', icon: '\u2696\uFE0F' },
    { key: 'sleep_hours', label: 'Sleep', icon: '\u{1F634}' },
    { key: 'water_ml', label: 'Water', icon: '\u{1F4A7}' },
    { key: 'calories_burned', label: 'Activity', icon: '\u{1F525}' },
  ];
  const todayLog = logs.find((l) => l.logged_at === new Date().toISOString().split('T')[0]);
  return React.createElement(
    'div',
    { className: 'fb-widget col-12', 'data-dashboard-tour': 'feedback' },
    React.createElement(
      'div',
      { className: 'fb-widget-header' },
      React.createElement(
        'div',
        { className: 'fb-widget-title-row' },
        React.createElement('div', { className: 'fb-widget-icon' }, '\u{1F504}'),
        React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { className: 'fb-widget-title' },
            'Real-Time Body Feedback Loop',
          ),
          React.createElement(
            'div',
            { className: 'fb-widget-sub' },
            "Log today's health data \u2014 targets recalculate automatically",
          ),
        ),
      ),
      React.createElement(
        'span',
        { className: 'fb-last-logged' + (todayLogged ? ' today' : '') },
        todayLogged
          ? '\u2713 Logged today'
          : logs.length > 0
            ? 'Last: ' + formatDate(logs[0].logged_at)
            : 'Not logged yet',
      ),
    ),
    React.createElement(
      'div',
      { className: 'fb-today-status' },
      metrics.map((m) => {
        const logged = todayLog && todayLog[m.key] != null;
        return React.createElement(
          'div',
          { key: m.key, className: 'fb-status-chip' + (logged ? ' logged' : ' pending') },
          (logged ? '\u2713 ' : '\u25CB ') + m.label,
        );
      }),
    ),
    React.createElement(
      'div',
      { className: 'fb-metric-grid' },
      React.createElement(
        'div',
        { className: 'fb-metric-card' },
        React.createElement('div', { className: 'fb-metric-label' }, '\u2696\uFE0F Weight'),
        React.createElement(
          'div',
          { className: 'fb-metric-input-row' },
          React.createElement('input', {
            className: 'fb-metric-input',
            type: 'number',
            placeholder: '--',
            min: '20',
            max: '300',
            step: '0.1',
            value: weight,
            onChange: (e) => setWeight(e.target.value),
          }),
          React.createElement('span', { className: 'fb-metric-unit' }, 'kg'),
        ),
        React.createElement(
          'div',
          { className: 'fb-metric-prev' },
          yesterday?.weight_kg ? 'Yesterday: ' + yesterday.weight_kg + ' kg' : '',
        ),
      ),
      React.createElement(
        'div',
        { className: 'fb-metric-card' },
        React.createElement('div', { className: 'fb-metric-label' }, '\u{1F634} Sleep'),
        React.createElement(
          'div',
          { className: 'fb-metric-input-row' },
          React.createElement('input', {
            className: 'fb-metric-input',
            type: 'number',
            placeholder: '--',
            min: '0',
            max: '24',
            step: '0.5',
            value: sleep,
            onChange: (e) => setSleep(e.target.value),
          }),
          React.createElement('span', { className: 'fb-metric-unit' }, 'hrs'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'fb-metric-card' },
        React.createElement('div', { className: 'fb-metric-label' }, '\u{1F4A7} Water'),
        React.createElement(
          'div',
          { className: 'fb-metric-input-row' },
          React.createElement('input', {
            className: 'fb-metric-input',
            type: 'number',
            placeholder: '--',
            min: '0',
            max: '20',
            step: '1',
            value: waterCups,
            onChange: (e) => setWaterCups(e.target.value),
          }),
          React.createElement('span', { className: 'fb-metric-unit' }, 'cups'),
        ),
        React.createElement(
          'div',
          {
            className: 'fb-metric-prev',
            style: { fontSize: '11px', color: '#4d6e5a', marginTop: '5px' },
          },
          '1 cup = 300 ml',
        ),
      ),
      React.createElement(
        'div',
        { className: 'fb-metric-card' },
        React.createElement('div', { className: 'fb-metric-label' }, '\u{1F525} Calories Burned'),
        React.createElement(
          'div',
          { className: 'fb-metric-input-row' },
          React.createElement('input', {
            className: 'fb-metric-input',
            type: 'number',
            placeholder: '--',
            min: '0',
            max: '5000',
            step: '10',
            value: calories,
            onChange: (e) => setCalories(e.target.value),
          }),
          React.createElement('span', { className: 'fb-metric-unit' }, 'kcal'),
        ),
        React.createElement(
          'div',
          { className: 'fb-metric-prev' },
          yesterday?.calories_burned ? 'Yesterday: ' + yesterday.calories_burned + ' kcal' : '',
        ),
      ),
    ),
    React.createElement(
      'button',
      { className: 'fb-log-btn', onClick: handleLogSubmit, disabled: saving },
      React.createElement(
        'svg',
        {
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: '2.5',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        React.createElement('polyline', { points: '20 6 9 17 4 12' }),
      ),
      saving ? 'Saving...' : todayLogged ? "Update Today's Log" : "Log Today's Health",
    ),
    recalcBanner &&
      React.createElement(
        'div',
        { className: 'fb-recalc-banner show' },
        React.createElement('span', { className: 'fb-recalc-icon' }, '\u26A1'),
        React.createElement(
          'div',
          { className: 'fb-recalc-text' },
          'Targets updated \u2014 Daily goal: ',
          React.createElement('strong', null, recalcBanner.target.toLocaleString(), ' kcal'),
          ' \xA0\xB7\xA0',
          React.createElement('strong', null, ' ', recalcBanner.protein, 'g'),
          ' protein \xA0\xB7\xA0',
          React.createElement('strong', null, ' ', recalcBanner.carbs, 'g'),
          ' carbs \xA0\xB7\xA0',
          React.createElement('strong', null, ' ', recalcBanner.fats, 'g'),
          ' fats',
        ),
      ),
    React.createElement(
      'div',
      { className: 'fb-drift-panel' },
      alerts.map((a, i) =>
        React.createElement(
          'div',
          { key: i, className: 'fb-drift-alert ' + a.type },
          React.createElement('span', { className: 'fb-drift-icon' }, a.icon),
          React.createElement(
            'div',
            { className: 'fb-drift-text' },
            React.createElement('strong', null, a.title),
            a.text,
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'fb-history-row' },
      React.createElement(Sparkline, {
        label: 'Weight (7d)',
        values: logs.map((l) => l.weight_kg).reverse(),
        color: '#2ddc7a',
      }),
      React.createElement(Sparkline, {
        label: 'Sleep (7d)',
        values: logs.map((l) => l.sleep_hours).reverse(),
        color: '#60a5fa',
      }),
      React.createElement(Sparkline, {
        label: 'Activity (7d)',
        values: logs.map((l) => l.calories_burned).reverse(),
        color: '#fbbf24',
      }),
    ),
    toast &&
      React.createElement(
        'div',
        {
          style: {
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0d1a12',
            border:
              '1px solid ' + (toast.isError ? 'rgba(248,113,113,0.35)' : 'rgba(45,220,122,0.35)'),
            borderRadius: 12,
            padding: '12px 22px',
            fontSize: 14,
            color: toast.isError ? '#f87171' : '#2ddc7a',
            zIndex: 999,
            whiteSpace: 'nowrap',
          },
        },
        toast.msg,
      ),
  );
}
function Sparkline({ label, values, color }) {
  const valid = values.filter((v) => v != null);
  const W = 120,
    H = 32;
  let content;
  let isEmpty = valid.length < 2;
  if (isEmpty) {
    content = React.createElement(
      'text',
      {
        x: '60',
        y: '20',
        fill: '#4d6e5a',
        fontSize: '9',
        fontFamily: 'DM Sans,sans-serif',
        textAnchor: 'middle',
      },
      'Not enough data yet',
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
    content = React.createElement(
      React.Fragment,
      null,
      React.createElement('polyline', {
        points: pts.map((p) => p.x + ',' + p.y).join(' '),
        fill: 'none',
        stroke: color,
        strokeWidth: '1.5',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        opacity: '0.8',
      }),
      React.createElement('circle', { cx: last.x, cy: last.y, r: '3', fill: color }),
    );
  }
  return React.createElement(
    'div',
    { className: 'fb-sparkline-wrap' },
    React.createElement('div', { className: 'fb-sparkline-label' }, label),
    React.createElement(
      'svg',
      {
        className: 'fb-sparkline-svg',
        viewBox: '0 0 120 32',
        preserveAspectRatio: isEmpty ? 'xMidYMid meet' : 'none',
      },
      content,
    ),
  );
}
function recalculateTargets(profile) {
  const h = parseFloat(profile.height_cm) || 170;
  const w = parseFloat(profile.weight_kg) || 70;
  const age = parseInt(profile.age) || 25;
  const sex = profile.sex || 'male';
  const bmr = sex === 'male' ? 10 * w + 6.25 * h - 5 * age + 5 : 10 * w + 6.25 * h - 5 * age - 161;
  const tdee = Math.round(bmr * (ACTIVITY_MULT[profile.activity_level] || 1.55));
  const target = Math.round(tdee * (GOAL_ADJUST[profile.goal] || 1));
  return {
    tdee,
    target,
    protein: Math.round((target * 0.3) / 4),
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
      alerts.push({
        type: 'warning',
        icon: '\u2696\uFE0F',
        title: 'Weight Increase Detected',
        text:
          'Your weight is +' +
          diff.toFixed(1) +
          ' kg above your 7-day average (' +
          avg.toFixed(1) +
          ' kg). Consider reviewing your calorie intake.',
      });
    } else if (diff < -DRIFT.weightLoss) {
      alerts.push({
        type: 'warning',
        icon: '\u2696\uFE0F',
        title: 'Rapid Weight Drop',
        text:
          'Your weight dropped ' +
          Math.abs(diff).toFixed(1) +
          " kg from your 7-day average. Ensure you're eating enough to meet your nutrition targets.",
      });
    } else {
      alerts.push({
        type: 'good',
        icon: '\u2713',
        title: 'Weight Stable',
        text:
          'Your weight is within ' +
          Math.abs(diff).toFixed(1) +
          ' kg of your 7-day average. Keep it up!',
      });
    }
  }
  if (today.sleep_hours != null) {
    if (today.sleep_hours < DRIFT.sleepMin) {
      alerts.push({
        type: 'danger',
        icon: '\u{1F634}',
        title: 'Sleep Deficit',
        text:
          'You slept ' +
          today.sleep_hours +
          ' hours \u2014 below the recommended 6\u20138 hours. Poor sleep affects metabolism and increases cravings.',
      });
    } else if (today.sleep_hours >= 7) {
      alerts.push({
        type: 'good',
        icon: '\u{1F634}',
        title: 'Good Sleep Quality',
        text:
          today.sleep_hours +
          ' hours of sleep supports healthy hormone levels and better food choices throughout the day.',
      });
    }
  }
  if (today.water_ml != null && today.water_ml < DRIFT.waterMin) {
    alerts.push({
      type: 'warning',
      icon: '\u{1F4A7}',
      title: 'Low Hydration',
      text:
        "You've logged " +
        (today.water_ml / 1e3).toFixed(1) +
        ' L \u2014 below the 1.8 L minimum. Dehydration can suppress appetite signals and reduce energy.',
    });
  }
  if (today.calories_burned != null && profile) {
    const tdee = computeTDEE(profile);
    const pct = today.calories_burned / tdee;
    if (pct < DRIFT.calLowPct) {
      alerts.push({
        type: 'warning',
        icon: '\u{1F525}',
        title: 'Low Activity Today',
        text:
          'You burned ' +
          today.calories_burned +
          ' kcal \u2014 ' +
          Math.round(pct * 100) +
          '% of your daily TDEE. Try adding a short walk or light exercise.',
      });
    } else {
      alerts.push({
        type: 'good',
        icon: '\u{1F525}',
        title: 'Active Day',
        text:
          'Great effort \u2014 ' +
          today.calories_burned +
          ' kcal burned, which is ' +
          Math.round(pct * 100) +
          '% of your daily energy expenditure.',
      });
    }
  }
  return alerts;
}
function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}
export { FeedbackWidget as default };
