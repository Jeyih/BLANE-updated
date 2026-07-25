/* ============================================================
   BLANE — Health Drift Detection (Module 02)
   Replaces: js/drift.js entirely + the #drift-section markup
   block from dashboard.html.

   Analyzes 7-day health_logs (passed down as a prop from
   FeedbackWidget via Dashboard) using linear regression to
   score weight/sleep/hydration/BMI trends.
   ============================================================ */
import { useMemo } from 'react';
import '../styles/drift.css';

const WEIGHTS = { weight: 0.30, sleep: 0.25, hydration: 0.20, bmi: 0.25 };

export default function DriftWidget({ logs, profile }) {
  const analysis = useMemo(() => {
    if (!logs || logs.length < 2) return null;
    return analyzeDrift(logs, profile);
  }, [logs, profile]);

  if (!analysis) {
    return (
      <div className="drift-section col-12">
        <Header />
        <div className="drift-no-data">
          <span className="drift-no-data-icon">📋</span>
          <p>No health data logged yet.<br />
            Use the <strong>Body Feedback Loop</strong> widget above to start logging your daily metrics.<br />
            Drift analysis will appear after <strong>2+ days</strong> of data.</p>
        </div>
      </div>
    );
  }

  const healthScore = computeHealthScore(analysis);
  const scoreColor   = getScoreColor(healthScore);
  const scoreStatus  = getScoreStatus(healthScore);
  const scoreDesc    = getScoreDesc(healthScore);
  const circumf = 2 * Math.PI * 28;
  const arcFill = healthScore != null ? (healthScore / 100) * circumf : 0;

  return (
    <div className="drift-section col-12">
      <Header />

      <div className="drift-score-row">
        <div className="drift-score-circle-wrap">
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#111f16" strokeWidth="7" />
            <circle cx="36" cy="36" r="28" fill="none" stroke={scoreColor} strokeWidth="7"
              strokeDasharray={arcFill.toFixed(1) + ' ' + circumf.toFixed(1)} strokeLinecap="round"
              transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray 1s ease' }} />
          </svg>
          <div className="drift-score-center">
            <div className="drift-score-num" style={{ color: scoreColor }}>{healthScore ?? '--'}</div>
            <div className="drift-score-label-sm">/ 100</div>
          </div>
        </div>
        <div className="drift-score-info">
          <div className="drift-score-status" style={{ color: scoreColor }}>{scoreStatus}</div>
          <div className="drift-score-desc">{scoreDesc}</div>
        </div>
        <div className="drift-score-bar-wrap">
          <div className="drift-score-bar-label">
            <span>Health Score</span><span style={{ color: scoreColor }}>{healthScore ?? '--'}/100</span>
          </div>
          <div className="drift-score-bar-bg">
            <div className="drift-score-bar-fill" style={{ width: (healthScore || 0) + '%', background: scoreColor }} />
          </div>
        </div>
      </div>

      <div className="drift-cards-grid">
        <DriftCard metric={analysis.weight}    emoji="⚖️" label="Weight"    unit="kg"
          chartValues={analysis.rawLogs.map((l) => l.weight_kg)} />
        <DriftCard metric={analysis.sleep}     emoji="😴" label="Sleep"     unit="hrs"
          chartValues={analysis.rawLogs.map((l) => l.sleep_hours)} />
        <DriftCard metric={analysis.hydration} emoji="💧" label="Hydration" unit="L"
          chartValues={analysis.rawLogs.map((l) => (l.water_ml ? l.water_ml / 1000 : null))} isLiters />
        <DriftCard metric={analysis.bmi}       emoji="📊" label="BMI"       unit=""
          chartValues={analysis.bmi.values} isBmi />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="drift-header">
      <div className="drift-header-left">
        <div className="drift-icon-wrap">📈</div>
        <div>
          <div className="drift-title">Health Drift Detection</div>
          <div className="drift-sub">7-day trend analysis · Auto-updated when you log health data</div>
        </div>
      </div>
      <span className="drift-range-badge">Last 7 days</span>
    </div>
  );
}

function DriftCard({ metric, emoji, label, unit, chartValues, isLiters, isBmi }) {
  if (!metric || metric.score == null) {
    return (
      <div className="drift-card status-neutral">
        <div className="drift-card-header">
          <div className="drift-card-icon-label"><span className="drift-card-emoji">{emoji}</span><span className="drift-card-name">{label}</span></div>
        </div>
        <div className="drift-card-value" style={{ color: '#4d6e5a' }}>--</div>
        <div className="drift-card-context">No data logged yet</div>
        <span className="drift-risk-label neutral">No data</span>
      </div>
    );
  }

  const displayVal = isLiters ? (metric.latest / 1000).toFixed(1)
    : isBmi ? metric.latest.toFixed(1)
    : metric.latest;

  const arrow = getTrendArrow(metric.trend);
  const riskText = getRiskText(metric.key, metric.riskLevel);
  const color = getChartColor(metric.riskLevel);

  return (
    <div className={'drift-card status-' + metric.riskLevel}>
      <div className="drift-card-header">
        <div className="drift-card-icon-label"><span className="drift-card-emoji">{emoji}</span><span className="drift-card-name">{label}</span></div>
        <span className={'drift-trend-badge ' + metric.trendBadge}>{arrow} {capitalize(metric.trend)}</span>
      </div>
      <div className="drift-card-value">{displayVal}<span className="drift-card-value-unit"> {unit}</span></div>
      <div className="drift-card-context">{metric.contextText || ''}</div>
      <div className="drift-chart-wrap">
        <MiniChart values={chartValues} color={color} />
      </div>
      <span className={'drift-risk-label ' + metric.riskLevel}>{riskText}</span>
    </div>
  );
}

