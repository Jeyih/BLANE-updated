import AllergyLabel from '../components/AllergyLabel';
import { ALLERGY_GUIDANCE } from '../lib/allergy-copy.js';
import { SEX_CHOICES, isSexChoice, UNDISCLOSED_SEX_NOTE } from '../lib/sex-choice.js';
import MedicalConditionLabel from '../components/MedicalConditionLabel';
import { MEDICAL_CONDITION_GUIDANCE } from '../lib/medical-condition-copy.js';
import HealthGoalPicker from '../components/HealthGoalPicker';
import { healthGoalError, healthGoalFields, saveHealthProfile } from '../lib/health-goals.js';
import { validateMeasurements } from '../../supabase/functions/_shared/nutrition.js';
import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, REDIRECT_AFTER_ONBOARD } from '../lib/supabase';
import { hasInitialProfile, onboardingFormFromProfile } from '../lib/onboarding-profile';
import { resolveConstraintKey } from '../lib/constraint-rules.js';
import '../styles/onboarding.css';
const TOTAL_STEPS = 5;
const STEP_LABELS = [
  'Basic Info',
  'Health Goals',
  'Dietary Restrictions',
  'Health Conditions',
  'Allergies',
];
const emptyForm = {
  fullName: '',
  age: '',
  sex: '',
  height: '',
  weight: '',
  activity: '',
  goal: '',
  health_goals: [],
  dietary: [],
  dietaryOther: '',
  medical: [],
  medicalOther: '',
  allergies: [],
  allergiesOther: '',
};
function Onboarding() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [retryProfile, setRetryProfile] = useState(0);
  const [goalsList, setGoalsList] = useState([]);
  const [dietaryList, setDietaryList] = useState([]);
  const [medicalList, setMedicalList] = useState([]);
  const [allergyList, setAllergyList] = useState([]);
  const entryKey = (value, options) => resolveConstraintKey(value, Object.fromEntries(options.map(option => [option.key, option]))) || value.trim();
  const customNotice = (value, options) => value.trim() && React.createElement('p', { className: 'form-hint', role: 'status' },
    entryKey(value, options) !== value.trim() || options.some(option => option.key === value.trim())
      ? 'This entry matches a supported rule.'
      : 'This entry will stay recorded. Automatic meal selection stays blocked until a matching dietary rule is available. Choose a listed option if it accurately matches.');
  useEffect(() => {
    let mounted = true;
    async function loadOptions() {
      try {
        const { data: goals, error: gErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'goals')
          .order('sort_order');
        if (!gErr && mounted && goals) setGoalsList(goals.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load goals failed', e);
      }
      try {
        const { data: dietary, error: dErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'dietary')
          .order('sort_order');
        if (!dErr && mounted && dietary)
          setDietaryList(dietary.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load dietary failed', e);
      }
      try {
        const { data: medical, error: mErr } = await supabase
          .from('option_lists')
          .select('*')
          .eq('group', 'medical')
          .order('sort_order');
        if (!mErr && mounted && medical)
          setMedicalList(medical.filter((item) => item.active !== false));
      } catch (e) {
        console.warn('load medical failed', e);
      }
      try {
        const { data: allergies, error: aErr } = await supabase
          .from('constraint_definitions')
          .select('*')
          .eq('severity', 'allergy')
          .order('sort_order');
        if (!aErr && mounted && allergies)
          setAllergyList(allergies.filter((item) => item.active !== false));
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
    if (!session?.user?.id) return;
    let active = true;
    async function loadSavedProfile() {
      setProfileLoading(true);
      setProfileLoadError(false);
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
          .abortSignal(AbortSignal.timeout(15000));
        if (!active) return;
        if (error) throw error;
        if (hasInitialProfile(data)) {
          window.dispatchEvent(new Event('blane-profile-saved'));
          navigate(REDIRECT_AFTER_ONBOARD, { replace: true });
          return;
        }
        setForm(onboardingFormFromProfile(data, session.user.user_metadata?.full_name || ''));
      } catch {
        if (active) { setProfileLoadError(true); setError('Could not load your saved profile. Please retry before making changes.'); }
      } finally { if (active) setProfileLoading(false); }
    }
    loadSavedProfile();
    return () => { active = false; };
  }, [session?.user?.id, navigate, retryProfile]);
  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
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
      const measurementError = validateMeasurements({ age: form.age, height_cm: form.height, weight_kg: form.weight });
      if (measurementError) return fail(measurementError);
      if (!form.fullName.trim()) return fail('Please enter your full name.');
      if (!form.age) return fail('Please enter your age.');
      if (!isSexChoice(form.sex)) return fail('Choose Male, Female or Prefer not to say.');
      if (!form.height) return fail('Please enter your height.');
      if (!form.weight) return fail('Please enter your weight.');
      if (!form.activity) return fail('Please select your activity level.');
    }
    if (step === 2) {
      const goalError = healthGoalError(form);
      if (goalError) return fail(goalError);
    }
    return true;
  }
  function fail(msg) {
    setError(msg);
    return false;
  }
  function goBack() {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
      setError('');
    }
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
  async function submitProfile() {
    if (profileLoading || profileLoadError || saving) return;
    if (!validateStep(1) || !validateStep(2)) { setCurrentStep(1); return; }
    setSaving(true);
    const dietary = [...form.dietary];
    if (form.dietaryOther.trim()) dietary.push(entryKey(form.dietaryOther, dietaryList));
    const medical = [...form.medical];
    if (form.medicalOther.trim()) medical.push(entryKey(form.medicalOther, medicalList));
    const allergies = [...form.allergies];
    if (form.allergiesOther.trim()) allergies.push(entryKey(form.allergiesOther, allergyList));
    const { error: dbError } = await saveHealthProfile(supabase, {
      id: session.user.id,
      full_name: form.fullName.trim(),
      age: parseInt(form.age),
      sex: form.sex,
      height_cm: parseFloat(form.height),
      weight_kg: parseFloat(form.weight),
      activity_level: form.activity,
      ...healthGoalFields(form),
      dietary_restrictions: dietary,
      medical_conditions: medical,
      allergies,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (dbError) {
      setError('Could not save: ' + dbError.message);
      return;
    }
    window.dispatchEvent(new Event('blane-profile-saved'));
    navigate(REDIRECT_AFTER_ONBOARD, { replace: true });
  }
  const progressPct = Math.round(((currentStep - 1) / TOTAL_STEPS) * 100);
  if (profileLoading || profileLoadError) {
    return React.createElement('main', { className: 'onboard-card', style: { margin: '90px auto', maxWidth: 600, padding: 32 } },
      React.createElement('h1', null, profileLoading ? 'Loading your saved profile…' : 'Could not load your profile'),
      React.createElement('p', { role: profileLoadError ? 'alert' : 'status' }, profileLoadError ? error : 'Checking your existing details before setup.'),
      profileLoadError && React.createElement('button', { className: 'btn btn-primary', type: 'button', onClick: () => setRetryProfile(value => value + 1) }, 'Try again'));
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      { className: 'onboard-topbar' },
      React.createElement(
        'a',
        { href: '/', className: 'logo' },
        React.createElement(
          'div',
          { className: 'logo-icon' },
          React.createElement(
            'svg',
            { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
            React.createElement('path', {
              d: 'M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z',
            }),
          ),
        ),
        React.createElement(
          'span',
          { className: 'logo-text' },
          React.createElement('span', null, 'BL'),
          'ANE',
        ),
      ),
      React.createElement(
        'span',
        { className: 'onboard-step-label' },
        'Step ',
        React.createElement('span', null, currentStep),
        ' \u2014 ',
        React.createElement('span', null, STEP_LABELS[currentStep - 1]),
      ),
      React.createElement(
        'button',
        {
          className: 'btn btn-outline',
          style: { fontSize: '13px', padding: '7px 16px' },
          onClick: logout,
        },
        'Sign out',
      ),
    ),
    React.createElement(
      'main',
      { className: 'onboard-page' },
      React.createElement(
        'div',
        { className: 'onboard-progress-wrap' },
        React.createElement(
          'div',
          { className: 'onboard-progress-bar' },
          React.createElement('div', {
            className: 'onboard-progress-fill',
            style: { width: progressPct + '%' },
          }),
        ),
        React.createElement(
          'div',
          { className: 'onboard-progress-text' },
          'Step ',
          currentStep,
          ' of ',
          TOTAL_STEPS,
        ),
      ),
      React.createElement(
        'div',
        { className: 'onboard-card' },
        error &&
          React.createElement('p', { className: 'form-error', style: { display: 'block' } }, error),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 1 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1F464}'),
          React.createElement('h2', null, 'Tell us about yourself'),
          React.createElement(
            'p',
            { className: 'sub' },
            'We use this to calculate your personal nutrition targets accurately.',
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, 'Full name'),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              placeholder: 'e.g. Juan dela Cruz',
              value: form.fullName,
              onChange: (e) => updateField('fullName', e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'form-row' },
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement('label', { className: 'form-label' }, 'Age'),
              React.createElement('input', {
                className: 'form-input',
                type: 'number',
                placeholder: 'e.g. 24',
                min: '1',
                max: '120',
                value: form.age,
                onChange: (e) => updateField('age', e.target.value),
              }),
            ),
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement('label', { className: 'form-label' }, 'Biological sex'),
              React.createElement(
                'select',
                {
                  className: 'form-select',
                  value: form.sex,
                  onChange: (e) => updateField('sex', e.target.value),
                },
                React.createElement('option', { value: '' }, 'Select...'),
                SEX_CHOICES.map(choice => React.createElement('option', { key: choice.value, value: choice.value }, choice.label)),
              ),
              React.createElement('p', { className: 'sub', style: { marginTop: 8, fontSize: 12 } }, UNDISCLOSED_SEX_NOTE),
            ),
          ),
          React.createElement(
            'div',
            { className: 'form-row' },
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement('label', { className: 'form-label' }, 'Height (cm)'),
              React.createElement('input', {
                className: 'form-input',
                type: 'number',
                placeholder: 'e.g. 168',
                min: '50',
                max: '250',
                value: form.height,
                onChange: (e) => updateField('height', e.target.value),
              }),
            ),
            React.createElement(
              'div',
              { className: 'form-group' },
              React.createElement('label', { className: 'form-label' }, 'Weight (kg)'),
              React.createElement('input', {
                className: 'form-input',
                type: 'number',
                placeholder: 'e.g. 65',
                min: '10',
                max: '500',
                step: '0.1',
                value: form.weight,
                onChange: (e) => updateField('weight', e.target.value),
              }),
            ),
          ),
          React.createElement(
            'div',
            { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, 'Activity level'),
            React.createElement(
              'select',
              {
                className: 'form-select',
                value: form.activity,
                onChange: (e) => updateField('activity', e.target.value),
              },
              React.createElement('option', { value: '' }, 'Select...'),
              React.createElement(
                'option',
                { value: 'sedentary' },
                'Sedentary (little or no exercise)',
              ),
              React.createElement('option', { value: 'light' }, 'Lightly active (1-3 days/week)'),
              React.createElement(
                'option',
                { value: 'moderate' },
                'Moderately active (3-5 days/week)',
              ),
              React.createElement(
                'option',
                { value: 'very_active' },
                'Very active (6-7 days/week)',
              ),
              React.createElement(
                'option',
                { value: 'extra_active' },
                'Extra active (physical job or 2x training)',
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 2 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1F3AF}'),
          React.createElement('h2', null, 'What are your health goals?'),
          React.createElement(HealthGoalPicker, {
            options: goalsList, value: form, disabled: saving,
            onChange: next => setForm(previous => ({ ...previous, ...next })),
          }),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 3 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1F957}'),
          React.createElement('h2', null, 'Any dietary restrictions?'),
          React.createElement(
            'p',
            { className: 'sub' },
            'Select your restrictions to guide ingredient checks. Review meal warnings before choosing. Skip if none apply.',
          ),
          React.createElement(
            'div',
            { className: 'tag-grid' },
            dietaryList.map((opt) =>
              React.createElement(
                'div',
                {
                  key: opt.key,
                  className: 'tag-pill' + (form.dietary.includes(opt.key) ? ' selected' : ''),
                  onClick: () => toggleTag('dietary', opt.key),
                },
                React.createElement('span', { className: 'tag-pill-icon' }, opt.icon),
                ' ',
                opt.label,
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'form-group', style: { marginTop: '18px' } },
            React.createElement(
              'label',
              { className: 'form-label' },
              'Other restrictions (optional)',
            ),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              placeholder: 'e.g. No pork, No MSG...',
              value: form.dietaryOther,
              onChange: (e) => updateField('dietaryOther', e.target.value),
            }),
            customNotice(form.dietaryOther, dietaryList),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 4 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1FA7A}'),
          React.createElement('h2', null, 'Any health conditions or prescribed diets?'),
          React.createElement(
            'p',
            { className: 'sub' },
            MEDICAL_CONDITION_GUIDANCE,
          ),
          React.createElement(
            'div',
            { className: 'tag-grid medical-options-grid' },
            medicalList.map((opt) =>
              React.createElement(
                'button',
                {
                  key: opt.key,
                  type: 'button',
                  'aria-pressed': form.medical.includes(opt.key),
                  className: 'tag-pill medical-option' + (form.medical.includes(opt.key) ? ' selected' : ''),
                  onClick: () => toggleTag('medical', opt.key),
                },
                React.createElement('span', { className: 'tag-pill-icon' }, opt.icon),
                ' ',
                React.createElement(MedicalConditionLabel, { option: opt }),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'form-group', style: { marginTop: '18px' } },
            React.createElement('label', { className: 'form-label' }, 'Other condition (optional)'),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              placeholder: 'Enter another diagnosed condition',
              value: form.medicalOther,
              onChange: (e) => updateField('medicalOther', e.target.value),
            }),
            customNotice(form.medicalOther, medicalList),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 5 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u26A0\uFE0F'),
          React.createElement('h2', null, 'Do you have any food allergies?'),
          React.createElement(
            'p',
            { className: 'sub' },
            ALLERGY_GUIDANCE,
          ),
          React.createElement(
            'div',
            { className: 'tag-grid medical-options-grid' },
            allergyList.map((opt) =>
              React.createElement(
                'button',
                {
                  key: opt.key,
                  type: 'button',
                  'aria-pressed': form.allergies.includes(opt.key),
                  className: 'tag-pill medical-option' + (form.allergies.includes(opt.key) ? ' selected' : ''),
                  onClick: () => toggleTag('allergies', opt.key),
                },
                React.createElement(AllergyLabel, { option: opt }),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'form-group', style: { marginTop: '18px' } },
            React.createElement('label', { className: 'form-label' }, 'Other allergy (optional)'),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              placeholder: 'Enter another food allergy',
              value: form.allergiesOther,
              onChange: (e) => updateField('allergiesOther', e.target.value),
            }),
            customNotice(form.allergiesOther, allergyList),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-nav' },
          React.createElement(
            'button',
            {
              className: 'btn btn-outline',
              style: { visibility: currentStep === 1 ? 'hidden' : 'visible' },
              onClick: goBack,
            },
            '\u2190 Back',
          ),
          React.createElement(
            'button',
            { className: 'btn btn-primary', onClick: goNext, disabled: saving },
            saving ? 'Saving...' : currentStep === TOTAL_STEPS ? 'Finish & Save' : 'Continue',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'saving-overlay' + (saving ? ' active' : '') },
      React.createElement('div', { className: 'saving-spinner' }),
      React.createElement('p', { className: 'saving-text' }, 'Saving your profile...'),
    ),
  );
}
export { Onboarding as default };
