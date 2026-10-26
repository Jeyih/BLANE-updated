import { computeDailyTargets } from '../../supabase/functions/_shared/nutrition.js';
import { parseHealthLog } from '../lib/health-log-inputs.js';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createHealthLogSaver } from '../lib/health-log-save';
import { philippineClock } from '../lib/meal-experience';
import '../styles/feedback.css';
const DRIFT = { weightGain: 0.5, weightLoss: 1.5, sleepMin: 6, waterMin: 1800, calLowPct: 0.75 };
const saveHealthLog = createHealthLogSaver(supabase);
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
  const [logsError, setLogsError] = useState('');
  const savingRef = useRef(false);
  useEffect(() => {
    loadRecentLogs();
  }, [profile]);
  async function loadRecentLogs() {
    if (!profile?.id) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data, error } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', profile.id)
      .gte('logged_at', philippineClock(sevenDaysAgo).dateKey)
      .order('logged_at', { ascending: false })
      .abortSignal(AbortSignal.timeout(15000));
    if (error) { setLogsError('Health history could not be refreshed. Check your connection and retry.'); return false; }
    setLogsError('');
    if (data) {
      setLogs(data);
      const todayStr = philippineClock().dateKey;
      const isLogged = data.some((l) => l.logged_at === todayStr);
      setTodayLogged(isLogged);
      const todayLog2 = data.find((l) => l.logged_at === todayStr);
      if (todayLog2) {
        setWeight(todayLog2.weight_kg ?? '');
        setSleep(todayLog2.sleep_hours ?? '');
        setWaterCups(todayLog2.water_ml == null ? '' : todayLog2.water_ml / 300);
        setCalories(todayLog2.calories_burned ?? '');
      }
      if (data.length >= 2) setAlerts(detectDrift(data, profile));
      onLogsChange?.(data);
    }
    return true;
  }
  const yesterday = logs.find((l) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return l.logged_at === philippineClock(d).dateKey;
  });
  async function handleLogSubmit() {
    if (savingRef.current) return;
    let values;
    try { values = parseHealthLog({ weight, sleep, waterCups, calories }); }
    catch (error) { showToast(error.message, true); return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const updatedProfile = await saveHealthLog(profile, values);
      if (updatedProfile !== profile) onProfileUpdate?.(updatedProfile);
      const historyLoaded = await loadRecentLogs();
      const targets = recalculateTargets(updatedProfile);
      setRecalcBanner(targets);
      setTimeout(() => setRecalcBanner(null), 6000);
      showToast(historyLoaded ? '\u2713 Health data logged and targets updated' : 'Health data saved. Health history could not be refreshed.', !historyLoaded);
    } catch (error) {
      showToast(error.message || 'Could not confirm the save. Check your connection and retry.', true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  function showToast(msg, isError) {
    setToast({ msg, isError });
    if (!isError) setTimeout(() => setToast(null), 3500);
  }
  const metrics = [
    { key: 'weight_kg', label: 'Weight', icon: '\u2696\uFE0F' },
    { key: 'sleep_hours', label: 'Sleep', icon: '\u{1F634}' },
    { key: 'water_ml', label: 'Water', icon: '\u{1F4A7}' },
    { key: 'calories_burned', label: 'Activity', icon: '\u{1F525}' },
  ];
  const todayLog = logs.find((l) => l.logged_at === philippineClock().dateKey);
  return React.createElement(
    'div',
    { className: 'fb-widget col-12', 'data-dashboard-tour': 'feedback' },
    logsError && React.createElement('p', { role: 'alert' }, logsError),
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
        React.createElement('label', { className: 'fb-metric-label', htmlFor: 'health-weight' }, '\u2696\uFE0F Weight (kg)'),
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
            id: 'health-weight',
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
        React.createElement('label', { className: 'fb-metric-label', htmlFor: 'health-sleep' }, '\u{1F634} Sleep (hours)'),
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
            id: 'health-sleep',
            onChange: (e) => setSleep(e.target.value),
          }),
          React.createElement('span', { className: 'fb-metric-unit' }, 'hrs'),
        ),
      ),
      React.createElement(
        'div',
        { className: 'fb-metric-card' },
        React.createElement('label', { className: 'fb-metric-label', htmlFor: 'health-water' }, '\u{1F4A7} Water (cups)'),
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
            id: 'health-water',
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
        React.createElement('label', { className: 'fb-metric-label', htmlFor: 'health-calories' }, '\u{1F525} Calories Burned (kcal)'),
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
            id: 'health-calories',
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
      { className: 'fb-log-btn', onClick: handleLogSubmit, disabled: saving, 'aria-busy': saving },
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
          role: toast.isError ? 'alert' : 'status',
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
            maxWidth: 'calc(100vw - 32px)',
            whiteSpace: 'normal',
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
  const result = computeDailyTargets(profile);
  return { ...result, tdee: Math.round(result.tdee), target: result.calories };
}
function computeTDEE(profile) {
  return Math.round(computeDailyTargets(profile).tdee);
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