/* ---- Mini SVG chart with area gradient + regression line ---- */
function MiniChart({ values, color }) {
  const valid = values.filter((v) => v != null);
  if (valid.length < 2) {
    return (
      <svg className="drift-mini-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
        <text x="0" y="24" fill="#4d6e5a" fontSize="7" fontFamily="DM Sans,sans-serif">Logging data…</text>
      </svg>
    );
  }

  const W = 100, H = 40, pad = 4;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const rng = (max - min) || 1;
  const step = W / (values.length - 1);

  const pts = [];
  values.forEach((v, i) => {
    if (v == null) return;
    pts.push({ x: i * step, y: H - pad - ((v - min) / rng) * (H - pad * 2) });
  });

  const polyline = pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaPath = 'M ' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L ') +
    ' L ' + pts[pts.length - 1].x.toFixed(1) + ' ' + H + ' L ' + pts[0].x.toFixed(1) + ' ' + H + ' Z';

  const slope = linearRegressionSlope(valid);
  const avgVal = valid.reduce((s, v) => s + v, 0) / valid.length;
  const y0 = clamp(H - pad - ((avgVal - slope * valid.length / 2 - min) / rng) * (H - pad * 2), pad, H - pad);
  const y1 = clamp(H - pad - ((avgVal + slope * valid.length / 2 - min) / rng) * (H - pad * 2), pad, H - pad);
  const last = pts[pts.length - 1];
  const gradId = 'grad-' + Math.random().toString(36).slice(2, 9);

  return (
    <svg className="drift-mini-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={'url(#' + gradId + ')'} />
      <line x1="0" y1={y0.toFixed(1)} x2={W} y2={y1.toFixed(1)} stroke={color} strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="3" fill={color} stroke="#060d0a" strokeWidth="1.5" />
    </svg>
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ============================================================
   ANALYSIS ENGINE (ported unchanged from drift.js)
   ============================================================ */
function analyzeDrift(logs, profile) {
  const sorted = logs.slice().sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));
  const weightVals = sorted.map((l) => l.weight_kg);
  const sleepVals   = sorted.map((l) => l.sleep_hours);
  const waterVals   = sorted.map((l) => l.water_ml);
  const h = parseFloat(profile.height_cm) || 170;
  const bmiVals = weightVals.map((w) => (w ? parseFloat((w / ((h / 100) * (h / 100))).toFixed(2)) : null));

  return {
    weight: analyzeMetric('weight', weightVals, profile),
    sleep: analyzeMetric('sleep', sleepVals, profile),
    hydration: analyzeMetric('hydration', waterVals, profile),
    bmi: analyzeMetric('bmi', bmiVals, profile),
    rawLogs: sorted,
  };
}

