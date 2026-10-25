import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useIngredientPrices } from '../context/PriceContext';
import { marketIngredientPriceText } from '../lib/pricing';
import { isAdmin } from '../lib/admin-auth';
import { loadConstraintDefinitions } from '../lib/constraints';
import PriceSourceStatus from '../components/PriceSourceStatus';
import '../styles/admin.css';
import '../styles/nav.css';
const MARKET_TYPES = [
  { value: 'palengke', label: 'Palengke' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'talipapa', label: 'Talipapa' },
  { value: 'grocery', label: 'Grocery' },
];
const RECIPE_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];
const RECIPE_DIFFICULTY = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];
const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
];
const GOAL_OPTIONS = [
  { value: 'lose_weight', label: 'Lose Weight' },
  { value: 'gain_muscle', label: 'Gain Muscle' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'improve_health', label: 'Improve Health' },
  { value: 'boost_energy', label: 'Boost Energy' },
  { value: 'manage_condition', label: 'Manage Condition' },
];
const OPTION_GROUPS = [
  { key: 'goals', label: 'Goals' },
  { key: 'dietary', label: 'Dietary' },
  { key: 'medical', label: 'Medical' },
  { key: 'allergy', label: 'Allergy' },
];
const SEASONS = [
  { value: 'dry', label: 'Dry Season' },
  { value: 'wet', label: 'Wet Season' },
  { value: 'both', label: 'Year-round / Both' },
];
const EMPTY_OPTION = {
  id: '',
  group: 'goals',
  key: '',
  label: '',
  description: '',
  sort_order: 0,
  active: true,
};
const EMPTY_MARKET = {
  id: '',
  name: '',
  type: 'palengke',
  icon: '\u{1F3EA}',
  lat: '',
  lng: '',
  address: '',
  hours: '',
  open: true,
};
const MARKET_ICON_CHOICES = [
  '\u{1F3EA}',
  '\u{1F3EC}',
  '\u{1F6D2}',
  '\u{1F955}',
  '\u{1F41F}',
  '\u{1F356}',
  '\u{1F33E}',
  '\u{1F9FA}',
];
const EMPTY_MARKET_ING = { name: '', qty: '', price: '', status: 'avail' };
const EMPTY_RECIPE = {
  id: '',
  name: '',
  type: 'Breakfast',
  difficulty: 'easy',
  cookTime: '15',
  servings: '1',
  cost: '0',
  dietTags: [],
  goalTags: [],
};
const EMPTY_RECIPE_ING = { fct_id: '', name: '', grams: '', quantity: '', status: 'avail' };
const EMPTY_RECIPE_STEP = { title: '', description: '', timer: '' };
const EMPTY_FNRI = {
  fct_id: '',
  food_name: '',
  alternate_name: '',
  energy_kcal: '',
  protein_g: '',
  total_fat_g: '',
  available_carbohydrate_g: '',
};
function Admin() {
  const { user, loading, logout } = useAuth();
  const { records: priceRecords, referenceData } = useIngredientPrices();
  const navigate = useNavigate();
  const [adminStatus, setAdminStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState('markets');
  const [markets, setMarkets] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fnriItems, setFnriItems] = useState([]);
  const [feedbackRecords, setFeedbackRecords] = useState([]);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [searchMarkets, setSearchMarkets] = useState('');
  const [searchRecipes, setSearchRecipes] = useState('');
  const [searchFnri, setSearchFnri] = useState('');
  const [searchOptions, setSearchOptions] = useState('');
  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [marketModalMode, setMarketModalMode] = useState('add');
  const [marketForm, setMarketForm] = useState(EMPTY_MARKET);
  const [marketIngredients, setMarketIngredients] = useState([EMPTY_MARKET_ING]);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeModalMode, setRecipeModalMode] = useState('add');
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [recipeIngredients, setRecipeIngredients] = useState([EMPTY_RECIPE_ING]);
  const [recipeSteps, setRecipeSteps] = useState([EMPTY_RECIPE_STEP]);
  const [ingredientSearchIndex, setIngredientSearchIndex] = useState(null);
  const [ingredientSearchResults, setIngredientSearchResults] = useState([]);
  const [fnriNutrientCache, setFnriNutrientCache] = useState({});
  const ingredientSearchTimeout = useRef(null);
  const [fnriModalOpen, setFnriModalOpen] = useState(false);
  const [fnriModalMode, setFnriModalMode] = useState('add');
  const [fnriForm, setFnriForm] = useState(EMPTY_FNRI);
  const [optionLists, setOptionLists] = useState([]);
  const [optionGroup, setOptionGroup] = useState('goals');
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [optionModalMode, setOptionModalMode] = useState('add');
  const [optionForm, setOptionForm] = useState(EMPTY_OPTION);
  const [constraintDefs, setConstraintDefs] = useState([]);
  const [constraintSearch, setConstraintSearch] = useState('');
  const [constraintModalOpen, setConstraintModalOpen] = useState(false);
  const [constraintModalMode, setConstraintModalMode] = useState('add');
  const [constraintForm, setConstraintForm] = useState({
    id: '',
    key: '',
    label: '',
    severity: 'dietary',
    reason: '',
    blocked: '',
    sort_order: 0,
    active: true,
  });
  const [seasonRecords, setSeasonRecords] = useState([]);
  const [seasonSearch, setSeasonSearch] = useState('');
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [seasonModalMode, setSeasonModalMode] = useState('add');
  const [seasonForm, setSeasonForm] = useState({
    id: '',
    ingredient_name: '',
    season: 'dry',
    alt: '',
    sort_order: 0,
    active: true,
  });
  const [toast, setToast] = useState({ message: '', error: false, visible: false });
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setAdminStatus('denied');
      return;
    }
    let cancelled = false;
    setAdminStatus('checking');
    isAdmin(user)
      .then((allowed) => {
        if (!cancelled) setAdminStatus(allowed ? 'allowed' : 'denied');
      })
      .catch((error) => {
        console.error('Unable to verify administrator access:', error);
        if (!cancelled) setAdminStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);
  useEffect(() => {
    if (!user || loading || adminStatus !== 'allowed') return;
    loadAllData();
  }, [user, loading, adminStatus]);
  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3e3);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);
  const filteredMarkets = useMemo(() => {
    const query = searchMarkets.toLowerCase();
    return markets.filter((market) => market.name.toLowerCase().includes(query));
  }, [markets, searchMarkets]);
  const filteredRecipes = useMemo(() => {
    const query = searchRecipes.toLowerCase();
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query));
  }, [recipes, searchRecipes]);
  const computedNutrition = useMemo(() => {
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;
    recipeIngredients.forEach((ing) => {
      const nutrient = ing.fct_id ? fnriNutrientCache[ing.fct_id] : null;
      const grams = parseFloat(ing.grams) || 0;
      if (nutrient && grams > 0) {
        const factor = grams / 100;
        kcal += (parseFloat(nutrient.energy_kcal) || 0) * factor;
        protein += (parseFloat(nutrient.protein_g) || 0) * factor;
        carbs += (parseFloat(nutrient.available_carbohydrate_g) || 0) * factor;
        fats += (parseFloat(nutrient.total_fat_g) || 0) * factor;
      }
    });
    const servings = parseInt(recipeForm.servings, 10) || 1;
    const round1 = (n) => Math.round(n * 10) / 10;
    return {
      totalKcal: Math.round(kcal),
      totalProtein: round1(protein),
      totalCarbs: round1(carbs),
      totalFats: round1(fats),
      kcal: Math.round(kcal / servings),
      protein: round1(protein / servings),
      carbs: round1(carbs / servings),
      fats: round1(fats / servings),
      unlinkedCount: recipeIngredients.filter((ing) => ing.name.trim() && !ing.fct_id).length,
    };
  }, [recipeIngredients, fnriNutrientCache, recipeForm.servings]);
  const filteredFnri = useMemo(() => {
    const query = searchFnri.toLowerCase();
    return fnriItems.filter(
      (item) =>
        item.food_name.toLowerCase().includes(query) ||
        (item.alternate_name || '').toLowerCase().includes(query),
    );
  }, [fnriItems, searchFnri]);
  const filteredOptionLists = useMemo(() => {
    const query = searchOptions.toLowerCase();
    return optionLists
      .filter((item) => item.group === optionGroup)
      .filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.key.toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query),
      );
  }, [optionLists, optionGroup, searchOptions]);
  const filteredConstraintDefs = useMemo(() => {
    const query = constraintSearch.toLowerCase();
    return constraintDefs.filter(
      (item) =>
        item.key.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.severity.toLowerCase().includes(query) ||
        (item.reason || '').toLowerCase().includes(query),
    );
  }, [constraintDefs, constraintSearch]);
  const filteredSeasonRecords = useMemo(() => {
    const query = seasonSearch.toLowerCase();
    return seasonRecords.filter(
      (item) =>
        item.ingredient_name.toLowerCase().includes(query) ||
        item.season.toLowerCase().includes(query) ||
        (item.alt || '').toLowerCase().includes(query),
    );
  }, [seasonRecords, seasonSearch]);
  async function loadAllData() {
    await Promise.all([
      loadMarkets(),
      loadRecipes(),
      loadFnri(),
      loadOptionLists(),
      loadConstraintDefs(),
      loadSeasonRecords(),
    ]);
  }
  async function loadFeedback() {
    setFeedbackLoading(true);
    try {
      const pageSize = 500;
      const allFeedback = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from('feedback')
          .select('id, sender_name, category, message, page_path, created_at')
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        allFeedback.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      setFeedbackRecords(allFeedback);
    } catch (error) {
      showToast('Error loading feedback: ' + error.message, true);
    } finally {
      setFeedbackLoading(false);
    }
  }
  async function openFeedbackModal() {
    setFeedbackModalOpen(true);
    await loadFeedback();
  }
  useEffect(() => {
    if (!feedbackModalOpen) return void 0;
    function handleFeedbackModalKeyDown(event) {
      if (event.key === 'Escape') setFeedbackModalOpen(false);
    }
    document.addEventListener('keydown', handleFeedbackModalKeyDown);
    return () => document.removeEventListener('keydown', handleFeedbackModalKeyDown);
  }, [feedbackModalOpen]);
  if (loading || adminStatus === 'checking') {
    return React.createElement(
      'div',
      {
        style: {
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060d0a',
          color: '#4d6e5a',
        },
      },
      'Loading admin panel\u2026',
    );
  }
  if (adminStatus === 'error') {
    return React.createElement(
      'div',
      {
        role: 'alert',
        style: {
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060d0a',
          color: '#fca5a5',
        },
      },
      'Unable to verify administrator access. Please try again later.',
    );
  }
  if (!user || adminStatus === 'denied') {
    return React.createElement(Navigate, { to: '/dashboard', replace: true });
  }
  async function loadMarkets() {
    const { data, error } = await supabase.from('markets').select('*').order('name');
    if (error) {
      showToast('Error loading markets: ' + error.message, true);
      return;
    }
    setMarkets(data || []);
  }
  async function loadRecipes() {
    const { data, error } = await supabase.from('recipes').select('*').order('name');
    if (error) {
      showToast('Error loading recipes: ' + error.message, true);
      return;
    }
    setRecipes(data || []);
  }
  async function loadFnri() {
    const { data, error } = await supabase
      .from('fnri_food_composition')
      .select('*')
      .order('food_name');
    if (error) {
      showToast('Error loading FNRI items: ' + error.message, true);
      return;
    }
    setFnriItems(data || []);
  }
  async function loadOptionLists() {
    const { data, error } = await supabase
      .from('option_lists')
      .select('*')
      .order('group')
      .order('sort_order');
    if (error) {
      showToast('Error loading onboarding options: ' + error.message, true);
      setOptionLists([]);
      return;
    }
    const optionRows = data || [];
    let goalRows = optionRows.filter((row) => row.group === 'goals');
    try {
      const { data: goalIdealsData, error: goalIdealsError } = await supabase
        .from('goal_ideals')
        .select('*')
        .order('goal_key');
      if (!goalIdealsError && goalIdealsData) {
        const goalMap = new Map(goalRows.map((row) => [row.key, row]));
        const missingGoalRows = (goalIdealsData || [])
          .filter((row) => row.goal_key && !goalMap.has(row.goal_key))
          .map((row) => ({
            id: row.id,
            group: 'goals',
            key: row.goal_key,
            label: GOAL_OPTIONS.find((opt) => opt.value === row.goal_key)?.label || row.goal_key,
            description: '',
            sort_order: 0,
            active: true,
          }));
        goalRows = [...goalRows, ...missingGoalRows];
      }
    } catch (syncErr) {
      console.warn('Goal option sync warning:', syncErr);
    }
    const merged = [...optionRows.filter((row) => row.group !== 'goals'), ...goalRows];
    setOptionLists(merged);
  }
  async function loadConstraintDefs() {
    const { data, error } = await supabase
      .from('constraint_definitions')
      .select('*')
      .order('sort_order');
    if (error) {
      showToast('Error loading constraint definitions: ' + error.message, true);
      return;
    }
    setConstraintDefs(data || []);
  }
  async function loadSeasonRecords() {
    const { data, error } = await supabase
      .from('ingredient_seasons')
      .select('*')
      .order('ingredient_name');
    if (error) {
      showToast('Error loading seasonal ingredients: ' + error.message, true);
      return;
    }
    setSeasonRecords(data || []);
  }
  function showToast(message, error = false) {
    setToast({ message, error, visible: true });
  }
  function closeMarketModal() {
    setMarketModalOpen(false);
    setMarketForm(EMPTY_MARKET);
    setMarketIngredients([EMPTY_MARKET_ING]);
  }
  function closeRecipeModal() {
    setRecipeModalOpen(false);
    setRecipeForm(EMPTY_RECIPE);
    setRecipeIngredients([{ ...EMPTY_RECIPE_ING }]);
    setRecipeSteps([EMPTY_RECIPE_STEP]);
    setIngredientSearchIndex(null);
    setIngredientSearchResults([]);
  }
  function closeFnriModal() {
    setFnriModalOpen(false);
    setFnriForm(EMPTY_FNRI);
  }
  function closeOptionModal() {
    setOptionModalOpen(false);
    setOptionForm(EMPTY_OPTION);
  }
  function openOptionModal(id, group = 'goals') {
    const item = optionLists.find((row) => row.id === id);
    if (!item) {
      setOptionModalMode('add');
      setOptionForm({ ...EMPTY_OPTION, group });
      setOptionModalOpen(true);
      return;
    }
    setOptionModalMode('edit');
    setOptionForm({
      id: item.id || '',
      group: item.group || group,
      key: item.key || '',
      label: item.label || '',
      description: item.description || '',
      sort_order: item.sort_order ?? 0,
      active: item.active ?? true,
    });
    setOptionModalOpen(true);
  }
  function handleOptionFormChange(key, value) {
    setOptionForm((prev) => ({ ...prev, [key]: value }));
  }
  async function saveOption() {
    if (!optionForm.key.trim() || !optionForm.label.trim()) {
      showToast('Please enter a key and label for this option.', true);
      return;
    }
    const id = optionForm.id || crypto.randomUUID?.() || 'opt-' + Date.now();
    const payload = {
      id,
      group: optionForm.group,
      key: optionForm.key.trim(),
      label: optionForm.label.trim(),
      description: optionForm.description.trim(),
      sort_order: parseInt(optionForm.sort_order, 10) || 0,
      active: !!optionForm.active,
    };
    const { error } = await supabase.from('option_lists').upsert(payload, { onConflict: 'id' });
    if (error) {
      showToast('Error saving option: ' + error.message, true);
      return;
    }
    if (optionForm.group === 'goals') {
      const { data: existingGoal } = await supabase
        .from('goal_ideals')
        .select('*')
        .eq('goal_key', payload.key)
        .maybeSingle();
      const goalIdealPayload = {
        id: existingGoal?.id || crypto.randomUUID?.() || 'goal-' + Date.now(),
        goal_key: payload.key,
        min_protein: existingGoal?.min_protein ?? 0,
        max_kcal: existingGoal?.max_kcal ?? 9999,
        max_fats: existingGoal?.max_fats ?? 9999,
        min_carbs: existingGoal?.min_carbs ?? 0,
        updated_at: new Date().toISOString(),
      };
      const { error: goalError } = await supabase
        .from('goal_ideals')
        .upsert(goalIdealPayload, { onConflict: 'goal_key' });
      if (goalError) {
        showToast('Option saved, but goal ideal sync failed: ' + goalError.message, true);
        return;
      }
    }
    showToast('\u2713 Option saved successfully');
    closeOptionModal();
    await loadOptionLists();
  }
  async function deleteOption(id) {
    if (!window.confirm('Delete this onboarding option? This cannot be undone.')) return;
    const { error } = await supabase.from('option_lists').delete().eq('id', id);
    if (error) {
      showToast('Error deleting option: ' + error.message, true);
      return;
    }
    showToast('\u2713 Option deleted');
    await loadOptionLists();
  }
  function openConstraintModal(id) {
    const item = constraintDefs.find((row) => row.id === id);
    if (!item) {
      setConstraintModalMode('add');
      setConstraintForm({
        id: '',
        key: '',
        label: '',
        severity: 'dietary',
        reason: '',
        blocked: '',
        sort_order: 0,
        active: true,
      });
      setConstraintModalOpen(true);
      return;
    }
    setConstraintModalMode('edit');
    setConstraintForm({
      id: item.id || '',
      key: item.key || '',
      label: item.label || '',
      severity: item.severity || 'dietary',
      reason: item.reason || '',
      blocked: Array.isArray(item.blocked) ? item.blocked.join(', ') : item.blocked || '',
      sort_order: item.sort_order ?? 0,
      active: item.active ?? true,
    });
    setConstraintModalOpen(true);
  }
  function handleConstraintFormChange(key, value) {
    setConstraintForm((prev) => ({ ...prev, [key]: value }));
  }
  async function saveConstraint() {
    if (!constraintForm.key.trim() || !constraintForm.label.trim()) {
      showToast('Please enter a key and label for this constraint.', true);
      return;
    }
    const id = constraintForm.id || crypto.randomUUID?.() || 'con-' + Date.now();
    const payload = {
      id,
      key: constraintForm.key.trim(),
      label: constraintForm.label.trim(),
      severity: constraintForm.severity,
      reason: constraintForm.reason.trim(),
      blocked: constraintForm.blocked
        ? constraintForm.blocked
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      sort_order: parseInt(constraintForm.sort_order, 10) || 0,
      active: !!constraintForm.active,
    };
    const { error } = await supabase
      .from('constraint_definitions')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      showToast('Error saving constraint: ' + error.message, true);
      return;
    }
    showToast('\u2713 Constraint saved successfully');
    setConstraintModalOpen(false);
    await loadConstraintDefs();
    await loadConstraintDefinitions();
    const syncGroup = payload.severity;
    if (['dietary', 'allergy', 'medical'].includes(syncGroup)) {
      const { data: existing } = await supabase
        .from('option_lists')
        .select('id')
        .eq('key', payload.key)
        .eq('group', syncGroup)
        .maybeSingle();
      const optionId = existing?.id || crypto.randomUUID?.() || 'opt-' + Date.now();
      const { error: syncError } = await supabase
        .from('option_lists')
        .upsert(
          {
            id: optionId,
            group: syncGroup,
            key: payload.key,
            label: payload.label,
            description: payload.reason || '',
            sort_order: payload.sort_order,
            active: payload.active,
          },
          { onConflict: 'id' },
        );
      if (syncError) {
        showToast(
          'Constraint saved but failed to sync onboarding option: ' + syncError.message,
          true,
        );
      }
      await loadOptionLists();
    }
  }
  async function deleteConstraint(id) {
    if (!window.confirm('Delete this constraint definition? This cannot be undone.')) return;
    const item = constraintDefs.find((row) => row.id === id);
    const { error } = await supabase.from('constraint_definitions').delete().eq('id', id);
    if (error) {
      showToast('Error deleting constraint: ' + error.message, true);
      return;
    }
    if (item && ['dietary', 'allergy', 'medical'].includes(item.severity)) {
      await supabase.from('option_lists').delete().eq('key', item.key).eq('group', item.severity);
    }
    showToast('\u2713 Constraint deleted');
    await loadConstraintDefs();
    await loadConstraintDefinitions();
    await loadOptionLists();
  }
  function openSeasonModal(id) {
    const item = seasonRecords.find((row) => row.id === id);
    if (!item) {
      setSeasonModalMode('add');
      setSeasonForm({
        id: '',
        ingredient_name: '',
        season: 'dry',
        alt: '',
        sort_order: 0,
        active: true,
      });
      setSeasonModalOpen(true);
      return;
    }
    setSeasonModalMode('edit');
    setSeasonForm({
      id: item.id || '',
      ingredient_name: item.ingredient_name || '',
      season: item.season || 'dry',
      alt: item.alt || '',
      sort_order: item.sort_order ?? 0,
      active: item.active ?? true,
    });
    setSeasonModalOpen(true);
  }
  function handleSeasonFormChange(key, value) {
    setSeasonForm((prev) => ({ ...prev, [key]: value }));
  }
  async function saveSeason() {
    if (!seasonForm.ingredient_name.trim()) {
      showToast('Please enter an ingredient name.', true);
      return;
    }
    const id = seasonForm.id || crypto.randomUUID?.() || 'sea-' + Date.now();
    const payload = {
      id,
      ingredient_name: seasonForm.ingredient_name.trim(),
      season: seasonForm.season,
      alt: seasonForm.alt.trim(),
      sort_order: parseInt(seasonForm.sort_order, 10) || 0,
      active: !!seasonForm.active,
    };
    const { error } = await supabase
      .from('ingredient_seasons')
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      showToast('Error saving seasonal ingredient: ' + error.message, true);
      return;
    }
    showToast('\u2713 Seasonal ingredient saved successfully');
    setSeasonModalOpen(false);
    await loadSeasonRecords();
  }
  async function deleteSeason(id) {
    if (!window.confirm('Delete this seasonal ingredient record? This cannot be undone.')) return;
    const { error } = await supabase.from('ingredient_seasons').delete().eq('id', id);
    if (error) {
      showToast('Error deleting seasonal ingredient: ' + error.message, true);
      return;
    }
    showToast('\u2713 Seasonal ingredient deleted');
    await loadSeasonRecords();
  }
  function openMarketModal(id) {
    const market = markets.find((item) => item.id === id);
    if (!market) {
      setMarketModalMode('add');
      setMarketForm(EMPTY_MARKET);
      setMarketIngredients([EMPTY_MARKET_ING]);
      setMarketModalOpen(true);
      return;
    }
    setMarketModalMode('edit');
    setMarketForm({
      id: market.id,
      name: market.name || '',
      type: market.type || 'palengke',
      icon: market.icon || '\u{1F3EA}',
      lat: market.lat ?? '',
      lng: market.lng ?? '',
      address: market.address || '',
      hours: market.hours || '',
      open: market.is_open ?? true,
    });
    setMarketModalOpen(true);
    loadMarketIngredients(market.id);
  }
  async function loadMarketIngredients(marketId) {
    const { data, error } = await supabase
      .from('market_ingredients')
      .select('*')
      .eq('market_id', marketId)
      .order('name');
    if (error) {
      showToast('Error loading market ingredients: ' + error.message, true);
      return;
    }
    setMarketIngredients(
      (data || []).map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        status: item.status,
      })),
    );
  }
  function handleMarketFormChange(key, value) {
    setMarketForm((prev) => ({ ...prev, [key]: value }));
  }
  function updateMarketIngredient(index, key, value) {
    setMarketIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }
  function addMarketIngredientRow() {
    setMarketIngredients((prev) => [...prev, { ...EMPTY_MARKET_ING }]);
  }
  function removeMarketIngredientRow(index) {
    setMarketIngredients((prev) => prev.filter((_, idx) => idx !== index));
  }
  async function saveMarket() {
    const id = marketForm.id || crypto.randomUUID?.() || 'mk-' + Date.now();
    if (!marketForm.name.trim() || !marketForm.lat || !marketForm.lng) {
      showToast('Please fill in name, latitude, and longitude.', true);
      return;
    }
    const marketPayload = {
      id,
      name: marketForm.name.trim(),
      type: marketForm.type,
      icon: marketForm.icon || '\u{1F3EA}',
      lat: parseFloat(marketForm.lat) || null,
      lng: parseFloat(marketForm.lng) || null,
      address: marketForm.address.trim(),
      hours: marketForm.hours.trim(),
      is_open: Boolean(marketForm.open),
      updated_at: new Date().toISOString(),
    };
    const { error: marketError } = await supabase
      .from('markets')
      .upsert(marketPayload, { onConflict: 'id' });
    if (marketError) {
      showToast('Error saving market: ' + marketError.message, true);
      return;
    }
    await supabase.from('market_ingredients').delete().eq('market_id', id);
    const ingredientsToInsert = marketIngredients
      .filter((item) => item.name.trim())
      .map((item) => ({
        market_id: id,
        name: item.name.trim(),
        qty: item.qty.trim(),
        price: parseFloat(item.price) || 0,
        status: item.status,
      }));
    if (ingredientsToInsert.length > 0) {
      const { error: ingredientsError } = await supabase
        .from('market_ingredients')
        .insert(ingredientsToInsert);
      if (ingredientsError) {
        showToast('Error saving market ingredients: ' + ingredientsError.message, true);
        return;
      }
    }
    showToast('\u2713 Market saved successfully');
    window.dispatchEvent(new Event('blane-prices-updated'));
    closeMarketModal();
    await loadMarkets();
  }
  async function deleteMarket(id) {
    if (!window.confirm('Delete this market and its prices? This cannot be undone.')) return;
    await supabase.from('market_ingredients').delete().eq('market_id', id);
    const { error } = await supabase.from('markets').delete().eq('id', id);
    if (error) {
      showToast('Error deleting market: ' + error.message, true);
      return;
    }
    showToast('\u2713 Market deleted');
    window.dispatchEvent(new Event('blane-prices-updated'));
    await loadMarkets();
  }
  function openRecipeModal(id) {
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) {
      setRecipeModalMode('add');
      setRecipeForm(EMPTY_RECIPE);
      setRecipeIngredients([{ ...EMPTY_RECIPE_ING }]);
      setRecipeSteps([EMPTY_RECIPE_STEP]);
      setRecipeModalOpen(true);
      return;
    }
    setRecipeModalMode('edit');
    setRecipeForm({
      id: recipe.id,
      name: recipe.name || '',
      type: recipe.type || 'Breakfast',
      difficulty: recipe.difficulty || 'easy',
      cookTime: recipe.cook_time_min?.toString() || '15',
      servings: recipe.servings?.toString() || '1',
      cost: recipe.cost?.toString() || '0',
      dietTags: recipe.diet_tags || [],
      goalTags: recipe.goal_tags || [],
    });
    setRecipeModalOpen(true);
    loadRecipeDetails(recipe.id);
  }
  async function loadRecipeDetails(recipeId) {
    const [ingRes, stepRes] = await Promise.all([
      supabase.from('recipe_ingredients').select('*').eq('recipe_id', recipeId).order('sort_order'),
      supabase.from('recipe_steps').select('*').eq('recipe_id', recipeId).order('step_order'),
    ]);
    if (ingRes.error) {
      showToast('Error loading recipe ingredients: ' + ingRes.error.message, true);
      return;
    }
    if (stepRes.error) {
      showToast('Error loading recipe steps: ' + stepRes.error.message, true);
      return;
    }
    setRecipeIngredients(
      (ingRes.data || []).map((item) => ({
        id: item.id,
        fct_id: item.fct_id || '',
        name: item.name,
        grams: item.grams?.toString() || '',
        quantity: item.quantity?.toString() || '',
        status: item.status,
      })),
    );
    setRecipeSteps(
      (stepRes.data || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        timer: item.timer_seconds?.toString() || '',
      })),
    );
    const linkedFctIds = [
      ...new Set((ingRes.data || []).map((item) => item.fct_id).filter(Boolean)),
    ];
    if (linkedFctIds.length > 0) {
      const { data: nutrientRows, error: nutrientError } = await supabase
        .from('fnri_food_composition')
        .select('fct_id, food_name, energy_kcal, protein_g, total_fat_g, available_carbohydrate_g')
        .in('fct_id', linkedFctIds);
      if (!nutrientError && nutrientRows) {
        setFnriNutrientCache((prev) => {
          const next = { ...prev };
          nutrientRows.forEach((row) => {
            next[row.fct_id] = row;
          });
          return next;
        });
      }
    }
  }
  function handleRecipeFormChange(key, value) {
    setRecipeForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggleRecipeTag(field, value) {
    setRecipeForm((prev) => {
      const values = prev[field] || [];
      return {
        ...prev,
        [field]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  }
  function updateRecipeIngredient(index, key, value) {
    setRecipeIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }
  async function searchFnriForIngredient(index, query) {
    if (!query || query.trim().length < 2) {
      setIngredientSearchResults([]);
      return;
    }
    const { data, error } = await supabase
      .from('fnri_food_composition')
      .select(
        'fct_id, food_name, alternate_name, energy_kcal, protein_g, total_fat_g, available_carbohydrate_g',
      )
      .ilike('food_name', `%${query.trim()}%`)
      .order('food_name')
      .limit(8);
    if (error) {
      showToast('Error searching FNRI data: ' + error.message, true);
      return;
    }
    setIngredientSearchIndex((current) => {
      if (current === index) setIngredientSearchResults(data || []);
      return current;
    });
  }
  function handleIngredientNameChange(index, value) {
    setRecipeIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value, fct_id: '' };
      return next;
    });
    setIngredientSearchIndex(index);
    if (ingredientSearchTimeout.current) clearTimeout(ingredientSearchTimeout.current);
    ingredientSearchTimeout.current = setTimeout(() => {
      searchFnriForIngredient(index, value);
    }, 300);
  }
  function selectFnriForIngredient(index, item) {
    setRecipeIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], fct_id: item.fct_id, name: item.food_name };
      return next;
    });
    setFnriNutrientCache((prev) => ({ ...prev, [item.fct_id]: item }));
    setIngredientSearchIndex(null);
    setIngredientSearchResults([]);
  }
  function clearIngredientLink(index) {
    setRecipeIngredients((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], fct_id: '', name: '' };
      return next;
    });
  }
  function addRecipeIngredientRow() {
    setRecipeIngredients((prev) => [...prev, { ...EMPTY_RECIPE_ING }]);
  }
  function removeRecipeIngredientRow(index) {
    setRecipeIngredients((prev) => prev.filter((_, idx) => idx !== index));
  }
  function updateRecipeStep(index, key, value) {
    setRecipeSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }
  function addRecipeStepRow() {
    setRecipeSteps((prev) => [...prev, { ...EMPTY_RECIPE_STEP }]);
  }
  function removeRecipeStepRow(index) {
    setRecipeSteps((prev) => prev.filter((_, idx) => idx !== index));
  }
  async function saveRecipe() {
    if (!recipeForm.name.trim()) {
      showToast('Please enter a recipe name.', true);
      return;
    }
    const id = recipeForm.id || crypto.randomUUID?.() || 'rcp-' + Date.now();
    const payload = {
      id,
      name: recipeForm.name.trim(),
      type: recipeForm.type,
      difficulty: recipeForm.difficulty,
      cook_time_min: parseInt(recipeForm.cookTime) || 0,
      servings: parseInt(recipeForm.servings) || 1,
      cost: parseFloat(recipeForm.cost) || 0,
      kcal: computedNutrition.kcal,
      protein_g: computedNutrition.protein,
      carbs_g: computedNutrition.carbs,
      fats_g: computedNutrition.fats,
      diet_tags: recipeForm.dietTags,
      goal_tags: recipeForm.goalTags,
      updated_at: new Date().toISOString(),
    };
    const { error: recipeError } = await supabase
      .from('recipes')
      .upsert(payload, { onConflict: 'id' });
    if (recipeError) {
      showToast('Error saving recipe: ' + recipeError.message, true);
      return;
    }
    const { error: ingredientDeleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id);
    if (ingredientDeleteError) {
      showToast('Error replacing recipe ingredients: ' + ingredientDeleteError.message, true);
      return;
    }
    const ingredientsToInsert = recipeIngredients
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        recipe_id: id,
        fct_id: item.fct_id || null,
        name: item.name.trim(),
        grams: parseFloat(item.grams) || 0,
        quantity: item.quantity.trim() || null,
        status: item.status,
        sort_order: index + 1,
      }));
    if (ingredientsToInsert.length > 0) {
      const { error: ingError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientsToInsert);
      if (ingError) {
        showToast('Error saving recipe ingredients: ' + ingError.message, true);
        return;
      }
    }
    const { error: stepDeleteError } = await supabase
      .from('recipe_steps')
      .delete()
      .eq('recipe_id', id);
    if (stepDeleteError) {
      showToast('Error replacing recipe steps: ' + stepDeleteError.message, true);
      return;
    }
    const stepsToInsert = recipeSteps
      .filter((step) => step.title.trim())
      .map((step, index) => ({
        recipe_id: id,
        step_order: index + 1,
        title: step.title.trim(),
        description: step.description.trim(),
        timer_seconds: parseInt(step.timer) || null,
      }));
    if (stepsToInsert.length > 0) {
      const { error: stepError } = await supabase.from('recipe_steps').insert(stepsToInsert);
      if (stepError) {
        showToast('Error saving recipe steps: ' + stepError.message, true);
        return;
      }
    }
    showToast('\u2713 Recipe saved successfully');
    closeRecipeModal();
    await loadRecipes();
  }
  async function deleteRecipe(id) {
    if (
      !window.confirm('Delete this recipe and all of its ingredients/steps? This cannot be undone.')
    )
      return;
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
    await supabase.from('recipe_steps').delete().eq('recipe_id', id);
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      showToast('Error deleting recipe: ' + error.message, true);
      return;
    }
    showToast('\u2713 Recipe deleted');
    await loadRecipes();
  }
  function openFnriModal(fctId) {
    const item = fnriItems.find((row) => row.fct_id === fctId);
    if (!item) {
      setFnriModalMode('add');
      setFnriForm(EMPTY_FNRI);
      setFnriModalOpen(true);
      return;
    }
    setFnriModalMode('edit');
    setFnriForm({
      fct_id: item.fct_id || '',
      food_name: item.food_name || '',
      alternate_name: item.alternate_name || '',
      energy_kcal: item.energy_kcal?.toString() || '',
      protein_g: item.protein_g?.toString() || '',
      total_fat_g: item.total_fat_g?.toString() || '',
      available_carbohydrate_g: item.available_carbohydrate_g?.toString() || '',
    });
    setFnriModalOpen(true);
  }
  async function saveFnri() {
    if (!fnriForm.fct_id.trim() || !fnriForm.food_name.trim()) {
      showToast('Please enter FCT ID and food name.', true);
      return;
    }
    const payload = {
      fct_id: fnriForm.fct_id.trim(),
      food_name: fnriForm.food_name.trim(),
      alternate_name: fnriForm.alternate_name.trim(),
      energy_kcal: fnriForm.energy_kcal ? parseFloat(fnriForm.energy_kcal) : null,
      protein_g: fnriForm.protein_g ? parseFloat(fnriForm.protein_g) : null,
      total_fat_g: fnriForm.total_fat_g ? parseFloat(fnriForm.total_fat_g) : null,
      available_carbohydrate_g: fnriForm.available_carbohydrate_g
        ? parseFloat(fnriForm.available_carbohydrate_g)
        : null,
    };
    const { error } = await supabase
      .from('fnri_food_composition')
      .upsert(payload, { onConflict: 'fct_id' });
    if (error) {
      showToast('Error saving FNRI item: ' + error.message, true);
      return;
    }
    showToast('\u2713 Food item saved successfully');
    closeFnriModal();
    await loadFnri();
  }
  async function deleteFnri(fctId) {
    if (!window.confirm('Delete this food item from FNRI database?')) return;
    const { error } = await supabase.from('fnri_food_composition').delete().eq('fct_id', fctId);
    if (error) {
      showToast('Error deleting FNRI item: ' + error.message, true);
      return;
    }
    showToast('\u2713 Food item deleted');
    await loadFnri();
  }
  function handleLogout() {
    logout();
    navigate('/');
  }
  return React.createElement(
    'div',
    { className: 'ad-body' },
    React.createElement(
      'nav',
      { className: 'dash-navbar' },
      React.createElement(
        Link,
        { to: '/dashboard', className: 'dash-navbar-logo' },
        React.createElement(
          'div',
          { className: 'dash-navbar-logo-icon' },
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
          { className: 'dash-navbar-logo-text' },
          React.createElement('span', null, 'BL'),
          'ANE ',
          React.createElement('span', { className: 'ad-brand-badge' }, 'ADMIN'),
        ),
      ),
      React.createElement('div', { className: 'dash-navbar-spacer' }),
      React.createElement(
        'div',
        { className: 'dash-navbar-right' },
        React.createElement(
          'span',
          { className: 'dash-greeting ad-nav-account' },
          'Admin: ',
          React.createElement('strong', null, user.email),
        ),
        React.createElement(
          Link,
          {
            to: '/dashboard',
            className: 'dash-dropdown-item ad-nav-back',
          },
          React.createElement('span', { 'aria-hidden': 'true' }, '\u2190'),
          React.createElement('span', { className: 'ad-nav-back-label' }, 'Back to App'),
        ),
        React.createElement(
          'button',
          {
            className: 'dash-dropdown-item danger ad-nav-signout',
            onClick: handleLogout,
          },
          'Sign out',
        ),
      ),
    ),
    React.createElement(
      'main',
      { className: 'ad-main' },
      React.createElement(
        'div',
        { className: 'ad-content' },
        React.createElement(
          'div',
          { className: 'ad-page-header' },
          React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { className: 'ad-page-title' },
              '\u{1F6E0}\uFE0F Admin Panel ',
              React.createElement('span', { className: 'ad-admin-badge' }, 'ADMIN ACCESS'),
            ),
            React.createElement(
              'div',
              { className: 'ad-page-sub' },
              'Manage markets, recipes, onboarding metadata, seasonal food data, and dietary constraints',
            ),
          ),
          React.createElement(
            'button',
            { className: 'dash-feedback-trigger', type: 'button', onClick: openFeedbackModal },
            'View User Feedback',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-tabs' },
          React.createElement(
            'button',
            {
              className: activeTab === 'markets' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('markets'),
            },
            '\u{1F4CD} Markets & Prices',
          ),
          React.createElement(
            'button',
            {
              className: activeTab === 'recipes' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('recipes'),
            },
            '\u{1F37D}\uFE0F Recipes',
          ),
          React.createElement(
            'button',
            {
              className: activeTab === 'fnri' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('fnri'),
            },
            '\u{1F4CA} FNRI Food Data',
          ),
          React.createElement(
            'button',
            {
              className: activeTab === 'options' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('options'),
            },
            '\u{1F9E9} Onboarding Options',
          ),
          React.createElement(
            'button',
            {
              className: activeTab === 'constraints' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('constraints'),
            },
            '\u26A0\uFE0F Constraint Definitions',
          ),
          React.createElement(
            'button',
            {
              className: activeTab === 'seasons' ? 'ad-tab-btn active' : 'ad-tab-btn',
              onClick: () => setActiveTab('seasons'),
            },
            '\u{1F331} Seasonal Ingredients',
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'markets' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(PriceSourceStatus, { showCatalog: true }),
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search markets...',
              value: searchMarkets,
              onChange: (e) => setSearchMarkets(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredMarkets.length),
              ' markets',
            ),
            React.createElement(
              'button',
              { className: 'ad-add-btn', type: 'button', onClick: () => openMarketModal(null) },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Market',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-markets' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Market'),
                  React.createElement('th', null, 'Type'),
                  React.createElement('th', null, 'Coordinates'),
                  React.createElement('th', null, 'Hours'),
                  React.createElement('th', null, 'Status'),
                  React.createElement('th', null, 'Prices'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredMarkets.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement('td', { colSpan: '7' }, 'No markets found.'),
                    )
                  : filteredMarkets.map((market) =>
                      React.createElement(
                        'tr',
                        { key: market.id },
                        React.createElement(
                          'td',
                          null,
                          React.createElement('span', { className: 'ad-table-icon' }, market.icon),
                          React.createElement('span', { className: 'ad-table-name' }, market.name),
                        ),
                        React.createElement('td', null, market.type),
                        React.createElement(
                          'td',
                          null,
                          market.lat?.toFixed?.(4) ?? market.lat,
                          ', ',
                          market.lng?.toFixed?.(4) ?? market.lng,
                        ),
                        React.createElement('td', null, market.hours || '\u2014'),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: `ad-status-pill ${market.is_open ? 'open' : 'closed'}` },
                            market.is_open ? 'Open' : 'Closed',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            {
                              className: 'ad-manage-link',
                              onClick: () => openMarketModal(market.id),
                            },
                            'Edit / Manage Prices',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openMarketModal(market.id),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteMarket(market.id),
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
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'recipes' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search recipes...',
              value: searchRecipes,
              onChange: (e) => setSearchRecipes(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredRecipes.length),
              ' recipes',
            ),
            React.createElement(
              'button',
              { className: 'ad-add-btn', type: 'button', onClick: () => openRecipeModal(null) },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Recipe',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-recipes' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Recipe'),
                  React.createElement('th', null, 'Type'),
                  React.createElement('th', null, 'Calories'),
                  React.createElement('th', null, 'Cost'),
                  React.createElement('th', null, 'Macros'),
                  React.createElement('th', null, 'Details'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredRecipes.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement('td', { colSpan: '7' }, 'No recipes found.'),
                    )
                  : filteredRecipes.map((recipe) =>
                      React.createElement(
                        'tr',
                        { key: recipe.id },
                        React.createElement(
                          'td',
                          null,
                          React.createElement('span', { className: 'ad-table-name' }, recipe.name),
                        ),
                        React.createElement('td', null, recipe.type),
                        React.createElement('td', null, recipe.kcal ?? '\u2014', ' kcal'),
                        React.createElement('td', null, '\u20B1', recipe.cost ?? '\u2014'),
                        React.createElement(
                          'td',
                          null,
                          'P',
                          recipe.protein_g ?? '\u2014',
                          ' / C',
                          recipe.carbs_g ?? '\u2014',
                          ' / F',
                          recipe.fats_g ?? '\u2014',
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            {
                              className: 'ad-manage-link',
                              onClick: () => openRecipeModal(recipe.id),
                            },
                            'Edit / Ingredients / Steps',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openRecipeModal(recipe.id),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteRecipe(recipe.id),
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
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'fnri' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search FNRI food items...',
              value: searchFnri,
              onChange: (e) => setSearchFnri(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredFnri.length),
              ' items (showing first 200)',
            ),
            React.createElement(
              'button',
              { className: 'ad-add-btn', type: 'button', onClick: () => openFnriModal(null) },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Food Item',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-fnri' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Food Item'),
                  React.createElement('th', null, 'Calories'),
                  React.createElement('th', null, 'Protein'),
                  React.createElement('th', null, 'Fat'),
                  React.createElement('th', null, 'Carbs'),
                  React.createElement('th', null, 'Estimated Price'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredFnri.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement('td', { colSpan: '7' }, 'No food items found.'),
                    )
                  : filteredFnri.map((item) =>
                      React.createElement(
                        'tr',
                        { key: item.fct_id },
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: 'ad-table-name' },
                            item.food_name,
                          ),
                          React.createElement(
                            'div',
                            { style: { fontSize: 11, color: '#4d6e5a', marginTop: 4 } },
                            item.alternate_name || '\u2014',
                          ),
                        ),
                        React.createElement('td', null, item.energy_kcal ?? '\u2014', ' kcal'),
                        React.createElement('td', null, item.protein_g ?? '\u2014', 'g'),
                        React.createElement('td', null, item.total_fat_g ?? '\u2014', 'g'),
                        React.createElement(
                          'td',
                          null,
                          item.available_carbohydrate_g ?? '\u2014',
                          'g',
                        ),
                        React.createElement(
                          'td',
                          {
                            title: 'Estimated from the available sourced price references; this is not an FNRI-provided value.',
                          },
                          marketIngredientPriceText(
                            { name: item.food_name },
                            priceRecords,
                            referenceData || {},
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openFnriModal(item.fct_id),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteFnri(item.fct_id),
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
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'options' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement(
              'div',
              { style: { display: 'flex', gap: 8, alignItems: 'center' } },
              OPTION_GROUPS.map((group) =>
                React.createElement(
                  'button',
                  {
                    key: group.key,
                    className: optionGroup === group.key ? 'ad-tab-btn active' : 'ad-tab-btn',
                    type: 'button',
                    onClick: () => setOptionGroup(group.key),
                  },
                  group.label,
                ),
              ),
            ),
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search onboarding options...',
              value: searchOptions,
              onChange: (e) => setSearchOptions(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredOptionLists.length),
              ' options',
            ),
            React.createElement(
              'button',
              {
                className: 'ad-add-btn',
                type: 'button',
                onClick: () => openOptionModal(null, optionGroup),
              },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Option',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-options' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Key'),
                  React.createElement('th', null, 'Label'),
                  React.createElement('th', null, 'Description'),
                  React.createElement('th', null, 'Sort'),
                  React.createElement('th', null, 'Active'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredOptionLists.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement('td', { colSpan: '6' }, 'No options found.'),
                    )
                  : filteredOptionLists.map((opt) =>
                      React.createElement(
                        'tr',
                        { key: opt.id },
                        React.createElement('td', null, opt.key),
                        React.createElement('td', null, opt.label),
                        React.createElement('td', null, opt.description || '\u2014'),
                        React.createElement('td', null, opt.sort_order ?? 0),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: `ad-status-pill ${opt.active ? 'open' : 'closed'}` },
                            opt.active ? 'Yes' : 'No',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openOptionModal(opt.id, opt.group),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteOption(opt.id),
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
                                  d: 'M19 6l-1 14a2 2 0 0 1 2 2H8a2 2 0 0 1-2-2L5 6',
                                }),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'constraints' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search constraints...',
              value: constraintSearch,
              onChange: (e) => setConstraintSearch(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredConstraintDefs.length),
              ' constraints',
            ),
            React.createElement(
              'button',
              { className: 'ad-add-btn', type: 'button', onClick: () => openConstraintModal(null) },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Constraint',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-constraints' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Key'),
                  React.createElement('th', null, 'Label'),
                  React.createElement('th', null, 'Severity'),
                  React.createElement('th', null, 'Blocked'),
                  React.createElement('th', null, 'Active'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredConstraintDefs.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement(
                        'td',
                        { colSpan: '6' },
                        'No constraint definitions found.',
                      ),
                    )
                  : filteredConstraintDefs.map((item) =>
                      React.createElement(
                        'tr',
                        { key: item.id },
                        React.createElement('td', null, item.key),
                        React.createElement('td', null, item.label),
                        React.createElement('td', null, item.severity),
                        React.createElement(
                          'td',
                          null,
                          Array.isArray(item.blocked) ? item.blocked.join(', ') : item.blocked,
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: `ad-status-pill ${item.active ? 'open' : 'closed'}` },
                            item.active ? 'Yes' : 'No',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openConstraintModal(item.id),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteConstraint(item.id),
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
                                  d: 'M19 6l-1 14a2 2 0 0 1 2 2H8a2 2 0 0 1-2-2L5 6',
                                }),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: activeTab === 'seasons' ? 'ad-tab-panel active' : 'ad-tab-panel' },
          React.createElement(
            'div',
            { className: 'ad-toolbar' },
            React.createElement('input', {
              className: 'ad-search-input',
              placeholder: 'Search seasonal ingredients...',
              value: seasonSearch,
              onChange: (e) => setSeasonSearch(e.target.value),
            }),
            React.createElement(
              'span',
              { className: 'ad-result-count' },
              React.createElement('span', null, filteredSeasonRecords.length),
              ' records',
            ),
            React.createElement(
              'button',
              { className: 'ad-add-btn', type: 'button', onClick: () => openSeasonModal(null) },
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
                React.createElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }),
                React.createElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }),
              ),
              'Add Seasonal Ingredient',
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-table-wrap' },
            React.createElement(
              'table',
              { className: 'ad-table ad-table-seasons' },
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Ingredient'),
                  React.createElement('th', null, 'Season'),
                  React.createElement('th', null, 'Alternative'),
                  React.createElement('th', null, 'Sort'),
                  React.createElement('th', null, 'Active'),
                  React.createElement('th', null, 'Actions'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                filteredSeasonRecords.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement(
                        'td',
                        { colSpan: '6' },
                        'No seasonal ingredient records found.',
                      ),
                    )
                  : filteredSeasonRecords.map((item) =>
                      React.createElement(
                        'tr',
                        { key: item.id },
                        React.createElement('td', null, item.ingredient_name),
                        React.createElement('td', null, item.season),
                        React.createElement('td', null, item.alt || '\u2014'),
                        React.createElement('td', null, item.sort_order ?? 0),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'span',
                            { className: `ad-status-pill ${item.active ? 'open' : 'closed'}` },
                            item.active ? 'Yes' : 'No',
                          ),
                        ),
                        React.createElement(
                          'td',
                          null,
                          React.createElement(
                            'div',
                            { className: 'ad-row-actions' },
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn',
                                type: 'button',
                                onClick: () => openSeasonModal(item.id),
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
                                React.createElement('path', {
                                  d: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
                                }),
                                React.createElement('path', {
                                  d: 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
                                }),
                              ),
                            ),
                            React.createElement(
                              'button',
                              {
                                className: 'ad-icon-btn danger',
                                type: 'button',
                                onClick: () => deleteSeason(item.id),
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
                                  d: 'M19 6l-1 14a2 2 0 0 1 2 2H8a2 2 0 0 1-2-2L5 6',
                                }),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: feedbackModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) setFeedbackModalOpen(false);
        },
      },
      React.createElement(
        'section',
        {
          className: 'ad-modal ad-feedback-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'ad-feedback-modal-title',
        },
        React.createElement(
          'div',
          { className: 'ad-feedback-modal-heading' },
          React.createElement(
            'div',
            null,
            React.createElement(
              'div',
              { className: 'ad-modal-title', id: 'ad-feedback-modal-title' },
              'User Feedback',
            ),
            React.createElement(
              'div',
              { className: 'ad-page-sub' },
              'Review messages submitted by BLANE users.',
            ),
          ),
          React.createElement(
            'button',
            {
              className: 'ad-icon-btn',
              type: 'button',
              'aria-label': 'Close user feedback',
              onClick: () => setFeedbackModalOpen(false),
            },
            '\xD7',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-toolbar ad-feedback-toolbar' },
          React.createElement(
            'span',
            { className: 'ad-result-count' },
            React.createElement('span', null, feedbackRecords.length),
            ' submissions',
          ),
          React.createElement(
            'button',
            {
              className: 'ad-add-btn',
              type: 'button',
              onClick: loadFeedback,
              disabled: feedbackLoading,
            },
            feedbackLoading ? 'Refreshing\u2026' : 'Refresh',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-table-wrap ad-feedback-table-wrap' },
          React.createElement(
            'table',
            { className: 'ad-table ad-feedback-table' },
            React.createElement(
              'thead',
              null,
              React.createElement(
                'tr',
                null,
                React.createElement('th', null, 'Submitted by'),
                React.createElement('th', null, 'Category'),
                React.createElement('th', null, 'Message'),
                React.createElement('th', null, 'Page'),
                React.createElement('th', null, 'Submitted'),
              ),
            ),
            React.createElement(
              'tbody',
              null,
              feedbackLoading
                ? React.createElement(
                    'tr',
                    { className: 'ad-empty-row' },
                    React.createElement('td', { colSpan: '5' }, 'Loading feedback\u2026'),
                  )
                : feedbackRecords.length === 0
                  ? React.createElement(
                      'tr',
                      { className: 'ad-empty-row' },
                      React.createElement('td', { colSpan: '5' }, 'No feedback submissions yet.'),
                    )
                  : feedbackRecords.map((item) =>
                      React.createElement(
                        'tr',
                        { key: item.id },
                        React.createElement('td', { className: 'ad-table-name' }, item.sender_name),
                        React.createElement('td', null, item.category),
                        React.createElement(
                          'td',
                          { className: 'ad-feedback-message' },
                          item.message,
                        ),
                        React.createElement('td', null, item.page_path),
                        React.createElement('td', null, new Date(item.created_at).toLocaleString()),
                      ),
                    ),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: marketModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) closeMarketModal();
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title', id: 'ad-market-modal-title' },
          marketModalMode === 'edit' ? 'Edit Market' : 'Add New Market',
        ),
        React.createElement('input', { type: 'hidden', value: marketForm.id }),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Market Name'),
            React.createElement('input', {
              className: 'ad-input',
              value: marketForm.name,
              onChange: (e) => handleMarketFormChange('name', e.target.value),
              placeholder: 'e.g. Public Market',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Type'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: marketForm.type,
                onChange: (e) => handleMarketFormChange('type', e.target.value),
              },
              MARKET_TYPES.map((type) =>
                React.createElement('option', { key: type.value, value: type.value }, type.label),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Icon'),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement('input', {
                className: 'ad-input',
                style: { width: 56, textAlign: 'center', fontSize: 18 },
                value: marketForm.icon,
                maxLength: 4,
                onChange: (e) => handleMarketFormChange('icon', e.target.value),
                placeholder: '\u{1F3EA}',
              }),
              React.createElement(
                'div',
                { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
                MARKET_ICON_CHOICES.map((emoji) =>
                  React.createElement(
                    'button',
                    {
                      key: emoji,
                      type: 'button',
                      className: 'ad-icon-btn',
                      title: emoji,
                      onClick: () => handleMarketFormChange('icon', emoji),
                      style: {
                        fontSize: 16,
                        border: marketForm.icon === emoji ? '1px solid #4caf7d' : void 0,
                      },
                    },
                    emoji,
                  ),
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Latitude'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              step: '0.0001',
              value: marketForm.lat,
              onChange: (e) => handleMarketFormChange('lat', e.target.value),
              placeholder: '15.4889',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Longitude'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              step: '0.0001',
              value: marketForm.lng,
              onChange: (e) => handleMarketFormChange('lng', e.target.value),
              placeholder: '120.5985',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Address'),
            React.createElement('input', {
              className: 'ad-input',
              value: marketForm.address,
              onChange: (e) => handleMarketFormChange('address', e.target.value),
              placeholder: 'Street, City',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Operating Hours'),
            React.createElement('input', {
              className: 'ad-input',
              value: marketForm.hours,
              onChange: (e) => handleMarketFormChange('hours', e.target.value),
              placeholder: '4:00 AM \u2013 6:00 PM',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Status'),
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  fontSize: 13,
                  color: '#8aab96',
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: marketForm.open,
                onChange: (e) => handleMarketFormChange('open', e.target.checked),
              }),
              'Currently Open',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-sub-section' },
          React.createElement('div', { className: 'ad-sub-title' }, 'Ingredient Prices & Stock'),
          React.createElement(
            'div',
            { id: 'ad-market-ing-rows' },
            marketIngredients.map((ing, idx) =>
              React.createElement(
                'div',
                { key: idx, className: 'ad-sub-row' },
                React.createElement('input', {
                  className: 'ad-input',
                  placeholder: 'Ingredient name',
                  value: ing.name,
                  onChange: (e) => updateMarketIngredient(idx, 'name', e.target.value),
                }),
                React.createElement('input', {
                  className: 'ad-input',
                  placeholder: 'Price basis, e.g. 1 kg',
                  'aria-label': 'Quantity covered by this price',
                  value: ing.qty,
                  onChange: (e) => updateMarketIngredient(idx, 'qty', e.target.value),
                }),
                React.createElement('input', {
                  className: 'ad-input',
                  type: 'number',
                  placeholder: '\u20B1',
                  value: ing.price,
                  onChange: (e) => updateMarketIngredient(idx, 'price', e.target.value),
                }),
                React.createElement(
                  'select',
                  {
                    className: 'ad-select',
                    value: ing.status,
                    onChange: (e) => updateMarketIngredient(idx, 'status', e.target.value),
                  },
                  React.createElement('option', { value: 'avail' }, 'Avail'),
                  React.createElement('option', { value: 'limited' }, 'Limited'),
                  React.createElement('option', { value: 'unavail' }, 'Unavail'),
                ),
                React.createElement(
                  'button',
                  {
                    className: 'ad-sub-remove',
                    type: 'button',
                    onClick: () => removeMarketIngredientRow(idx),
                  },
                  '\u2715',
                ),
              ),
            ),
          ),
          React.createElement(
            'button',
            { className: 'ad-sub-add-btn', type: 'button', onClick: addMarketIngredientRow },
            '+ Add Ingredient',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-outline', type: 'button', onClick: closeMarketModal },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveMarket },
            'Save Market',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: recipeModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) closeRecipeModal();
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title', id: 'ad-recipe-modal-title' },
          recipeModalMode === 'edit' ? 'Edit Recipe' : 'Add New Recipe',
        ),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Recipe Name'),
            React.createElement('input', {
              className: 'ad-input',
              value: recipeForm.name,
              onChange: (e) => handleRecipeFormChange('name', e.target.value),
              placeholder: 'e.g. Egg & Malunggay Scramble',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Meal Type'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: recipeForm.type,
                onChange: (e) => handleRecipeFormChange('type', e.target.value),
              },
              RECIPE_TYPES.map((type) =>
                React.createElement('option', { key: type, value: type }, type),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Difficulty'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: recipeForm.difficulty,
                onChange: (e) => handleRecipeFormChange('difficulty', e.target.value),
              },
              RECIPE_DIFFICULTY.map((item) =>
                React.createElement('option', { key: item.value, value: item.value }, item.label),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Cook Time (min)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: recipeForm.cookTime,
              onChange: (e) => handleRecipeFormChange('cookTime', e.target.value),
              placeholder: '15',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Servings'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: recipeForm.servings,
              onChange: (e) => handleRecipeFormChange('servings', e.target.value),
              placeholder: '1',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Cost (\u20B1)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: recipeForm.cost,
              onChange: (e) => handleRecipeFormChange('cost', e.target.value),
              placeholder: '45',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Calories (auto)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: computedNutrition.kcal,
              disabled: true,
              readOnly: true,
              style: { opacity: 0.75 },
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Protein (g, auto)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: computedNutrition.protein,
              disabled: true,
              readOnly: true,
              style: { opacity: 0.75 },
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Carbs (g, auto)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: computedNutrition.carbs,
              disabled: true,
              readOnly: true,
              style: { opacity: 0.75 },
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Fats (g, auto)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: computedNutrition.fats,
              disabled: true,
              readOnly: true,
              style: { opacity: 0.75 },
            }),
          ),
        ),
        React.createElement(
          'div',
          { style: { fontSize: 12, color: '#8aab96', marginTop: -8, marginBottom: 12 } },
          'Calculated from FNRI data: ',
          computedNutrition.totalKcal,
          ' kcal total \xF7 ',
          parseInt(recipeForm.servings, 10) || 1,
          ' serving(s).',
          computedNutrition.unlinkedCount > 0 &&
            React.createElement(
              'span',
              { style: { color: '#e0a94c' } },
              ' ',
              computedNutrition.unlinkedCount,
              " ingredient(s) aren't linked to FNRI yet and are excluded from this total.",
            ),
        ),
        React.createElement(
          'div',
          { className: 'ad-field', style: { marginBottom: 12 } },
          React.createElement('label', { className: 'ad-field-label' }, 'Dietary Tags'),
          React.createElement(
            'div',
            { className: 'ad-checkbox-row' },
            DIETARY_OPTIONS.map((option) =>
              React.createElement(
                'div',
                {
                  key: option.value,
                  className: recipeForm.dietTags.includes(option.value)
                    ? 'ad-checkbox-pill selected'
                    : 'ad-checkbox-pill',
                  onClick: () => toggleRecipeTag('dietTags', option.value),
                },
                option.label,
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-field', style: { marginBottom: 12 } },
          React.createElement('label', { className: 'ad-field-label' }, 'Goal Tags'),
          React.createElement(
            'div',
            { className: 'ad-checkbox-row' },
            GOAL_OPTIONS.map((option) =>
              React.createElement(
                'div',
                {
                  key: option.value,
                  className: recipeForm.goalTags.includes(option.value)
                    ? 'ad-checkbox-pill selected'
                    : 'ad-checkbox-pill',
                  onClick: () => toggleRecipeTag('goalTags', option.value),
                },
                option.label,
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-sub-section' },
          React.createElement('div', { className: 'ad-sub-title' }, 'Ingredients'),
          recipeIngredients.map((ing, idx) =>
            React.createElement(
              'div',
              {
                key: idx,
                className: 'ad-sub-row',
                style: { gridTemplateColumns: 'minmax(120px, 1fr) 70px minmax(120px, 1fr) 76px 30px' },
              },
              React.createElement(
                'div',
                { style: { position: 'relative' } },
                ing.fct_id
                  ? React.createElement(
                      'div',
                      {
                        className: 'ad-input',
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          cursor: 'default',
                        },
                      },
                      React.createElement(
                        'span',
                        {
                          style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 13,
                          },
                        },
                        '\u2713 ',
                        ing.name,
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: () => clearIngredientLink(idx),
                          title: 'Change ingredient',
                          style: {
                            flexShrink: 0,
                            background: 'none',
                            border: 'none',
                            color: '#8aab96',
                            cursor: 'pointer',
                            fontSize: 13,
                          },
                        },
                        '\u21BA',
                      ),
                    )
                  : React.createElement('input', {
                      className: 'ad-input',
                      placeholder: 'Search FNRI food name...',
                      value: ing.name,
                      onChange: (e) => handleIngredientNameChange(idx, e.target.value),
                      onFocus: () => setIngredientSearchIndex(idx),
                      onBlur: () =>
                        setTimeout(
                          () => setIngredientSearchIndex((cur) => (cur === idx ? null : cur)),
                          150,
                        ),
                    }),
                ingredientSearchIndex === idx &&
                  !ing.fct_id &&
                  ingredientSearchResults.length > 0 &&
                  React.createElement(
                    'div',
                    {
                      style: {
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 30,
                        background: '#0f1c14',
                        border: '1px solid #2c4636',
                        borderRadius: 8,
                        marginTop: 4,
                        maxHeight: 220,
                        overflowY: 'auto',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      },
                    },
                    ingredientSearchResults.map((item) =>
                      React.createElement(
                        'div',
                        {
                          key: item.fct_id,
                          onMouseDown: (e) => e.preventDefault(),
                          onClick: () => selectFnriForIngredient(idx, item),
                          style: {
                            padding: '8px 10px',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: '#e3f0e8',
                            borderBottom: '1px solid #1c2f24',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                          },
                        },
                        React.createElement(
                          'span',
                          {
                            style: {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            },
                          },
                          item.food_name,
                        ),
                        React.createElement(
                          'span',
                          { style: { color: '#8aab96', flexShrink: 0 } },
                          item.energy_kcal ?? '\u2014',
                          ' kcal/100g',
                        ),
                      ),
                    ),
                  ),
              ),
              React.createElement('input', {
                className: 'ad-input',
                type: 'number',
                placeholder: 'Grams',
                'aria-label': `Grams for ${ing.name || `ingredient ${idx + 1}`}`,
                value: ing.grams,
                onChange: (e) => updateRecipeIngredient(idx, 'grams', e.target.value),
              }),
              React.createElement('input', {
                className: 'ad-input',
                type: 'text',
                placeholder: 'Quantity (e.g. 1 cup)',
                'aria-label': `Recipe quantity for ${ing.name || `ingredient ${idx + 1}`}`,
                value: ing.quantity,
                onChange: (e) => updateRecipeIngredient(idx, 'quantity', e.target.value),
              }),
              React.createElement(
                'select',
                {
                  className: 'ad-select',
                  value: ing.status,
                  onChange: (e) => updateRecipeIngredient(idx, 'status', e.target.value),
                },
                React.createElement('option', { value: 'avail' }, 'Avail'),
                React.createElement('option', { value: 'warn' }, 'Warn'),
              ),
              React.createElement(
                'button',
                {
                  className: 'ad-sub-remove',
                  type: 'button',
                  onClick: () => removeRecipeIngredientRow(idx),
                },
                '\u2715',
              ),
            ),
          ),
          React.createElement(
            'button',
            { className: 'ad-sub-add-btn', type: 'button', onClick: addRecipeIngredientRow },
            '+ Add Ingredient',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-sub-section' },
          React.createElement('div', { className: 'ad-sub-title' }, 'Cooking Steps'),
          recipeSteps.map((step, idx) =>
            React.createElement(
              'div',
              {
                key: idx,
                style: {
                  marginBottom: 8,
                  padding: 10,
                  background: '#111f16',
                  borderRadius: 9,
                  border: '1px solid rgba(45,220,122,0.08)',
                },
              },
              React.createElement(
                'div',
                { style: { display: 'flex', gap: 6, marginBottom: 6 } },
                React.createElement('input', {
                  className: 'ad-input',
                  placeholder: 'Step title',
                  style: { flex: 1 },
                  value: step.title,
                  onChange: (e) => updateRecipeStep(idx, 'title', e.target.value),
                }),
                React.createElement('input', {
                  className: 'ad-input',
                  type: 'number',
                  placeholder: 'Timer (sec)',
                  style: { width: 110 },
                  value: step.timer,
                  onChange: (e) => updateRecipeStep(idx, 'timer', e.target.value),
                }),
                React.createElement(
                  'button',
                  {
                    className: 'ad-sub-remove',
                    type: 'button',
                    onClick: () => removeRecipeStepRow(idx),
                  },
                  '\u2715',
                ),
              ),
              React.createElement('textarea', {
                className: 'ad-textarea',
                placeholder: 'Step description',
                value: step.description,
                onChange: (e) => updateRecipeStep(idx, 'description', e.target.value),
              }),
            ),
          ),
          React.createElement(
            'button',
            { className: 'ad-sub-add-btn', type: 'button', onClick: addRecipeStepRow },
            '+ Add Step',
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-outline', type: 'button', onClick: closeRecipeModal },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveRecipe },
            'Save Recipe',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: fnriModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) closeFnriModal();
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title', id: 'ad-fnri-modal-title' },
          fnriModalMode === 'edit' ? 'Edit Food Item' : 'Add New Food Item',
        ),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'FCT ID'),
            React.createElement('input', {
              className: 'ad-input',
              value: fnriForm.fct_id,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, fct_id: e.target.value })),
              placeholder: 'A001',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Food Name'),
            React.createElement('input', {
              className: 'ad-input',
              value: fnriForm.food_name,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, food_name: e.target.value })),
              placeholder: 'Rice, cooked, white',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Alternate / Local Name'),
            React.createElement('input', {
              className: 'ad-input',
              value: fnriForm.alternate_name,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, alternate_name: e.target.value })),
              placeholder: 'Kanin',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Energy (kcal per 100g)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: fnriForm.energy_kcal,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, energy_kcal: e.target.value })),
              placeholder: '130',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Protein (g)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: fnriForm.protein_g,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, protein_g: e.target.value })),
              placeholder: '2.4',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Total Fat (g)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: fnriForm.total_fat_g,
              onChange: (e) => setFnriForm((prev) => ({ ...prev, total_fat_g: e.target.value })),
              placeholder: '0.2',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Available Carbs (g)'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: fnriForm.available_carbohydrate_g,
              onChange: (e) =>
                setFnriForm((prev) => ({ ...prev, available_carbohydrate_g: e.target.value })),
              placeholder: '28.7',
            }),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-outline', type: 'button', onClick: closeFnriModal },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveFnri },
            'Save Food Item',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: optionModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) closeOptionModal();
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title', id: 'ad-option-modal-title' },
          optionModalMode === 'edit' ? 'Edit Onboarding Option' : 'Add New Onboarding Option',
        ),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Group'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: optionForm.group,
                onChange: (e) => handleOptionFormChange('group', e.target.value),
              },
              OPTION_GROUPS.map((group) =>
                React.createElement('option', { key: group.key, value: group.key }, group.label),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Key'),
            React.createElement('input', {
              className: 'ad-input',
              value: optionForm.key,
              onChange: (e) => handleOptionFormChange('key', e.target.value),
              placeholder: 'e.g. lose_weight',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Label'),
            React.createElement('input', {
              className: 'ad-input',
              value: optionForm.label,
              onChange: (e) => handleOptionFormChange('label', e.target.value),
              placeholder: 'Lose Weight',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Sort Order'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: optionForm.sort_order,
              onChange: (e) => handleOptionFormChange('sort_order', e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Description'),
            React.createElement('input', {
              className: 'ad-input',
              value: optionForm.description,
              onChange: (e) => handleOptionFormChange('description', e.target.value),
              placeholder: 'Optional description for admin use',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field', style: { gridColumn: 'span 2' } },
            React.createElement('label', { className: 'ad-field-label' }, 'Active'),
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  fontSize: 13,
                  color: '#8aab96',
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: optionForm.active,
                onChange: (e) => handleOptionFormChange('active', e.target.checked),
              }),
              'Enabled for onboarding',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-outline', type: 'button', onClick: closeOptionModal },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveOption },
            'Save Option',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: constraintModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) setConstraintModalOpen(false);
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title' },
          constraintModalMode === 'edit'
            ? 'Edit Constraint Definition'
            : 'Add New Constraint Definition',
        ),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Key'),
            React.createElement('input', {
              className: 'ad-input',
              value: constraintForm.key,
              onChange: (e) => handleConstraintFormChange('key', e.target.value),
              placeholder: 'e.g. lactose_intolerance',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Label'),
            React.createElement('input', {
              className: 'ad-input',
              value: constraintForm.label,
              onChange: (e) => handleConstraintFormChange('label', e.target.value),
              placeholder: 'Lactose Intolerance',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Severity'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: constraintForm.severity,
                onChange: (e) => handleConstraintFormChange('severity', e.target.value),
              },
              React.createElement('option', { value: 'dietary' }, 'Dietary'),
              React.createElement('option', { value: 'medical' }, 'Medical'),
              React.createElement('option', { value: 'allergy' }, 'Allergy'),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Blocked ingredients'),
            React.createElement('input', {
              className: 'ad-input',
              value: constraintForm.blocked,
              onChange: (e) => handleConstraintFormChange('blocked', e.target.value),
              placeholder: 'e.g. milk, cheese, cream',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Reason'),
            React.createElement('input', {
              className: 'ad-input',
              value: constraintForm.reason,
              onChange: (e) => handleConstraintFormChange('reason', e.target.value),
              placeholder: 'Why this constraint applies',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Sort Order'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: constraintForm.sort_order,
              onChange: (e) => handleConstraintFormChange('sort_order', e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field', style: { gridColumn: 'span 2' } },
            React.createElement('label', { className: 'ad-field-label' }, 'Active'),
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  fontSize: 13,
                  color: '#8aab96',
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: constraintForm.active,
                onChange: (e) => handleConstraintFormChange('active', e.target.checked),
              }),
              'Enabled for app safety checks',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            {
              className: 'ad-btn ad-btn-outline',
              type: 'button',
              onClick: () => setConstraintModalOpen(false),
            },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveConstraint },
            'Save Constraint',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      {
        className: seasonModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay',
        onClick: (e) => {
          if (e.target === e.currentTarget) setSeasonModalOpen(false);
        },
      },
      React.createElement(
        'div',
        { className: 'ad-modal', onClick: (e) => e.stopPropagation() },
        React.createElement(
          'div',
          { className: 'ad-modal-title' },
          seasonModalMode === 'edit' ? 'Edit Seasonal Ingredient' : 'Add New Seasonal Ingredient',
        ),
        React.createElement(
          'div',
          { className: 'ad-form-grid' },
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Ingredient Name'),
            React.createElement('input', {
              className: 'ad-input',
              value: seasonForm.ingredient_name,
              onChange: (e) => handleSeasonFormChange('ingredient_name', e.target.value),
              placeholder: 'e.g. malunggay',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Season'),
            React.createElement(
              'select',
              {
                className: 'ad-select',
                value: seasonForm.season,
                onChange: (e) => handleSeasonFormChange('season', e.target.value),
              },
              SEASONS.map((s) =>
                React.createElement('option', { key: s.value, value: s.value }, s.label),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'ad-field ad-field-full' },
            React.createElement('label', { className: 'ad-field-label' }, 'Alternative Ingredient'),
            React.createElement('input', {
              className: 'ad-input',
              value: seasonForm.alt,
              onChange: (e) => handleSeasonFormChange('alt', e.target.value),
              placeholder: 'e.g. kangkong',
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field' },
            React.createElement('label', { className: 'ad-field-label' }, 'Sort Order'),
            React.createElement('input', {
              className: 'ad-input',
              type: 'number',
              value: seasonForm.sort_order,
              onChange: (e) => handleSeasonFormChange('sort_order', e.target.value),
            }),
          ),
          React.createElement(
            'div',
            { className: 'ad-field', style: { gridColumn: 'span 2' } },
            React.createElement('label', { className: 'ad-field-label' }, 'Active'),
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 8,
                  fontSize: 13,
                  color: '#8aab96',
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: seasonForm.active,
                onChange: (e) => handleSeasonFormChange('active', e.target.checked),
              }),
              'Enabled for seasonal scoring',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'ad-modal-actions' },
          React.createElement(
            'button',
            {
              className: 'ad-btn ad-btn-outline',
              type: 'button',
              onClick: () => setSeasonModalOpen(false),
            },
            'Cancel',
          ),
          React.createElement(
            'button',
            { className: 'ad-btn ad-btn-primary', type: 'button', onClick: saveSeason },
            'Save Seasonal Ingredient',
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: toast.visible ? 'ad-toast show' : 'ad-toast' + (toast.error ? ' error' : '') },
      toast.message,
    ),
  );
}
export { Admin as default };
