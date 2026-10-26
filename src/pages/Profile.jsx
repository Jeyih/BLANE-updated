import { computeDailyTargets, validateMeasurements } from '../../supabase/functions/_shared/nutrition.js';
import React from 'react';
import { isProfileComplete } from '../lib/profile-readiness';
import PasswordInput from '../components/PasswordInput';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import '../styles/profile.css';
const ACTIVITY_LABELS = {
  sedentary: 'Sedentary',
  light: 'Lightly Active',
  moderate: 'Moderately Active',
  very_active: 'Very Active',
  extra_active: 'Extra Active',
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
  allergies: [],
};
function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [goalMeta, setGoalMeta] = useState({});
  const [allGoals, setAllGoals] = useState([]);
  const [dietaryOpts, setDietaryOpts] = useState([]);
  const [medicalOpts, setMedicalOpts] = useState([]);
  const [allergyOpts, setAllergyOpts] = useState([]);
  const [activeTab, setActiveTab] = useState('profile');
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
    allergies: [],
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
        const { data: goals, error: gErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'goals');
        if (!gErr && mounted && Array.isArray(goals)) {
          const meta = {};
          const keys = [];
          goals
            .filter((item) => item.active !== false)
            .forEach((g) => {
              meta[g.key] = { icon: g.icon || '', label: g.label || g.key };
              keys.push(g.key);
            });
          setGoalMeta(meta);
          setAllGoals(keys);
        }
      } catch (e) {
        console.warn('load goals failed', e);
      }
      try {
        const { data: dietary, error: dErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'dietary')
          .order('sort_order');
        if (!dErr && mounted && Array.isArray(dietary))
          setDietaryOpts(dietary.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load dietary failed', e);
      }
      try {
        const { data: medical, error: mErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'medical')
          .order('sort_order');
        if (!mErr && mounted && Array.isArray(medical))
          setMedicalOpts(medical.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load medical failed', e);
      }
      try {
        const { data: allergies, error: aErr } = await supabase
          .from('constraint_definitions')
          .select('*')
          .eq('severity', 'allergy')
          .order('sort_order');
        if (!aErr && mounted && Array.isArray(allergies))
          setAllergyOpts(allergies.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load allergies failed', e);
      }
    }
    loadOptions();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 3e3);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);
  async function loadProfile() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
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
      allergies: nextProfile.allergies || [],
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
    if (!user?.created_at) return 'Joined \u2014';
    const created = new Date(user.created_at);
    return 'Joined ' + created.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  }, [user?.created_at]);
  const accountJoined = useMemo(() => {
    if (!user?.created_at) return '\u2014';
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
      if (bmi < 18.5) {
        bmiCategory = 'Underweight';
        bmiColor = '#60a5fa';
      } else if (bmi < 25) {
        bmiCategory = 'Normal';
        bmiColor = '#2ddc7a';
      } else if (bmi < 30) {
        bmiCategory = 'Overweight';
        bmiColor = '#fbbf24';
      } else {
        bmiCategory = 'Obese';
        bmiColor = '#f87171';
      }
      const targets = isProfileComplete(profile) ? computeDailyTargets(profile) : null;
      calorieTdee = targets ? Math.round(targets.tdee) : null;
      calorieTarget = targets?.calories ?? null;
      const label = targets ? "TDEE: " + calorieTdee.toLocaleString() + " kcal/day" : 'Complete your profile';
      const bmiMarkerPct = Math.min(Math.max((bmi - 10) / 30, 0), 1) * 100;
      return {
        bmiValue: bmiFixed,
        bmiCategory,
        bmiColor,
        calorieTarget,
        calorieLabel: label,
        caloriePct: calorieTarget ? Math.min(Math.round((calorieTarget / 3e3) * 100), 100) : 0,
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
  }, [
    profile.height_cm,
    profile.weight_kg,
    profile.age,
    profile.sex,
    profile.activity_level,
    profile.goal,
  ]);
  const progress = useMemo(() => {
    if (!user?.created_at) return { days: '--', label: '\u2014', pct: 0 };
    const created = new Date(user.created_at);
    const today = new Date();
    const days = Math.max(1, Math.floor((today - created) / (1e3 * 60 * 60 * 24)));
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
      allergies: profile.allergies || [],
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
    const age = Number(basicForm.age);
    const height = Number(basicForm.height_cm);
    const weight = Number(basicForm.weight_kg);
    if (!name) {
      showToast('Please enter your name.', true);
      return;
    }
    if (!age || age < 1) {
      showToast('Please enter a valid age.', true);
      return;
    }
    if (!height) {
      showToast('Please enter your height.', true);
      return;
    }
    if (!weight) {
      showToast('Please enter your weight.', true);
      return;
    }
    const measurementError = validateMeasurements({ age, height_cm: height, weight_kg: weight });
    if (measurementError) { showToast(measurementError, true); return; }
    setBasicSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
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
    window.dispatchEvent(new Event('blane-profile-saved'));
    setEditingBasic(false);
    showToast('\u2713 Basic info saved successfully');
  }
  async function saveHealthInfo() {
    if (!healthForm.goal) {
      showToast('Please choose a health goal.', true);
      return;
    }
    setHealthSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        goal: healthForm.goal,
        dietary_restrictions: healthForm.dietary,
        medical_conditions: healthForm.medical,
        allergies: healthForm.allergies,
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
      allergies: healthForm.allergies,
    }));
    setEditingHealth(false);
    window.dispatchEvent(new Event('blane-profile-saved'));
    showToast('\u2713 Health info saved successfully');
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
    showToast('\u2713 Password updated successfully');
  }
  if (loading) {
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(Navbar, null),
      React.createElement(
        'main',
        { className: 'pf-main' },
        React.createElement('div', { className: 'pf-content' }, 'Loading profile...'),
      ),
    );
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Navbar, null),
    React.createElement(
      'div',
      { className: 'pf-body' },
      React.createElement(
        'main',
        { className: 'pf-main' },
        React.createElement(
          'div',
          { className: 'pf-content' },
          React.createElement(
            'div',
            { className: 'pf-hero' },
            React.createElement(
              'div',
              { className: 'pf-avatar', title: 'Profile picture' },
              React.createElement('span', null, avatarInitial),
              React.createElement('div', { className: 'pf-avatar-edit' }, '\u270E'),
            ),
            React.createElement(
              'div',
              { className: 'pf-hero-info' },
              React.createElement('div', { className: 'pf-hero-name' }, displayName),
              React.createElement(
                'div',
                { className: 'pf-hero-meta' },
                React.createElement('span', null, joinedDate),
                React.createElement(
                  'span',
                  { className: 'pf-hero-badge' },
                  goalMeta[profile.goal]?.icon || '\u2014',
                  ' ',
                  goalMeta[profile.goal]?.label || '\u2014',
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'pf-stats-row' },
            React.createElement(
              'div',
              { className: 'pf-stat-card' },
              React.createElement('div', { className: 'pf-stat-icon' }, '\u{1F4CA}'),
              React.createElement('div', { className: 'pf-stat-label' }, 'BMI Index'),
              React.createElement(
                'div',
                { className: 'pf-stat-value', style: { color: stats.bmiColor } },
                stats.bmiValue,
              ),
              React.createElement('div', { className: 'pf-stat-sub' }, stats.bmiCategory),
              React.createElement(
                'div',
                { className: 'pf-bmi-scale' },
                React.createElement('div', {
                  className: 'pf-bmi-marker',
                  style: { left: `${stats.bmiMarkerPct}%` },
                }),
              ),
            ),
            React.createElement(
              'div',
              { className: 'pf-stat-card' },
              React.createElement('div', { className: 'pf-stat-icon' }, '\u{1F525}'),
              React.createElement('div', { className: 'pf-stat-label' }, 'Daily Calorie Target'),
              React.createElement(
                'div',
                { className: 'pf-stat-value yellow' },
                stats.calorieTarget ? stats.calorieTarget.toLocaleString() : '--',
              ),
              React.createElement('div', { className: 'pf-stat-sub' }, stats.calorieLabel),
              React.createElement(
                'div',
                { className: 'pf-cal-bar-bg' },
                React.createElement('div', {
                  className: 'pf-cal-bar-fill',
                  style: { width: `${stats.caloriePct}%` },
                }),
              ),
            ),
            React.createElement(
              'div',
              { className: 'pf-stat-card' },
              React.createElement('div', { className: 'pf-stat-icon' }, '\u{1F331}'),
              React.createElement('div', { className: 'pf-stat-label' }, 'Days on BLANE'),
              React.createElement('div', { className: 'pf-stat-value blue' }, progress.days),
              React.createElement('div', { className: 'pf-stat-sub' }, progress.label),
              React.createElement(
                'div',
                { className: 'pf-progress-bar-bg' },
                React.createElement('div', {
                  className: 'pf-progress-bar-fill',
                  style: { width: `${progress.pct}%` },
                }),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'pf-tabs' },
            React.createElement(
              'button',
              {
                className: `pf-tab-btn ${activeTab === 'profile' ? 'active' : ''}`,
                onClick: () => toggleTab('profile'),
              },
              React.createElement(
                'svg',
                {
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                },
                React.createElement('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
                React.createElement('circle', { cx: '12', cy: '7', r: '4' }),
              ),
              'Profile',
            ),
            React.createElement(
              'button',
              {
                className: `pf-tab-btn ${activeTab === 'account' ? 'active' : ''}`,
                onClick: () => toggleTab('account'),
              },
              React.createElement(
                'svg',
                {
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: '2',
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                },
                React.createElement('rect', {
                  x: '3',
                  y: '11',
                  width: '18',
                  height: '11',
                  rx: '2',
                  ry: '2',
                }),
                React.createElement('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
              ),
              'Account',
            ),
          ),
          React.createElement(
            'div',
            { className: `pf-tab-panel ${activeTab === 'profile' ? 'active' : ''}` },
            React.createElement(
              'div',
              { className: 'pf-section-card' },
              React.createElement(
                'div',
                { className: 'pf-section-header' },
                React.createElement(
                  'div',
                  { className: 'pf-section-title-row' },
                  React.createElement('div', { className: 'pf-section-icon' }, '\u{1F464}'),
                  React.createElement(
                    'div',
                    null,
                    React.createElement(
                      'div',
                      { className: 'pf-section-title' },
                      'Basic Information',
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-section-sub' },
                      'Your personal details used to calculate nutrition targets',
                    ),
                  ),
                ),
                React.createElement(
                  'button',
                  {
                    className: `pf-edit-btn ${editingBasic ? 'editing' : ''}`,
                    onClick: editingBasic ? closeBasicEdit : openBasicEdit,
                  },
                  editingBasic
                    ? React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          'svg',
                          {
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: '2',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          },
                          React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                          React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
                        ),
                        'Cancel',
                      )
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          'svg',
                          {
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: '2',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          },
                          React.createElement('path', {
                            d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                          }),
                          React.createElement('path', {
                            d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                          }),
                        ),
                        'Edit',
                      ),
                ),
              ),
              !editingBasic &&
                React.createElement(
                  'div',
                  { className: 'pf-form-grid' },
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Full Name'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.full_name ? '' : ' muted'}` },
                      profile.full_name || '\u2014',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Age'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.age ? '' : ' muted'}` },
                      profile.age ? `${profile.age} years old` : '\u2014',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Biological Sex'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.sex ? '' : ' muted'}` },
                      profile.sex
                        ? profile.sex.charAt(0).toUpperCase() + profile.sex.slice(1)
                        : '\u2014',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Activity Level'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.activity_level ? '' : ' muted'}` },
                      profile.activity_level
                        ? ACTIVITY_LABELS[profile.activity_level] || profile.activity_level
                        : '\u2014',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Height'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.height_cm ? '' : ' muted'}` },
                      profile.height_cm ? `${profile.height_cm} cm` : '\u2014',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-field' },
                    React.createElement('div', { className: 'pf-field-label' }, 'Weight'),
                    React.createElement(
                      'div',
                      { className: `pf-field-value${profile.weight_kg ? '' : ' muted'}` },
                      profile.weight_kg ? `${profile.weight_kg} kg` : '\u2014',
                    ),
                  ),
                ),
              editingBasic &&
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'pf-form-grid' },
                    React.createElement(
                      'div',
                      { className: 'pf-field', style: { gridColumn: 'span 2' } },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-name' },
                        'Full Name',
                      ),
                      React.createElement('input', {
                        className: 'pf-input',
                        type: 'text',
                        id: 'pf-edit-name',
                        value: basicForm.full_name,
                        onChange: (e) => updateBasicForm('full_name', e.target.value),
                        placeholder: 'e.g. Juan dela Cruz',
                      }),
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-field' },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-age' },
                        'Age',
                      ),
                      React.createElement('input', {
                        className: 'pf-input',
                        type: 'number',
                        id: 'pf-edit-age',
                        value: basicForm.age,
                        onChange: (e) => updateBasicForm('age', e.target.value),
                        placeholder: 'e.g. 24',
                        min: '1',
                        max: '120',
                      }),
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-field' },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-sex' },
                        'Biological Sex',
                      ),
                      React.createElement(
                        'select',
                        {
                          className: 'pf-select',
                          id: 'pf-edit-sex',
                          value: basicForm.sex,
                          onChange: (e) => updateBasicForm('sex', e.target.value),
                        },
                        React.createElement('option', { value: '' }, 'Select...'),
                        React.createElement('option', { value: 'male' }, 'Male'),
                        React.createElement('option', { value: 'female' }, 'Female'),
                      ),
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-field' },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-height' },
                        'Height (cm)',
                      ),
                      React.createElement('input', {
                        className: 'pf-input',
                        type: 'number',
                        id: 'pf-edit-height',
                        value: basicForm.height_cm,
                        onChange: (e) => updateBasicForm('height_cm', e.target.value),
                        placeholder: 'e.g. 168',
                        min: '50',
                        max: '250',
                      }),
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-field' },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-weight' },
                        'Weight (kg)',
                      ),
                      React.createElement('input', {
                        className: 'pf-input',
                        type: 'number',
                        id: 'pf-edit-weight',
                        value: basicForm.weight_kg,
                        onChange: (e) => updateBasicForm('weight_kg', e.target.value),
                        placeholder: 'e.g. 65',
                        min: '10',
                        max: '500',
                        step: '0.1',
                      }),
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-field', style: { gridColumn: 'span 2' } },
                      React.createElement(
                        'label',
                        { className: 'pf-field-label', htmlFor: 'pf-edit-activity' },
                        'Activity Level',
                      ),
                      React.createElement(
                        'select',
                        {
                          className: 'pf-select',
                          id: 'pf-edit-activity',
                          value: basicForm.activity_level,
                          onChange: (e) => updateBasicForm('activity_level', e.target.value),
                        },
                        React.createElement('option', { value: '' }, 'Select...'),
                        React.createElement(
                          'option',
                          { value: 'sedentary' },
                          'Sedentary (little or no exercise)',
                        ),
                        React.createElement(
                          'option',
                          { value: 'light' },
                          'Lightly active (1\u20133 days/week)',
                        ),
                        React.createElement(
                          'option',
                          { value: 'moderate' },
                          'Moderately active (3\u20135 days/week)',
                        ),
                        React.createElement(
                          'option',
                          { value: 'very_active' },
                          'Very active (6\u20137 days/week)',
                        ),
                        React.createElement(
                          'option',
                          { value: 'extra_active' },
                          'Extra active (physical job or 2\xD7 training)',
                        ),
                      ),
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-save-row' },
                    React.createElement(
                      'button',
                      {
                        className: 'pf-btn pf-btn-outline',
                        type: 'button',
                        onClick: closeBasicEdit,
                      },
                      'Cancel',
                    ),
                    React.createElement(
                      'button',
                      {
                        className: 'pf-btn pf-btn-primary',
                        type: 'button',
                        onClick: saveBasicInfo,
                        disabled: basicSaving,
                      },
                      basicSaving ? 'Saving\u2026' : 'Save Changes',
                    ),
                  ),
                ),
            ),
            React.createElement(
              'div',
              { className: 'pf-section-card' },
              React.createElement(
                'div',
                { className: 'pf-section-header' },
                React.createElement(
                  'div',
                  { className: 'pf-section-title-row' },
                  React.createElement('div', { className: 'pf-section-icon' }, '\u{1F3AF}'),
                  React.createElement(
                    'div',
                    null,
                    React.createElement(
                      'div',
                      { className: 'pf-section-title' },
                      'Health Goals & Restrictions',
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-section-sub' },
                      'BLANE uses this to personalise every recommendation',
                    ),
                  ),
                ),
                React.createElement(
                  'button',
                  {
                    className: `pf-edit-btn ${editingHealth ? 'editing' : ''}`,
                    onClick: editingHealth ? closeHealthEdit : openHealthEdit,
                  },
                  editingHealth
                    ? React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          'svg',
                          {
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: '2',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          },
                          React.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
                          React.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
                        ),
                        'Cancel',
                      )
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(
                          'svg',
                          {
                            viewBox: '0 0 24 24',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: '2',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          },
                          React.createElement('path', {
                            d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                          }),
                          React.createElement('path', {
                            d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                          }),
                        ),
                        'Edit',
                      ),
                ),
              ),
              React.createElement(
                'div',
                { className: 'pf-field-label', style: { marginBottom: 10 } },
                'Health Goal',
              ),
              React.createElement(
                'div',
                { className: 'pf-goal-display' },
                allGoals.map((key) => {
                  const meta = goalMeta[key] || { icon: '', label: key };
                  const selected = (editingHealth ? healthForm.goal : profile.goal) === key;
                  return React.createElement(
                    'div',
                    {
                      key,
                      className: `pf-goal-option${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`,
                      onClick: editingHealth ? () => updateHealthGoal(key) : void 0,
                    },
                    React.createElement('span', { className: 'pf-goal-icon' }, meta.icon),
                    React.createElement('span', { className: 'pf-goal-label' }, meta.label),
                  );
                }),
              ),
              React.createElement('div', { className: 'pf-section-divider' }),
              React.createElement(
                'div',
                { className: 'pf-field-label', style: { marginBottom: 10 } },
                'Dietary Restrictions',
              ),
              React.createElement(
                'div',
                { className: 'pf-tag-grid' },
                (editingHealth
                  ? dietaryOpts
                  : dietaryOpts.filter((opt) =>
                      (profile.dietary_restrictions || []).includes(opt.key),
                    )
                ).map((opt) => {
                  const selected = editingHealth ? healthForm.dietary.includes(opt.key) : true;
                  if (!editingHealth && !selected) return null;
                  return React.createElement(
                    'div',
                    {
                      key: opt.key,
                      className: `pf-tag-pill${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`,
                      'data-value': opt.key,
                      onClick: editingHealth ? () => toggleHealthTag('dietary', opt.key) : void 0,
                    },
                    opt.label,
                  );
                }),
                !editingHealth &&
                  (!profile.dietary_restrictions || profile.dietary_restrictions.length === 0) &&
                  React.createElement('span', { className: 'pf-empty-tag' }, 'None selected'),
              ),
              React.createElement('div', { className: 'pf-section-divider' }),
              React.createElement(
                'div',
                { className: 'pf-field-label', style: { marginBottom: 10 } },
                'Medical Conditions',
              ),
              React.createElement(
                'div',
                { className: 'pf-tag-grid' },
                (editingHealth
                  ? medicalOpts
                  : medicalOpts.filter((opt) =>
                      (profile.medical_conditions || []).includes(opt.key),
                    )
                ).map((opt) => {
                  const selected = editingHealth ? healthForm.medical.includes(opt.key) : true;
                  if (!editingHealth && !selected) return null;
                  return React.createElement(
                    'div',
                    {
                      key: opt.key,
                      className: `pf-tag-pill${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`,
                      'data-value': opt.key,
                      onClick: editingHealth ? () => toggleHealthTag('medical', opt.key) : void 0,
                    },
                    opt.label,
                  );
                }),
                !editingHealth &&
                  (!profile.medical_conditions || profile.medical_conditions.length === 0) &&
                  React.createElement('span', { className: 'pf-empty-tag' }, 'None selected'),
              ),
              React.createElement('div', { className: 'pf-section-divider' }),
              React.createElement(
                'div',
                { className: 'pf-field-label', style: { marginBottom: 10 } },
                'Allergies',
              ),
              React.createElement(
                'div',
                { className: 'pf-tag-grid' },
                (editingHealth
                  ? allergyOpts
                  : allergyOpts.filter((opt) => (profile.allergies || []).includes(opt.key))
                ).map((opt) => {
                  const selected = editingHealth ? healthForm.allergies.includes(opt.key) : true;
                  if (!editingHealth && !selected) return null;
                  return React.createElement(
                    'div',
                    {
                      key: opt.key,
                      className: `pf-tag-pill${selected ? ' selected' : ''}${editingHealth ? '' : ' readonly'}`,
                      'data-value': opt.key,
                      onClick: editingHealth ? () => toggleHealthTag('allergies', opt.key) : void 0,
                    },
                    opt.label,
                  );
                }),
                !editingHealth &&
                  (!profile.allergies || profile.allergies.length === 0) &&
                  React.createElement('span', { className: 'pf-empty-tag' }, 'None selected'),
              ),
              editingHealth &&
                React.createElement(
                  'div',
                  { className: 'pf-save-row', id: 'pf-health-save-row' },
                  React.createElement(
                    'button',
                    {
                      className: 'pf-btn pf-btn-outline',
                      type: 'button',
                      onClick: closeHealthEdit,
                    },
                    'Cancel',
                  ),
                  React.createElement(
                    'button',
                    {
                      className: 'pf-btn pf-btn-primary',
                      type: 'button',
                      onClick: saveHealthInfo,
                      disabled: healthSaving,
                    },
                    healthSaving ? 'Saving\u2026' : 'Save Changes',
                  ),
                ),
            ),
          ),
          React.createElement(
            'div',
            { className: `pf-tab-panel ${activeTab === 'account' ? 'active' : ''}` },
            React.createElement(
              'div',
              { className: 'pf-section-card' },
              React.createElement(
                'div',
                { className: 'pf-section-header' },
                React.createElement(
                  'div',
                  { className: 'pf-section-title-row' },
                  React.createElement('div', { className: 'pf-section-icon' }, '\u{1F4E7}'),
                  React.createElement(
                    'div',
                    null,
                    React.createElement(
                      'div',
                      { className: 'pf-section-title' },
                      'Account Details',
                    ),
                    React.createElement(
                      'div',
                      { className: 'pf-section-sub' },
                      'Your login credentials and account info',
                    ),
                  ),
                ),
              ),
              React.createElement(
                'div',
                { className: 'pf-account-info-row' },
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'pf-account-field-label' },
                    'Email Address',
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-account-field-value' },
                    user?.email || '\u2014',
                  ),
                ),
              ),
              React.createElement(
                'div',
                { className: 'pf-account-info-row' },
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'pf-account-field-label' },
                    'Member Since',
                  ),
                  React.createElement(
                    'div',
                    { className: 'pf-account-field-value' },
                    accountJoined,
                  ),
                ),
              ),
              React.createElement(
                'div',
                { className: 'pf-account-info-row' },
                React.createElement(
                  'div',
                  null,
                  React.createElement('div', { className: 'pf-account-field-label' }, 'User ID'),
                  React.createElement(
                    'div',
                    {
                      className: 'pf-account-field-value',
                      style: { fontSize: 12, fontFamily: 'monospace', color: '#4d6e5a' },
                    },
                    user?.id ? `${user.id.slice(0, 16)}...` : '\u2014',
                  ),
                ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'pf-section-card' },
              React.createElement(
                'div',
                { className: 'pf-section-header' },
                React.createElement(
                  'div',
                  { className: 'pf-section-title-row' },
                  React.createElement('div', { className: 'pf-section-icon' }, '\u{1F512}'),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('div', { className: 'pf-section-title' }, 'Password'),
                    React.createElement(
                      'div',
                      { className: 'pf-section-sub' },
                      'Update your BLANE account password',
                    ),
                  ),
                ),
                React.createElement(
                  'button',
                  {
                    className: 'pf-edit-btn',
                    type: 'button',
                    onClick: () => setPasswordOpen((value) => !value),
                  },
                  React.createElement(
                    'svg',
                    {
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: '2',
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    },
                    React.createElement('rect', {
                      x: '3',
                      y: '11',
                      width: '18',
                      height: '11',
                      rx: '2',
                      ry: '2',
                    }),
                    React.createElement('path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }),
                  ),
                  passwordOpen ? 'Cancel' : 'Change Password',
                ),
              ),
              React.createElement(
                'div',
                { className: `pf-password-form${passwordOpen ? ' open' : ''}` },
                React.createElement(
                  'div',
                  { className: 'pf-field' },
                  React.createElement(
                    'label',
                    { className: 'pf-field-label', htmlFor: 'pf-pwd-new' },
                    'New Password',
                  ),
                  React.createElement(PasswordInput, {
                    className: 'pf-input',
                    id: 'pf-pwd-new',
                    autoComplete: 'new-password',
                    value: passwordForm.newPwd,
                    onChange: (e) =>
                      setPasswordForm((prev) => ({ ...prev, newPwd: e.target.value })),
                    placeholder: 'At least 6 characters',
                  }),
                ),
                React.createElement(
                  'div',
                  { className: 'pf-field' },
                  React.createElement(
                    'label',
                    { className: 'pf-field-label', htmlFor: 'pf-pwd-confirm' },
                    'Confirm New Password',
                  ),
                  React.createElement(PasswordInput, {
                    className: 'pf-input',
                    id: 'pf-pwd-confirm',
                    autoComplete: 'new-password',
                    value: passwordForm.confirmPwd,
                    onChange: (e) =>
                      setPasswordForm((prev) => ({ ...prev, confirmPwd: e.target.value })),
                    placeholder: 'Repeat new password',
                  }),
                ),
                React.createElement(
                  'div',
                  {
                    className: 'pf-save-row',
                    style: { marginTop: 4, paddingTop: 0, borderTop: 'none' },
                  },
                  React.createElement(
                    'button',
                    {
                      className: 'pf-btn pf-btn-primary',
                      type: 'button',
                      onClick: handlePasswordChange,
                      disabled: passwordSaving,
                    },
                    passwordSaving ? 'Saving\u2026' : 'Update Password',
                  ),
                ),
              ),
            ),
            React.createElement(
              'div',
              { className: 'pf-section-card' },
              React.createElement(
                'div',
                { className: 'pf-section-header' },
                React.createElement(
                  'div',
                  { className: 'pf-section-title-row' },
                  React.createElement('div', { className: 'pf-section-icon' }, '\u26A0\uFE0F'),
                  React.createElement(
                    'div',
                    null,
                    React.createElement(
                      'div',
                      { className: 'pf-section-title', style: { color: '#f87171' } },
                      'Danger Zone',
                    ),
                    React.createElement('div', { className: 'pf-section-sub' }, 'Account support'),
                  ),
                ),
              ),
              React.createElement(
                'div',
                { className: 'pf-danger-zone' },
                React.createElement('div', { className: 'pf-danger-title' }, 'Delete Account'),
                React.createElement(
                  'div',
                  { className: 'pf-danger-sub', id: 'account-deletion-status' },
                  'Self-service account deletion is not available yet. Use Feedback in the navigation menu to contact the project team about your account.',
                ),
                React.createElement(
                  'button',
                  {
                    className: 'pf-btn pf-btn-danger',
                    type: 'button',
                    disabled: true,
                    'aria-describedby': 'account-deletion-status',
                  },
                  React.createElement(
                    'svg',
                    {
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: '2',
                      strokeLinecap: 'round',
                      strokeLinejoin: 'round',
                    },
                    React.createElement('polyline', { points: '3 6 5 6 21 6' }),
                    React.createElement('path', {
                      d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
                    }),
                    React.createElement('path', { d: 'M10 11v6M14 11v6' }),
                    React.createElement('path', { d: 'M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2' }),
                  ),
                  'Account deletion unavailable',
                ),
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: `pf-toast${toast.visible ? ' show' : ''}${toast.error ? ' error' : ''}` },
        toast.message,
      ),
    ),
  );
}
export { Profile as default };