function analyzeMetric(key, values, profile) {
  const valid = values.filter((v) => v != null);
  if (valid.length === 0) return { score: null, trend: 'no_data', values };

  const latest = valid[valid.length - 1];
  const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
  const slope = linearRegressionSlope(values);
  const stdDev = standardDeviation(valid);
  const cvPct = avg > 0 ? (stdDev / avg) * 100 : 0;

  let trend, score, riskLevel, contextText, trendBadge;

  if (key === 'weight') {
    const goal = profile.goal || 'maintain';
    const weekChange = slope * valid.length;
    if (Math.abs(slope) < 0.05) { trend = 'stable'; trendBadge = 'stable'; }
    else if (slope > 0) { trend = 'gaining'; trendBadge = goal === 'gain_muscle' ? 'up-good' : 'up-bad'; }
    else { trend = 'losing'; trendBadge = goal === 'lose_weight' ? 'down-good' : 'down-bad'; }

    if (goal === 'lose_weight') score = slope < -0.02 ? 90 : slope > 0.1 ? 40 : 70;
    else if (goal === 'gain_muscle') score = slope > 0.02 ? 90 : slope < -0.1 ? 40 : 70;
    else score = Math.abs(slope) < 0.05 ? 92 : 65;

    riskLevel = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'danger';
    contextText = (weekChange >= 0 ? '+' : '−') + Math.abs(weekChange).toFixed(1) + ' kg trend this week';
  } else if (key === 'sleep') {
    if (cvPct > 30) { trend = 'irregular'; trendBadge = 'irregular'; }
    else if (slope > 0.1) { trend = 'improving'; trendBadge = 'up-good'; }
    else if (slope < -0.1) { trend = 'declining'; trendBadge = 'down-bad'; }
    else { trend = 'stable'; trendBadge = 'stable'; }

    if (avg >= 7 && avg <= 9) score = 95;
    else if (avg >= 6) score = 72;
    else if (avg >= 5) score = 50;
    else score = 30;
    if (cvPct > 30) score = Math.max(score - 20, 20);

    riskLevel = score >= 80 ? 'good' : score >= 55 ? 'warning' : 'danger';
    contextText = 'Avg ' + avg.toFixed(1) + ' hrs · ' + (cvPct > 30 ? 'High variability' : 'Consistent');
  } else if (key === 'hydration') {
    const avgL = avg / 1000;
    if (slope > 50) { trend = 'improving'; trendBadge = 'up-good'; }
    else if (slope < -50) { trend = 'declining'; trendBadge = 'down-bad'; }
    else { trend = 'stable'; trendBadge = 'stable'; }

    if (avg >= 2400) score = 95;
    else if (avg >= 1800) score = 75;
    else if (avg >= 1200) score = 50;
    else score = 30;

    riskLevel = score >= 80 ? 'good' : score >= 55 ? 'warning' : 'danger';
    contextText = 'Avg ' + avgL.toFixed(1) + ' L/day';
  } else if (key === 'bmi') {
    const weekChange = slope * valid.length;
    if (Math.abs(slope) < 0.01) { trend = 'stable'; trendBadge = 'stable'; }
    else if (slope > 0) { trend = 'rising'; trendBadge = latest > 25 ? 'up-bad' : 'stable'; }
    else { trend = 'falling'; trendBadge = latest < 18.5 ? 'down-bad' : 'down-good'; }

    if (latest >= 18.5 && latest < 25) score = 95;
    else if (latest >= 17 && latest < 18.5) score = 68;
    else if (latest >= 25 && latest < 27) score = 68;
    else if (latest >= 27 && latest < 30) score = 50;
    else score = 35;

    riskLevel = score >= 80 ? 'good' : score >= 55 ? 'warning' : 'danger';
    contextText = 'Δ ' + (weekChange >= 0 ? '+' : '') + weekChange.toFixed(2) + ' this week';
  }

  return { key, values, valid, latest, avg, slope, trend, trendBadge, score, riskLevel, contextText };
}

function computeHealthScore(analysis) {
  let totalWeight = 0, weightedSum = 0;
  Object.keys(WEIGHTS).forEach((key) => {
    const m = analysis[key];
    if (m?.score != null) { weightedSum += m.score * WEIGHTS[key]; totalWeight += WEIGHTS[key]; }
  });
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

function linearRegressionSlope(values) {
  const valid = values.filter((v) => v != null);
  const n = valid.length;
  if (n < 2) return 0;
  const xs = valid.map((_, i) => i);
  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = valid.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * valid[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

function standardDeviation(values) {
  const n = values.length;
  if (n < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / n;
  const sq = values.map((v) => (v - avg) ** 2);
  return Math.sqrt(sq.reduce((s, v) => s + v, 0) / n);
}

function getScoreColor(score) {
  if (score == null) return '#4d6e5a';
  if (score >= 80) return '#2ddc7a';
  if (score >= 55) return '#fbbf24';
  return '#f87171';
}

function getScoreStatus(score) {
  if (score == null) return 'Insufficient Data';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Needs Attention';
  return 'At Risk';
}

function getScoreDesc(score) {
  if (score == null) return 'Log more health data to generate your score.';
  if (score >= 85) return 'Your health metrics are trending positively. Keep up the great habits!';
  if (score >= 70) return 'Most metrics are on track. Minor improvements could boost your score.';
  if (score >= 55) return 'Some metrics need attention. Review the drift cards below for details.';
  if (score >= 40) return 'Several metrics are showing unfavorable trends. Consider adjusting your routine.';
  return 'Multiple risk signals detected. Review each metric and consult a health professional if needed.';
}

function getTrendArrow(trend) {
  const map = { gaining: '↑', losing: '↓', stable: '→', improving: '↑', declining: '↓', irregular: '~', rising: '↑', falling: '↓', no_data: '?' };
  return map[trend] || '→';
}

function getRiskText(key, level) {
  const texts = {
    weight: { good: 'On Track', warning: 'Monitor Closely', danger: 'Health Risk' },
    sleep: { good: 'Well Rested', warning: 'Sleep Deficit', danger: 'Critical Deficit' },
    hydration: { good: 'Well Hydrated', warning: 'Low Hydration', danger: 'Dehydration Risk' },
    bmi: { good: 'Healthy Range', warning: 'Borderline', danger: 'Outside Range' },
  };
  return texts[key]?.[level] || 'N/A';
}

function getChartColor(level) {
  if (level === 'good') return '#2ddc7a';
  if (level === 'warning') return '#fbbf24';
  if (level === 'danger') return '#f87171';
  return '#4d6e5a';
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }