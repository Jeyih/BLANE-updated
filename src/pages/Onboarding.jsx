/* ============================================================
   BLANE — Onboarding Page
   Replaces: onboarding.html + js/onboarding.js entirely.

   Old vanilla flow: DOM manipulation to show/hide .onboard-step
   divs, manual form field reads, upsert to Supabase on finish.

   New React flow: a single `formData` state object holds every
   field across all 4 steps; `currentStep` controls which step
   div gets the .active class (same CSS toggle as before).
   ============================================================ */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, REDIRECT_AFTER_ONBOARD } from '../lib/supabase';
import '../styles/onboarding.css';

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Basic Info', 'Health Goals', 'Dietary Restrictions', 'Medical Conditions', 'Allergies'];

// Option lists have been moved to the database and are managed via
// the Admin panel. Keep no hardcoded lists here — Onboarding will
// fetch the lists at runtime and fall back to empty arrays.

const emptyForm = {
  fullName: '', age: '', sex: '', height: '', weight: '', activity: '',
  goal: '', dietary: [], dietaryOther: '', medical: [], medicalOther: '',
  allergies: [], allergiesOther: '',
};

export default function Onboarding() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm]               = useState(emptyForm);
  const [error, setError]             = useState('');
  const [saving, setSaving]           = useState(false);

  const [goalsList, setGoalsList] = useState([]);
  const [dietaryList, setDietaryList] = useState([]);
  const [medicalList, setMedicalList] = useState([]);
  const [allergyList, setAllergyList] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const { data: goals, error: gErr } = await supabase.from('option_lists').select('*').eq('group', 'goals').order('sort_order');
        if (!gErr && mounted && goals) setGoalsList(goals.filter((item) => item.active !== false));
      } catch (e) { console.warn('load goals failed', e); }
      try {
        const { data: dietary, error: dErr } = await supabase.from('option_lists').select('*').eq('group', 'dietary').order('sort_order');
        if (!dErr && mounted && dietary) setDietaryList(dietary.filter((item) => item.active !== false));
      } catch (e) { console.warn('load dietary failed', e); }
      try {
        const { data: medical, error: mErr } = await supabase.from('option_lists').select('*').eq('group', 'medical').order('sort_order');
        if (!mErr && mounted && medical) setMedicalList(medical.filter((item) => item.active !== false));
      } catch (e) { console.warn('load medical failed', e); }
      try {
        const { data: allergies, error: aErr } = await supabase.from('constraint_definitions').select('*').eq('severity', 'allergy').order('sort_order');
        if (!aErr && mounted && allergies) setAllergyList(allergies.filter((item) => item.active !== false));
      } catch (e) { console.warn('load allergies failed', e); }
    }
    loadOptions();
    return () => { mounted = false; };
  }, []);

  /* Pre-fill full name from auth metadata (replaces the old
     "meta.full_name" prefill in onboarding.js) */
  useEffect(() => {
    const metaName = session?.user?.user_metadata?.full_name;
    if (metaName) setForm((f) => ({ ...f, fullName: f.fullName || metaName }));
  }, [session]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleGoal(key) {
    setForm((f) => ({ ...f, goal: key }));
  }

  function toggleTag(field, key) {
    setForm((f) => {
      const list = f[field];
      const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
      return { ...f, [field]: next };
    });
  }

  function validateStep(step) {
    setError('');
    if (step === 1) {
      if (!form.fullName.trim()) return fail('Please enter your full name.');
      if (!form.age)             return fail('Please enter your age.');
      if (!form.sex)             return fail('Please select your biological sex.');
      if (!form.height)          return fail('Please enter your height.');
      if (!form.weight)          return fail('Please enter your weight.');
    }
    if (step === 2) {
      if (!form.goal) return fail('Please select a health goal.');
    }
    return true;
  }

  function fail(msg) {
    setError(msg);
    return false;
  }

  function goBack() {
    if (currentStep > 1) { setCurrentStep((s) => s - 1); setError(''); }
  }

  function goNext() {
    if (!validateStep(currentStep)) return;
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
      setError('');
    } else {
      submitProfile();
    }
  }

  /* ---- SUBMIT — mirrors old submitProfile() ---- */
  async function submitProfile() {
    setSaving(true);

    const dietary = [...form.dietary];
    if (form.dietaryOther.trim()) dietary.push(form.dietaryOther.trim());

    const medical = [...form.medical];
    if (form.medicalOther.trim()) medical.push(form.medicalOther.trim());

    const allergies = [...form.allergies];
    if (form.allergiesOther.trim()) allergies.push(form.allergiesOther.trim());

    const { error: dbError } = await supabase.from('profiles').upsert({
      id:                   session.user.id,
      full_name:            form.fullName.trim(),
      age:                  parseInt(form.age),
      sex:                  form.sex,
      height_cm:            parseFloat(form.height),
      weight_kg:            parseFloat(form.weight),
      activity_level:       form.activity,
      goal:                 form.goal,
      dietary_restrictions: dietary,
      medical_conditions:   medical,
      allergies:            allergies,
      updated_at:           new Date().toISOString(),
    });

    setSaving(false);

    if (dbError) {
      setError('Could not save: ' + dbError.message);
      return;
    }

    navigate(REDIRECT_AFTER_ONBOARD);
  }

  const progressPct = Math.round(((currentStep - 1) / TOTAL_STEPS) * 100);

  return (
    <>
      {/* TOP BAR */}
      <div className="onboard-topbar">
        <a href="/" className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z"/>
            </svg>
          </div>
          <span className="logo-text"><span>BL</span>ANE</span>
        </a>
        <span className="onboard-step-label">
          Step <span>{currentStep}</span> — <span>{STEP_LABELS[currentStep - 1]}</span>
        </span>
        <button className="btn btn-outline" style={{ fontSize: '13px', padding: '7px 16px' }} onClick={logout}>
          Sign out
        </button>
      </div>

      {/* MAIN */}
      <main className="onboard-page">
        <div className="onboard-progress-wrap">
          <div className="onboard-progress-bar">
            <div className="onboard-progress-fill" style={{ width: progressPct + '%' }}></div>
          </div>
          <div className="onboard-progress-text">Step {currentStep} of {TOTAL_STEPS}</div>
        </div>

        <div className="onboard-card">
          {error && <p className="form-error" style={{ display: 'block' }}>{error}</p>}

          {/* STEP 1: Basic Info */}
          <div className={'onboard-step' + (currentStep === 1 ? ' active' : '')}>
            <div className="onboard-step-icon">👤</div>
            <h2>Tell us about yourself</h2>
            <p className="sub">We use this to calculate your personal nutrition targets accurately.</p>

            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="form-input" type="text" placeholder="e.g. Juan dela Cruz"
                value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" type="number" placeholder="e.g. 24" min="1" max="120"
                  value={form.age} onChange={(e) => updateField('age', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Biological sex</label>
                <select className="form-select" value={form.sex} onChange={(e) => updateField('sex', e.target.value)}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Height (cm)</label>
                <input className="form-input" type="number" placeholder="e.g. 168" min="50" max="250"
                  value={form.height} onChange={(e) => updateField('height', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Weight (kg)</label>
                <input className="form-input" type="number" placeholder="e.g. 65" min="10" max="500" step="0.1"
                  value={form.weight} onChange={(e) => updateField('weight', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Activity level</label>
              <select className="form-select" value={form.activity} onChange={(e) => updateField('activity', e.target.value)}>
                <option value="">Select...</option>
                <option value="sedentary">Sedentary (little or no exercise)</option>
                <option value="light">Lightly active (1-3 days/week)</option>
                <option value="moderate">Moderately active (3-5 days/week)</option>
                <option value="very_active">Very active (6-7 days/week)</option>
                <option value="extra_active">Extra active (physical job or 2x training)</option>
              </select>
            </div>
          </div>

          {/* STEP 2: Health Goals */}
          <div className={'onboard-step' + (currentStep === 2 ? ' active' : '')}>
            <div className="onboard-step-icon">🎯</div>
            <h2>What is your main goal?</h2>
            <p className="sub">BLANE tailors your calorie targets and macro ratios around this.</p>
            <div className="goal-grid">
              {goalsList.map((g) => (
                <div
                  key={g.key}
                  className={'goal-card' + (form.goal === g.key ? ' selected' : '')}
                  onClick={() => toggleGoal(g.key)}
                >
                  <span className="goal-card-icon">{g.icon}</span>
                  <span className="goal-card-label">{g.label}</span>
                  <span className="goal-card-desc">{g.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 3: Dietary Restrictions */}
          <div className={'onboard-step' + (currentStep === 3 ? ' active' : '')}>
            <div className="onboard-step-icon">🥗</div>
            <h2>Any dietary restrictions?</h2>
            <p className="sub">Select all that apply. BLANE will never suggest meals that violate these. Skip if none apply.</p>
            <div className="tag-grid">
              {dietaryList.map((opt) => (
                <div
                  key={opt.key}
                  className={'tag-pill' + (form.dietary.includes(opt.key) ? ' selected' : '')}
                  onClick={() => toggleTag('dietary', opt.key)}
                >
                  <span className="tag-pill-icon">{opt.icon}</span> {opt.label}
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginTop: '18px' }}>
              <label className="form-label">Other restrictions (optional)</label>
              <input className="form-input" type="text" placeholder="e.g. No pork, No MSG..."
                value={form.dietaryOther} onChange={(e) => updateField('dietaryOther', e.target.value)} />
            </div>
          </div>

          {/* STEP 4: Medical Conditions */}
          <div className={'onboard-step' + (currentStep === 4 ? ' active' : '')}>
            <div className="onboard-step-icon">🩺</div>
            <h2>Any medical conditions?</h2>
            <p className="sub">This helps BLANE avoid nutrients that may affect your condition. All data is private and stored securely. Skip if none apply.</p>
            <div className="tag-grid">
              {medicalList.map((opt) => (
                <div
                  key={opt.key}
                  className={'tag-pill' + (form.medical.includes(opt.key) ? ' selected' : '')}
                  onClick={() => toggleTag('medical', opt.key)}
                >
                  <span className="tag-pill-icon">{opt.icon}</span> {opt.label}
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginTop: '18px' }}>
              <label className="form-label">Other condition (optional)</label>
              <input className="form-input" type="text" placeholder="e.g. Lupus, Crohn's disease..."
                value={form.medicalOther} onChange={(e) => updateField('medicalOther', e.target.value)} />
            </div>
          </div>

          {/* STEP 5: Allergies */}
          <div className={'onboard-step' + (currentStep === 5 ? ' active' : '')}>
            <div className="onboard-step-icon">⚠️</div>
            <h2>Any food allergies?</h2>
            <p className="sub">BLANE will block meals and ingredients containing these. Skip if none apply.</p>
            <div className="tag-grid">
              {allergyList.map((opt) => (
                <div
                  key={opt.key}
                  className={'tag-pill' + (form.allergies.includes(opt.key) ? ' selected' : '')}
                  onClick={() => toggleTag('allergies', opt.key)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
            <div className="form-group" style={{ marginTop: '18px' }}>
              <label className="form-label">Other allergy (optional)</label>
              <input className="form-input" type="text" placeholder="e.g. Shellfish, Peanuts..."
                value={form.allergiesOther} onChange={(e) => updateField('allergiesOther', e.target.value)} />
            </div>
          </div>

          {/* NAV BUTTONS */}
          <div className="onboard-nav">
            <button className="btn btn-outline" style={{ visibility: currentStep === 1 ? 'hidden' : 'visible' }} onClick={goBack}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={goNext} disabled={saving}>
              {saving ? 'Saving...' : currentStep === TOTAL_STEPS ? 'Finish & Save' : 'Continue'}
            </button>
          </div>
        </div>
      </main>

      {/* SAVING OVERLAY */}
      <div className={'saving-overlay' + (saving ? ' active' : '')}>
        <div className="saving-spinner"></div>
        <p className="saving-text">Saving your profile...</p>
      </div>
    </>
  );
} 