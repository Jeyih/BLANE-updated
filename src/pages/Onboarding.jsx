import React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, REDIRECT_AFTER_ONBOARD } from '../lib/supabase';
import '../styles/onboarding.css';
const TOTAL_STEPS = 5;
const STEP_LABELS = [
  'Basic Info',
  'Health Goals',
  'Dietary Restrictions',
  'Medical Conditions',
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
  const [goalsList, setGoalsList] = useState([]);
  const [dietaryList, setDietaryList] = useState([]);
  const [medicalList, setMedicalList] = useState([]);
  const [allergyList, setAllergyList] = useState([]);
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
      if (!form.age) return fail('Please enter your age.');
      if (!form.sex) return fail('Please select your biological sex.');
      if (!form.height) return fail('Please enter your height.');
      if (!form.weight) return fail('Please enter your weight.');
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
    setSaving(true);
    const dietary = [...form.dietary];
    if (form.dietaryOther.trim()) dietary.push(form.dietaryOther.trim());
    const medical = [...form.medical];
    if (form.medicalOther.trim()) medical.push(form.medicalOther.trim());
    const allergies = [...form.allergies];
    if (form.allergiesOther.trim()) allergies.push(form.allergiesOther.trim());
    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        full_name: form.fullName.trim(),
        age: parseInt(form.age),
        sex: form.sex,
        height_cm: parseFloat(form.height),
        weight_kg: parseFloat(form.weight),
        activity_level: form.activity,
        goal: form.goal,
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
    navigate(REDIRECT_AFTER_ONBOARD);
  }
  const progressPct = Math.round(((currentStep - 1) / TOTAL_STEPS) * 100);
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
                React.createElement('option', { value: 'male' }, 'Male'),
                React.createElement('option', { value: 'female' }, 'Female'),
              ),
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
          React.createElement('h2', null, 'What is your main goal?'),
          React.createElement(
            'p',
            { className: 'sub' },
            'BLANE tailors your calorie targets and macro ratios around this.',
          ),
          React.createElement(
            'div',
            { className: 'goal-grid' },
            goalsList.map((g) =>
              React.createElement(
                'div',
                {
                  key: g.key,
                  className: 'goal-card' + (form.goal === g.key ? ' selected' : ''),
                  onClick: () => toggleGoal(g.key),
                },
                React.createElement('span', { className: 'goal-card-icon' }, g.icon),
                React.createElement('span', { className: 'goal-card-label' }, g.label),
                React.createElement('span', { className: 'goal-card-desc' }, g.desc),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 3 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1F957}'),
          React.createElement('h2', null, 'Any dietary restrictions?'),
          React.createElement(
            'p',
            { className: 'sub' },
            'Select all that apply. BLANE will never suggest meals that violate these. Skip if none apply.',
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
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 4 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u{1FA7A}'),
          React.createElement('h2', null, 'Any medical conditions?'),
          React.createElement(
            'p',
            { className: 'sub' },
            'This helps BLANE avoid nutrients that may affect your condition. All data is private and stored securely. Skip if none apply.',
          ),
          React.createElement(
            'div',
            { className: 'tag-grid' },
            medicalList.map((opt) =>
              React.createElement(
                'div',
                {
                  key: opt.key,
                  className: 'tag-pill' + (form.medical.includes(opt.key) ? ' selected' : ''),
                  onClick: () => toggleTag('medical', opt.key),
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
            React.createElement('label', { className: 'form-label' }, 'Other condition (optional)'),
            React.createElement('input', {
              className: 'form-input',
              type: 'text',
              placeholder: "e.g. Lupus, Crohn's disease...",
              value: form.medicalOther,
              onChange: (e) => updateField('medicalOther', e.target.value),
            }),
          ),
        ),
        React.createElement(
          'div',
          { className: 'onboard-step' + (currentStep === 5 ? ' active' : '') },
          React.createElement('div', { className: 'onboard-step-icon' }, '\u26A0\uFE0F'),
          React.createElement('h2', null, 'Any food allergies?'),
          React.createElement(
            'p',
            { className: 'sub' },
            'BLANE will block meals and ingredients containing these. Skip if none apply.',
          ),
          React.createElement(
            'div',
            { className: 'tag-grid' },
            allergyList.map((opt) =>
              React.createElement(
                'div',
                {
                  key: opt.key,
                  className: 'tag-pill' + (form.allergies.includes(opt.key) ? ' selected' : ''),
                  onClick: () => toggleTag('allergies', opt.key),
                },
                opt.label,
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
              placeholder: 'e.g. Shellfish, Peanuts...',
              value: form.allergiesOther,
              onChange: (e) => updateField('allergiesOther', e.target.value),
            }),
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
