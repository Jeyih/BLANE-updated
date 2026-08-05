import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import '../styles/profile.css';

// Goal, dietary and medical option metadata are managed in the DB
// via the Admin panel. Load them at runtime and fall back to
// empty structures when unavailable.

const ACTIVITY_LABELS = {
  sedentary:    'Sedentary',
  light:        'Lightly Active',
  moderate:     'Moderately Active',
  very_active:  'Very Active',
  extra_active: 'Extra Active',
};

const ACTIVITY_MULT = {
  sedentary:    1.2,
  light:        1.375,
  moderate:     1.55,
  very_active:  1.725,
  extra_active: 1.9,
};

const EMPTY_PROFILE = {
  full_name: '',
  age: '',
  sex: '',
  height_cm: '',
  weight_kg: '',
  activity_level: '',
  goal: '',
  dietary_restrictions: [],
  medical_conditions: [],
};

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [goalMeta, setGoalMeta] = useState({});
  const [allGoals, setAllGoals] = useState([]);
  const [dietaryOpts, setDietaryOpts] = useState([]);
  const [medicalOpts, setMedicalOpts] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [editingBasic, setEditingBasic] = useState(false);
  const [editingHealth, setEditingHealth] = useState(false);
  const [basicForm, setBasicForm] = useState({
    full_name: '',
    age: '',
    sex: '',
    height_cm: '',
    weight_kg: '',
    activity_level: '',
  });
  const [healthForm, setHealthForm] = useState({
    goal: '',
    dietary: [],
    medical: [],
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPwd: '', confirmPwd: '' });
  const [toast, setToast] = useState({ message: '', error: false, visible: false });
  const [basicSaving, setBasicSaving] = useState(false);
  const [healthSaving, setHealthSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const { data: goals, error: gErr } = await supabase.from('option_lists').select('*').eq('group', 'goals');
        if (!gErr && mounted && Array.isArray(goals)) {
          const meta = {};
          const keys = [];
          goals.filter((item) => item.active !== false).forEach((g) => { meta[g.key] = { icon: g.icon || '', label: g.label || g.key }; keys.push(g.key); });
          setGoalMeta(meta);
          setAllGoals(keys);
        }
      } catch (e) { console.warn('load goals failed', e); }
      try {
        const { data: dietary, error: dErr } = await supabase.from('option_lists').select('*').eq('group', 'dietary').order('sort_order');
        if (!dErr && mounted && Array.isArray(dietary)) setDietaryOpts(dietary.filter((item) => item.active !== false));
      } catch (e) { console.warn('load dietary failed', e); }
      try {
        const { data: medical, error: mErr } = await supabase.from('option_lists').select('*').eq('group', 'medical').order('sort_order');
        if (!mErr && mounted && Array.isArray(medical)) setMedicalOpts(medical.filter((item) => item.active !== false));
      } catch (e) { console.warn('load medical failed', e); }
    }
    loadOptions();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      console.error(error);
      showToast('Unable to load profile. Refresh the page.', true);
      setLoading(false);
      return;
    }

    const nextProfile = data || EMPTY_PROFILE;
    setProfile(nextProfile);
    setBasicForm({
      full_name: nextProfile.full_name || '',
      age: nextProfile.age || '',
      sex: nextProfile.sex || '',
      height_cm: nextProfile.height_cm || '',
      weight_kg: nextProfile.weight_kg || '',
      activity_level: nextProfile.activity_level || '',
    });
    setHealthForm({
      goal: nextProfile.goal || '',
      dietary: nextProfile.dietary_restrictions || [],
      medical: nextProfile.medical_conditions || [],
    });
    setLoading(false);
  }

  function showToast(message, error = false) {
    setToast({ message, error, visible: true });
  }

  const displayName = useMemo(() => {
    if (profile.full_name) return profile.full_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Guest';
  }, [profile.full_name, user?.email]);

  const avatarInitial = displayName.charAt(0).toUpperCase() || '?';

  const joinedDate = useMemo(() => {
    if (!user?.created_at) return 'Joined —';
    const created = new Date(user.created_at);
    return 'Joined ' + created.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  }, [user?.created_at]);

  const accountJoined = useMemo(() => {
    if (!user?.created_at) return '—';
    const created = new Date(user.created_at);
    return created.toLocaleDateString('en-PH', { dateStyle: 'long' });
  }, [user?.created_at]);

  const stats = useMemo(() => {
    const height = parseFloat(profile.height_cm) || 0;
    const weight = parseFloat(profile.weight_kg) || 0;
    const age = parseInt(profile.age, 10) || 0;
    const sex = profile.sex || 'male';
    let bmi = null;
    let bmiCategory = 'Fill in profile';
    let bmiColor = '#2ddc7a';
    let caloriesLabel = 'Complete your profile';
    let calorieTarget = null;
    let calorieTdee = null;

    if (height && weight) {
      bmi = weight / ((height / 100) * (height / 100));
      const bmiFixed = parseFloat(bmi.toFixed(1));
      if (bmi < 18.5) { bmiCategory = 'Underweight'; bmiColor = '#60a5fa'; }
      else if (bmi < 25) { bmiCategory = 'Normal'; bmiColor = '#2ddc7a'; }
      else if (bmi < 30) { bmiCategory = 'Overweight'; bmiColor = '#fbbf24'; }
      else { bmiCategory = 'Obese'; bmiColor = '#f87171'; }
      const bmr = sex === 'female'
        ? 10 * weight + 6.25 * height - 5 * age - 161
        : 10 * weight + 6.25 * height - 5 * age + 5;
      const multiplier = ACTIVITY_MULT[profile.activity_level] || 1.55;
      calorieTdee = Math.round(bmr * multiplier);
      calorieTarget = calorieTdee;
      const label = calorieTdee ? 'TDEE: ' + calorieTdee.toLocaleString() + ' kcal/day' : caloriesLabel;
      if (profile.goal === 'lose_weight') calorieTarget = Math.round(calorieTdee * 0.85);
      if (profile.goal === 'gain_muscle') calorieTarget = Math.round(calorieTdee * 1.1);
      const bmiMarkerPct = Math.min(Math.max((bmi - 10) / 30, 0), 1) * 100;
      return {
        bmiValue: bmiFixed,
        bmiCategory,
        bmiColor,
        calorieTarget,
        calorieLabel: label,
        caloriePct: calorieTarget ? Math.min(Math.round((calorieTarget / 3000) * 100), 100) : 0,
        bmiMarkerPct,
      };
    }

    return {
      bmiValue: '--',
      bmiCategory,
      bmiColor: '#2ddc7a',
      calorieTarget: null,
      calorieLabel: caloriesLabel,
      caloriePct: 0,
      bmiMarkerPct: 0,
    };
  }, [profile.height_cm, profile.weight_kg, profile.age, profile.sex, profile.activity_level, profile.goal]);

  const progress = useMemo(() => {
    if (!user?.created_at) return { days: '--', label: '—', pct: 0 };
    const created = new Date(user.created_at);
    const today = new Date();
    const days = Math.max(1, Math.floor((today - created) / (1000 * 60 * 60 * 24)));
    const weeks = Math.floor(days / 7);
    return {
      days,
      label: weeks > 0 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'} on BLANE` : 'Started today!',
      pct: Math.min(Math.round((days / 90) * 100), 100),
    };
  }, [user?.created_at]);

  function toggleTab(tab) {
    setActiveTab(tab);
    setEditingBasic(false);
    setEditingHealth(false);
  }

  function openBasicEdit() {
    setBasicForm({
      full_name: profile.full_name || '',
      age: profile.age || '',
      sex: profile.sex || '',
      height_cm: profile.height_cm || '',
      weight_kg: profile.weight_kg || '',
      activity_level: profile.activity_level || '',
    });
    setEditingBasic(true);
  }

  function closeBasicEdit() {
    setEditingBasic(false);
  }

  function openHealthEdit() {
    setHealthForm({
      goal: profile.goal || '',
      dietary: profile.dietary_restrictions || [],
      medical: profile.medical_conditions || [],
    });
    setEditingHealth(true);
  }

  function closeHealthEdit() {
    setEditingHealth(false);
  }

  function updateBasicForm(key, value) {
    setBasicForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateHealthGoal(key) {
    setHealthForm((prev) => ({ ...prev, goal: key }));
  }

  function toggleHealthTag(field, value) {
    setHealthForm((prev) => {
      const next = prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value];
      return { ...prev, [field]: next };
    });
  }

  async function saveBasicInfo() {
    const name = basicForm.full_name.trim();
    const age = parseInt(basicForm.age, 10);
    const height = parseFloat(basicForm.height_cm);
    const weight = parseFloat(basicForm.weight_kg);

    if (!name) { showToast('Please enter your name.', true); return; }
    if (!age || age < 1) { showToast('Please enter a valid age.', true); return; }
    if (!height) { showToast('Please enter your height.', true); return; }
    if (!weight) { showToast('Please enter your weight.', true); return; }

    setBasicSaving(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: name,
      age,
      sex: basicForm.sex,
      height_cm: height,
      weight_kg: weight,
      activity_level: basicForm.activity_level,
      updated_at: new Date().toISOString(),
    });
    setBasicSaving(false);

    if (error) {
      showToast('Error: ' + error.message, true);
      return;
    }

    const updated = {
      ...profile,
      full_name: name,
      age,
      sex: basicForm.sex,
      height_cm: height,
      weight_kg: weight,
      activity_level: basicForm.activity_level,
    };
    setProfile(updated);
    setEditingBasic(false);
    showToast('✓ Basic info saved successfully');
  }

  async function saveHealthInfo() {
    if (!healthForm.goal) {
      showToast('Please choose a health goal.', true);
      return;
    }

    setHealthSaving(true);

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      goal: healthForm.goal,
      dietary_restrictions: healthForm.dietary,
      medical_conditions: healthForm.medical,
      updated_at: new Date().toISOString(),
    });

    setHealthSaving(false);

    if (error) {
      showToast('Error: ' + error.message, true);
      return;
    }

    setProfile((prev) => ({
      ...prev,
      goal: healthForm.goal,
      dietary_restrictions: healthForm.dietary,
      medical_conditions: healthForm.medical,
    }));
    setEditingHealth(false);
    showToast('✓ Health info saved successfully');
  }

  async function handlePasswordChange() {
    if (passwordForm.newPwd.length < 6) {
      showToast('Password must be at least 6 characters.', true);
      return;
    }
    if (passwordForm.newPwd !== passwordForm.confirmPwd) {
      showToast('Passwords do not match.', true);
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPwd });
    setPasswordSaving(false);

    if (error) {
      showToast('Error: ' + error.message, true);
      return;
    }

    setPasswordForm({ newPwd: '', confirmPwd: '' });
    setPasswordOpen(false);
    showToast('✓ Password updated successfully');
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="pf-main">
          <div className="pf-content">Loading profile...</div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="pf-body">
        <main className="pf-main">
          <div className="pf-content">
            <div className="pf-hero">
              <div className="pf-avatar" title="Profile picture">
                <span>{avatarInitial}</span>
                <div className="pf-avatar-edit">✎</div>
              </div>
              <div className="pf-hero-info">
                <div className="pf-hero-name">{displayName}</div>
                <div className="pf-hero-meta">
                  <span>{joinedDate}</span>
                  <span className="pf-hero-badge">
                    {goalMeta[profile.goal]?.icon || '—'} {goalMeta[profile.goal]?.label || '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pf-stats-row">
              <div className="pf-stat-card">
                <div className="pf-stat-icon">📊</div>
                <div className="pf-stat-label">BMI Index</div>
                <div className="pf-stat-value" style={{ color: stats.bmiColor }}>{stats.bmiValue}</div>
                <div className="pf-stat-sub">{stats.bmiCategory}</div>
                <div className="pf-bmi-scale">
                  <div className="pf-bmi-marker" style={{ left: `${stats.bmiMarkerPct}%` }} />
                </div>
              </div>

              <div className="pf-stat-card">
                <div className="pf-stat-icon">🔥</div>
                <div className="pf-stat-label">Daily Calorie Target</div>
                <div className="pf-stat-value yellow">{stats.calorieTarget ? stats.calorieTarget.toLocaleString() : '--'}</div>
                <div className="pf-stat-sub">{stats.calorieLabel}</div>
                <div className="pf-cal-bar-bg">
                  <div className="pf-cal-bar-fill" style={{ width: `${stats.caloriePct}%` }} />
                </div>
              </div>

              <div className="pf-stat-card">
                <div className="pf-stat-icon">🌱</div>
                <div className="pf-stat-label">Days on BLANE</div>
                <div className="pf-stat-value blue">{progress.days}</div>
                <div className="pf-stat-sub">{progress.label}</div>
                <div className="pf-progress-bar-bg">
                  <div className="pf-progress-bar-fill" style={{ width: `${progress.pct}%` }} />
                </div>
              </div>
            </div>

            <div className="pf-tabs">
              <button
                className={`pf-tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => toggleTab('basic')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Basic Info
              </button>
              <button
                className={`pf-tab-btn ${activeTab === 'health' ? 'active' : ''}`}
                onClick={() => toggleTab('health')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                Health
              </button>
              <button
                className={`pf-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => toggleTab('account')}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Account
              </button>
            </div>

            <div className={`pf-tab-panel ${activeTab === 'basic' ? 'active' : ''}`}>
              <div className="pf-section-card">
                <div className="pf-section-header">
                  <div className="pf-section-title-row">
                    <div className="pf-section-icon">👤</div>
                    <div>
                      <div className="pf-section-title">Basic Information</div>
                      <div className="pf-section-sub">Your personal details used to calculate nutrition targets</div>
                    </div>
                  </div>
                  <button className={`pf-edit-btn ${editingBasic ? 'editing' : ''}`} onClick={editingBasic ? closeBasicEdit : openBasicEdit}>
                    {editingBasic ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Cancel
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </>
                    )}
                  </button>
                </div>

                {!editingBasic && (
                  <div className="pf-form-grid">
                    <div className="pf-field">
                      <div className="pf-field-label">Full Name</div>
                      <div className={`pf-field-value${profile.full_name ? '' : ' muted'}`}>{profile.full_name || '—'}</div>
                    </div>
                    <div className="pf-field">
                      <div className="pf-field-label">Age</div>
                      <div className={`pf-field-value${profile.age ? '' : ' muted'}`}>{profile.age ? `${profile.age} years old` : '—'}</div>
                    </div>
                    <div className="pf-field">
                      <div className="pf-field-label">Biological Sex</div>
                      <div className={`pf-field-value${profile.sex ? '' : ' muted'}`}>{profile.sex ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1) : '—'}</div>
                    </div>
                    <div className="pf-field">
                      <div className="pf-field-label">Activity Level</div>
                      <div className={`pf-field-value${profile.activity_level ? '' : ' muted'}`}>{profile.activity_level ? ACTIVITY_LABELS[profile.activity_level] || profile.activity_level : '—'}</div>
                    </div>
                    <div className="pf-field">
                      <div className="pf-field-label">Height</div>
                      <div className={`pf-field-value${profile.height_cm ? '' : ' muted'}`}>{profile.height_cm ? `${profile.height_cm} cm` : '—'}</div>
                    </div>
                    <div className="pf-field">
                      <div className="pf-field-label">Weight</div>
                      <div className={`pf-field-value${profile.weight_kg ? '' : ' muted'}`}>{profile.weight_kg ? `${profile.weight_kg} kg` : '—'}</div>
                    </div>
                  </div>
                )}

                {editingBasic && (
                  <div>
                    <div className="pf-form-grid">
                      <div className="pf-field" style={{ gridColumn: 'span 2' }}>
                        <label className="pf-field-label" htmlFor="pf-edit-name">Full Name</label>
                        <input
                          className="pf-input"
                          type="text"
                          id="pf-edit-name"
                          value={basicForm.full_name}
                          onChange={(e) => updateBasicForm('full_name', e.target.value)}
                          placeholder="e.g. Juan dela Cruz"
                        />
                      </div>
                      <div className="pf-field">
                        <label className="pf-field-label" htmlFor="pf-edit-age">Age</label>
                        <input
                          className="pf-input"
                          type="number"
                          id="pf-edit-age"
                          value={basicForm.age}
                          onChange={(e) => updateBasicForm('age', e.target.value)}
                          placeholder="e.g. 24"
                          min="1"
                          max="120"
                        />
                      </div>
                      <div className="pf-field">
                        <label className="pf-field-label" htmlFor="pf-edit-sex">Biological Sex</label>
                        <select
                          className="pf-select"
                          id="pf-edit-sex"
                          value={basicForm.sex}
                          onChange={(e) => updateBasicForm('sex', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div className="pf-field">
                        <label className="pf-field-label" htmlFor="pf-edit-height">Height (cm)</label>
                        <input
                          className="pf-input"
                          type="number"
                          id="pf-edit-height"
                          value={basicForm.height_cm}
                          onChange={(e) => updateBasicForm('height_cm', e.target.value)}
                          placeholder="e.g. 168"
                          min="50"
                          max="250"
                        />
                      </div>
                      <div className="pf-field">
                        <label className="pf-field-label" htmlFor="pf-edit-weight">Weight (kg)</label>
                        <input
                          className="pf-input"
                          type="number"
                          id="pf-edit-weight"
                          value={basicForm.weight_kg}
                          onChange={(e) => updateBasicForm('weight_kg', e.target.value)}
                          placeholder="e.g. 65"
                          min="10"
                          max="500"
                          step="0.1"
                        />
                      </div>
                      <div className="pf-field" style={{ gridColumn: 'span 2' }}>
                        <label className="pf-field-label" htmlFor="pf-edit-activity">Activity Level</label>
                        <select
                          className="pf-select"
                          id="pf-edit-activity"
                          value={basicForm.activity_level}
                          onChange={(e) => updateBasicForm('activity_level', e.target.value)}
                        >
                          <option value="">Select...</option>
                          <option value="sedentary">Sedentary (little or no exercise)</option>
                          <option value="light">Lightly active (1–3 days/week)</option>
                          <option value="moderate">Moderately active (3–5 days/week)</option>
                          <option value="very_active">Very active (6–7 days/week)</option>
                          <option value="extra_active">Extra active (physical job or 2× training)</option>
                        </select>
                      </div>
                    </div>
                    <div className="pf-save-row">
                      <button className="pf-btn pf-btn-outline" type="button" onClick={closeBasicEdit}>Cancel</button>
                      <button className="pf-btn pf-btn-primary" type="button" onClick={saveBasicInfo} disabled={basicSaving}>
                        {basicSaving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`pf-tab-panel ${activeTab === 'health' ? 'active' : ''}`}>
              <div className="pf-section-card">
                <div className="pf-section-header">
                  <div className="pf-section-title-row">
                    <div className="pf-section-icon">🎯</div>
                    <div>
                      <div className="pf-section-title">Health Goals &amp; Restrictions</div>
                      <div className="pf-section-sub">BLANE uses this to personalise every recommendation</div>
                    </div>
                  </div>
                  <button className={`pf-edit-btn ${editingHealth ? 'editing' : ''}`} onClick={editingHealth ? closeHealthEdit : openHealthEdit}>
                    {editingHealth ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Cancel
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </>
                    )}
                  </button>
                </div>

                <div className="pf-field-label" style={{ marginBottom: 10 }}>Health Goal</div>
                <div className="pf-goal-display">
                  {allGoals.map((key) => {
                    const meta = goalMeta[key] || { icon: '', label: key };
                    const selected = (editingHealth ? healthForm.goal : profile.goal) === key;
                    return (
                      <div
                        key={key}
                        className={`pf-goal-option${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`}
                        onClick={editingHealth ? () => updateHealthGoal(key) : undefined}
                      >
                        <span className="pf-goal-icon">{meta.icon}</span>
                        <span className="pf-goal-label">{meta.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="pf-section-divider" />

                <div className="pf-field-label" style={{ marginBottom: 10 }}>Dietary Restrictions</div>
                <div className="pf-tag-grid">
                  {(editingHealth ? dietaryOpts : dietaryOpts.filter((opt) => (profile.dietary_restrictions || []).includes(opt.key))).map((opt) => {
                    const selected = editingHealth ? healthForm.dietary.includes(opt.key) : true;
                    if (!editingHealth && !selected) return null;
                    return (
                      <div
                        key={opt.key}
                        className={`pf-tag-pill${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`}
                        data-value={opt.key}
                        onClick={editingHealth ? () => toggleHealthTag('dietary', opt.key) : undefined}
                      >
                        {opt.label}
                      </div>
                    );
                  })}
                  {!editingHealth && (!profile.dietary_restrictions || profile.dietary_restrictions.length === 0) && (
                    <span className="pf-empty-tag">None selected</span>
                  )}
                </div>

                <div className="pf-section-divider" />

                <div className="pf-field-label" style={{ marginBottom: 10 }}>Medical Conditions</div>
                <div className="pf-tag-grid">
                  {(editingHealth ? medicalOpts : medicalOpts.filter((opt) => (profile.medical_conditions || []).includes(opt.key))).map((opt) => {
                    const selected = editingHealth ? healthForm.medical.includes(opt.key) : true;
                    if (!editingHealth && !selected) return null;
                    return (
                      <div
                        key={opt.key}
                        className={`pf-tag-pill${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`}
                        data-value={opt.key}
                        onClick={editingHealth ? () => toggleHealthTag('medical', opt.key) : undefined}
                      >
                        {opt.label}
                      </div>
                    );
                  })}
                  {!editingHealth && (!profile.medical_conditions || profile.medical_conditions.length === 0) && (
                    <span className="pf-empty-tag">None selected</span>
                  )}
                </div>

                {editingHealth && (
                  <div className="pf-save-row" id="pf-health-save-row">
                    <button className="pf-btn pf-btn-outline" type="button" onClick={closeHealthEdit}>Cancel</button>
                    <button className="pf-btn pf-btn-primary" type="button" onClick={saveHealthInfo} disabled={healthSaving}>
                      {healthSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className={`pf-tab-panel ${activeTab === 'account' ? 'active' : ''}`}>
              <div className="pf-section-card">
                <div className="pf-section-header">
                  <div className="pf-section-title-row">
                    <div className="pf-section-icon">📧</div>
                    <div>
                      <div className="pf-section-title">Account Details</div>
                      <div className="pf-section-sub">Your login credentials and account info</div>
                    </div>
                  </div>
                </div>
                <div className="pf-account-info-row">
                  <div>
                    <div className="pf-account-field-label">Email Address</div>
                    <div className="pf-account-field-value">{user?.email || '—'}</div>
                  </div>
                </div>
                <div className="pf-account-info-row">
                  <div>
                    <div className="pf-account-field-label">Member Since</div>
                    <div className="pf-account-field-value">{accountJoined}</div>
                  </div>
                </div>
                <div className="pf-account-info-row">
                  <div>
                    <div className="pf-account-field-label">User ID</div>
                    <div className="pf-account-field-value" style={{ fontSize: 12, fontFamily: 'monospace', color: '#4d6e5a' }}>
                      {user?.id ? `${user.id.slice(0, 16)}...` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pf-section-card">
                <div className="pf-section-header">
                  <div className="pf-section-title-row">
                    <div className="pf-section-icon">🔒</div>
                    <div>
                      <div className="pf-section-title">Password</div>
                      <div className="pf-section-sub">Update your BLANE account password</div>
                    </div>
                  </div>
                  <button className="pf-edit-btn" type="button" onClick={() => setPasswordOpen((value) => !value)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    {passwordOpen ? 'Cancel' : 'Change Password'}
                  </button>
                </div>

                <div className={`pf-password-form${passwordOpen ? ' open' : ''}`}>
                  <div className="pf-field">
                    <label className="pf-field-label" htmlFor="pf-pwd-new">New Password</label>
                    <input
                      className="pf-input"
                      type="password"
                      id="pf-pwd-new"
                      value={passwordForm.newPwd}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPwd: e.target.value }))}
                      placeholder="At least 6 characters"
                    />
                  </div>
                  <div className="pf-field">
                    <label className="pf-field-label" htmlFor="pf-pwd-confirm">Confirm New Password</label>
                    <input
                      className="pf-input"
                      type="password"
                      id="pf-pwd-confirm"
                      value={passwordForm.confirmPwd}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPwd: e.target.value }))}
                      placeholder="Repeat new password"
                    />
                  </div>
                  <div className="pf-save-row" style={{ marginTop: 4, paddingTop: 0, borderTop: 'none' }}>
                    <button className="pf-btn pf-btn-primary" type="button" onClick={handlePasswordChange} disabled={passwordSaving}>
                      {passwordSaving ? 'Saving…' : 'Update Password'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pf-section-card">
                <div className="pf-section-header">
                  <div className="pf-section-title-row">
                    <div className="pf-section-icon">⚠️</div>
                    <div>
                      <div className="pf-section-title" style={{ color: '#f87171' }}>Danger Zone</div>
                      <div className="pf-section-sub">Irreversible account actions</div>
                    </div>
                  </div>
                </div>
                <div className="pf-danger-zone">
                  <div className="pf-danger-title">Delete Account</div>
                  <div className="pf-danger-sub">Permanently delete your BLANE account and all associated data including your profile, meal plans, and health history. This cannot be undone.</div>
                  <button
                    className="pf-btn pf-btn-danger"
                    type="button"
                    onClick={() => alert('Account deletion — contact support or implement via Supabase admin API.')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    Delete My Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className={`pf-toast${toast.visible ? ' show' : ''}${toast.error ? ' error' : ''}`}>
          {toast.message}
        </div>
      </div>
    </>
  );
}
