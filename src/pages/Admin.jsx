import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isAdmin } from '../lib/adminAuth';
import '../styles/admin.css';

const MARKET_TYPES = [
  { value: 'palengke', label: 'Palengke' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'talipapa', label: 'Talipapa' },
  { value: 'grocery', label: 'Grocery' },
];

const RECIPE_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
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

const EMPTY_MARKET = {
  id: '',
  name: '',
  type: 'palengke',
  icon: '🏪',
  lat: '',
  lng: '',
  address: '',
  hours: '',
  open: true,
};

const EMPTY_MARKET_ING = { name: '', qty: '', price: '', status: 'avail' };

const EMPTY_RECIPE = {
  id: '',
  name: '',
  emoji: '🍽️',
  type: 'Breakfast',
  difficulty: 'easy',
  cookTime: '15',
  servings: '1',
  cost: '0',
  kcal: '0',
  protein: '0',
  carbs: '0',
  fats: '0',
  dietTags: [],
  goalTags: [],
};

const EMPTY_RECIPE_ING = { name: '', qty: '', status: 'avail' };
const EMPTY_RECIPE_STEP = { title: '', description: '', timer: '' };

const EMPTY_FNRI = {
  fct_id: '',
  food_name: '',
  alternate_name: '',
  energy_kcal: '',
  protein_g: '',
  total_fat_g: '',
  available_carbohydrate_g: '',
  dietary_fiber_g: '',
};

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('markets');
  const [markets, setMarkets] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [fnriItems, setFnriItems] = useState([]);

  const [searchMarkets, setSearchMarkets] = useState('');
  const [searchRecipes, setSearchRecipes] = useState('');
  const [searchFnri, setSearchFnri] = useState('');

  const [marketModalOpen, setMarketModalOpen] = useState(false);
  const [marketModalMode, setMarketModalMode] = useState('add');
  const [marketForm, setMarketForm] = useState(EMPTY_MARKET);
  const [marketIngredients, setMarketIngredients] = useState([EMPTY_MARKET_ING]);

  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeModalMode, setRecipeModalMode] = useState('add');
  const [recipeForm, setRecipeForm] = useState(EMPTY_RECIPE);
  const [recipeIngredients, setRecipeIngredients] = useState([EMPTY_RECIPE_ING]);
  const [recipeSteps, setRecipeSteps] = useState([EMPTY_RECIPE_STEP]);

  const [fnriModalOpen, setFnriModalOpen] = useState(false);
  const [fnriModalMode, setFnriModalMode] = useState('add');
  const [fnriForm, setFnriForm] = useState(EMPTY_FNRI);

  const [toast, setToast] = useState({ message: '', error: false, visible: false });

  useEffect(() => {
    if (!user || loading) return;
    if (!isAdmin(user)) return;
    loadAllData();
  }, [user, loading]);

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 3000);
    return () => window.clearTimeout(timer);
  }, [toast.visible]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060d0a', color: '#4d6e5a' }}>
        Loading admin panel…
      </div>
    );
  }

  if (user && !isAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!user) return null;

  const filteredMarkets = useMemo(() => {
    const query = searchMarkets.toLowerCase();
    return markets.filter((market) => market.name.toLowerCase().includes(query));
  }, [markets, searchMarkets]);

  const filteredRecipes = useMemo(() => {
    const query = searchRecipes.toLowerCase();
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query));
  }, [recipes, searchRecipes]);

  const filteredFnri = useMemo(() => {
    const query = searchFnri.toLowerCase();
    return fnriItems.filter((item) =>
      item.food_name.toLowerCase().includes(query) ||
      (item.alternate_name || '').toLowerCase().includes(query)
    );
  }, [fnriItems, searchFnri]);

  async function loadAllData() {
    await Promise.all([loadMarkets(), loadRecipes(), loadFnri()]);
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
    const { data, error } = await supabase.from('fnri_food_composition').select('*').order('food_name').limit(200);
    if (error) {
      showToast('Error loading FNRI items: ' + error.message, true);
      return;
    }
    setFnriItems(data || []);
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
    setRecipeIngredients([EMPTY_RECIPE_ING]);
    setRecipeSteps([EMPTY_RECIPE_STEP]);
  }

  function closeFnriModal() {
    setFnriModalOpen(false);
    setFnriForm(EMPTY_FNRI);
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
      icon: market.icon || '🏪',
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
    const { data, error } = await supabase.from('market_ingredients').select('*').eq('market_id', marketId).order('name');
    if (error) {
      showToast('Error loading market ingredients: ' + error.message, true);
      return;
    }
    setMarketIngredients((data || []).map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      status: item.status,
    })));
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
      icon: marketForm.icon || '🏪',
      lat: parseFloat(marketForm.lat),
      lng: parseFloat(marketForm.lng),
      address: marketForm.address.trim(),
      hours: marketForm.hours.trim(),
      is_open: Boolean(marketForm.open),
      updated_at: new Date().toISOString(),
    };

    const { error: marketError } = await supabase.from('markets').upsert(marketPayload, { onConflict: 'id' });
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
      const { error: ingredientsError } = await supabase.from('market_ingredients').insert(ingredientsToInsert);
      if (ingredientsError) {
        showToast('Error saving market ingredients: ' + ingredientsError.message, true);
        return;
      }
    }

    showToast('✓ Market saved successfully');
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
    showToast('✓ Market deleted');
    await loadMarkets();
  }

  function openRecipeModal(id) {
    const recipe = recipes.find((item) => item.id === id);
    if (!recipe) {
      setRecipeModalMode('add');
      setRecipeForm(EMPTY_RECIPE);
      setRecipeIngredients([EMPTY_RECIPE_ING]);
      setRecipeSteps([EMPTY_RECIPE_STEP]);
      setRecipeModalOpen(true);
      return;
    }

    setRecipeModalMode('edit');
    setRecipeForm({
      id: recipe.id,
      name: recipe.name || '',
      emoji: recipe.emoji || '🍽️',
      type: recipe.type || 'Breakfast',
      difficulty: recipe.difficulty || 'easy',
      cookTime: recipe.cook_time_min?.toString() || '15',
      servings: recipe.servings?.toString() || '1',
      cost: recipe.cost?.toString() || '0',
      kcal: recipe.kcal?.toString() || '0',
      protein: recipe.protein_g?.toString() || '0',
      carbs: recipe.carbs_g?.toString() || '0',
      fats: recipe.fats_g?.toString() || '0',
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

    setRecipeIngredients((ingRes.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      status: item.status,
    })));
    setRecipeSteps((stepRes.data || []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      timer: item.timer_seconds?.toString() || '',
    })));
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
      emoji: recipeForm.emoji || '🍽️',
      type: recipeForm.type,
      difficulty: recipeForm.difficulty,
      cook_time_min: parseInt(recipeForm.cookTime) || 0,
      servings: parseInt(recipeForm.servings) || 1,
      cost: parseFloat(recipeForm.cost) || 0,
      kcal: parseFloat(recipeForm.kcal) || 0,
      protein_g: parseFloat(recipeForm.protein) || 0,
      carbs_g: parseFloat(recipeForm.carbs) || 0,
      fats_g: parseFloat(recipeForm.fats) || 0,
      diet_tags: recipeForm.dietTags,
      goal_tags: recipeForm.goalTags,
      updated_at: new Date().toISOString(),
    };

    const { error: recipeError } = await supabase.from('recipes').upsert(payload, { onConflict: 'id' });
    if (recipeError) {
      showToast('Error saving recipe: ' + recipeError.message, true);
      return;
    }

    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
    const ingredientsToInsert = recipeIngredients
      .filter((item) => item.name.trim())
      .map((item, index) => ({
        recipe_id: id,
        name: item.name.trim(),
        qty: item.qty.trim(),
        status: item.status,
        sort_order: index + 1,
      }));

    if (ingredientsToInsert.length > 0) {
      const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsToInsert);
      if (ingError) {
        showToast('Error saving recipe ingredients: ' + ingError.message, true);
        return;
      }
    }

    await supabase.from('recipe_steps').delete().eq('recipe_id', id);
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

    showToast('✓ Recipe saved successfully');
    closeRecipeModal();
    await loadRecipes();
  }

  async function deleteRecipe(id) {
    if (!window.confirm('Delete this recipe and all of its ingredients/steps? This cannot be undone.')) return;
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id);
    await supabase.from('recipe_steps').delete().eq('recipe_id', id);
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) {
      showToast('Error deleting recipe: ' + error.message, true);
      return;
    }
    showToast('✓ Recipe deleted');
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
      dietary_fiber_g: item.dietary_fiber_g?.toString() || '',
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
      available_carbohydrate_g: fnriForm.available_carbohydrate_g ? parseFloat(fnriForm.available_carbohydrate_g) : null,
      dietary_fiber_g: fnriForm.dietary_fiber_g ? parseFloat(fnriForm.dietary_fiber_g) : null,
    };

    const { error } = await supabase.from('fnri_food_composition').upsert(payload, { onConflict: 'fct_id' });
    if (error) {
      showToast('Error saving FNRI item: ' + error.message, true);
      return;
    }

    showToast('✓ Food item saved successfully');
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
    showToast('✓ Food item deleted');
    await loadFnri();
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="ad-body">
      <nav className="dash-navbar">
        <Link to="/dashboard" className="dash-navbar-logo">
          <div className="dash-navbar-logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z" />
            </svg>
          </div>
          <span className="dash-navbar-logo-text"><span>BL</span>ANE <span style={{ color: '#a78bfa', fontSize: 12 }}>ADMIN</span></span>
        </Link>

        <div className="dash-navbar-spacer" />

        <div className="dash-navbar-right">
          <span className="dash-greeting" style={{ color: '#8aab96' }}>
            Admin: <strong>{user.email}</strong>
          </span>
          <Link to="/dashboard" className="dash-dropdown-item" style={{ color: '#2ddc7a', padding: '10px 14px' }}>
            ← Back to App
          </Link>
          <button className="dash-dropdown-item danger" style={{ width: 'auto', border: '1px solid rgba(248,113,113,0.18)', padding: '10px 14px' }} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="ad-main">
        <div className="ad-content">
          <div className="ad-page-header">
            <div>
              <div className="ad-page-title">🛠️ Admin Panel <span className="ad-admin-badge">ADMIN ACCESS</span></div>
              <div className="ad-page-sub">Manage markets, recipes, and FNRI nutrient data</div>
            </div>
          </div>

          <div className="ad-tabs">
            <button className={activeTab === 'markets' ? 'ad-tab-btn active' : 'ad-tab-btn'} onClick={() => setActiveTab('markets')}>
              📍 Markets & Prices
            </button>
            <button className={activeTab === 'recipes' ? 'ad-tab-btn active' : 'ad-tab-btn'} onClick={() => setActiveTab('recipes')}>
              🍽️ Recipes
            </button>
            <button className={activeTab === 'fnri' ? 'ad-tab-btn active' : 'ad-tab-btn'} onClick={() => setActiveTab('fnri')}>
              📊 FNRI Food Data
            </button>
          </div>

          <div className={activeTab === 'markets' ? 'ad-tab-panel active' : 'ad-tab-panel'}>
            <div className="ad-toolbar">
              <input
                className="ad-search-input"
                placeholder="Search markets..."
                value={searchMarkets}
                onChange={(e) => setSearchMarkets(e.target.value)}
              />
              <span className="ad-result-count"><span>{filteredMarkets.length}</span> markets</span>
              <button className="ad-add-btn" type="button" onClick={() => openMarketModal(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Market
              </button>
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Type</th>
                    <th>Coordinates</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Prices</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMarkets.length === 0 ? (
                    <tr className="ad-empty-row"><td colSpan="7">No markets found.</td></tr>
                  ) : (
                    filteredMarkets.map((market) => (
                      <tr key={market.id}>
                        <td>
                          <span className="ad-table-icon">{market.icon}</span>
                          <span className="ad-table-name">{market.name}</span>
                        </td>
                        <td>{market.type}</td>
                        <td>{market.lat?.toFixed?.(4) ?? market.lat}, {market.lng?.toFixed?.(4) ?? market.lng}</td>
                        <td>{market.hours || '—'}</td>
                        <td>
                          <span className={`ad-status-pill ${market.is_open ? 'open' : 'closed'}`}>
                            {market.is_open ? 'Open' : 'Closed'}
                          </span>
                        </td>
                        <td>
                          <span className="ad-manage-link" onClick={() => openMarketModal(market.id)}>
                            Edit / Manage Prices
                          </span>
                        </td>
                        <td>
                          <div className="ad-row-actions">
                            <button className="ad-icon-btn" type="button" onClick={() => openMarketModal(market.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-icon-btn danger" type="button" onClick={() => deleteMarket(market.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={activeTab === 'recipes' ? 'ad-tab-panel active' : 'ad-tab-panel'}>
            <div className="ad-toolbar">
              <input
                className="ad-search-input"
                placeholder="Search recipes..."
                value={searchRecipes}
                onChange={(e) => setSearchRecipes(e.target.value)}
              />
              <span className="ad-result-count"><span>{filteredRecipes.length}</span> recipes</span>
              <button className="ad-add-btn" type="button" onClick={() => openRecipeModal(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Recipe
              </button>
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Recipe</th>
                    <th>Type</th>
                    <th>Calories</th>
                    <th>Cost</th>
                    <th>Macros</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.length === 0 ? (
                    <tr className="ad-empty-row"><td colSpan="7">No recipes found.</td></tr>
                  ) : (
                    filteredRecipes.map((recipe) => (
                      <tr key={recipe.id}>
                        <td>
                          <span className="ad-table-icon">{recipe.emoji}</span>
                          <span className="ad-table-name">{recipe.name}</span>
                        </td>
                        <td>{recipe.type}</td>
                        <td>{recipe.kcal ?? '—'} kcal</td>
                        <td>₱{recipe.cost ?? '—'}</td>
                        <td>P{recipe.protein_g ?? '—'} / C{recipe.carbs_g ?? '—'} / F{recipe.fats_g ?? '—'}</td>
                        <td>
                          <span className="ad-manage-link" onClick={() => openRecipeModal(recipe.id)}>
                            Edit / Ingredients / Steps
                          </span>
                        </td>
                        <td>
                          <div className="ad-row-actions">
                            <button className="ad-icon-btn" type="button" onClick={() => openRecipeModal(recipe.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-icon-btn danger" type="button" onClick={() => deleteRecipe(recipe.id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={activeTab === 'fnri' ? 'ad-tab-panel active' : 'ad-tab-panel'}>
            <div className="ad-toolbar">
              <input
                className="ad-search-input"
                placeholder="Search FNRI food items..."
                value={searchFnri}
                onChange={(e) => setSearchFnri(e.target.value)}
              />
              <span className="ad-result-count"><span>{filteredFnri.length}</span> items (showing first 200)</span>
              <button className="ad-add-btn" type="button" onClick={() => openFnriModal(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Food Item
              </button>
            </div>
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Food Item</th>
                    <th>Calories</th>
                    <th>Protein</th>
                    <th>Fat</th>
                    <th>Carbs</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFnri.length === 0 ? (
                    <tr className="ad-empty-row"><td colSpan="6">No food items found.</td></tr>
                  ) : (
                    filteredFnri.map((item) => (
                      <tr key={item.fct_id}>
                        <td>
                          <span className="ad-table-name">{item.food_name}</span>
                          <div style={{ fontSize: 11, color: '#4d6e5a', marginTop: 4 }}>{item.alternate_name || '—'}</div>
                        </td>
                        <td>{item.energy_kcal ?? '—'} kcal</td>
                        <td>{item.protein_g ?? '—'}g</td>
                        <td>{item.total_fat_g ?? '—'}g</td>
                        <td>{item.available_carbohydrate_g ?? '—'}g</td>
                        <td>
                          <div className="ad-row-actions">
                            <button className="ad-icon-btn" type="button" onClick={() => openFnriModal(item.fct_id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button className="ad-icon-btn danger" type="button" onClick={() => deleteFnri(item.fct_id)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <div className={marketModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay'} onClick={(e) => { if (e.target === e.currentTarget) closeMarketModal(); }}>
        <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ad-modal-title" id="ad-market-modal-title">
            {marketModalMode === 'edit' ? 'Edit Market' : 'Add New Market'}
          </div>
          <input type="hidden" value={marketForm.id} />
          <div className="ad-form-grid">
            <div className="ad-field ad-field-full">
              <label className="ad-field-label">Market Name</label>
              <input className="ad-input" value={marketForm.name} onChange={(e) => handleMarketFormChange('name', e.target.value)} placeholder="e.g. Tarlac City Public Market" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Type</label>
              <select className="ad-select" value={marketForm.type} onChange={(e) => handleMarketFormChange('type', e.target.value)}>
                {MARKET_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Icon (emoji)</label>
              <input className="ad-input" value={marketForm.icon} onChange={(e) => handleMarketFormChange('icon', e.target.value)} placeholder="🏪" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Latitude</label>
              <input className="ad-input" type="number" step="0.0001" value={marketForm.lat} onChange={(e) => handleMarketFormChange('lat', e.target.value)} placeholder="15.4889" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Longitude</label>
              <input className="ad-input" type="number" step="0.0001" value={marketForm.lng} onChange={(e) => handleMarketFormChange('lng', e.target.value)} placeholder="120.5985" />
            </div>
            <div className="ad-field ad-field-full">
              <label className="ad-field-label">Address</label>
              <input className="ad-input" value={marketForm.address} onChange={(e) => handleMarketFormChange('address', e.target.value)} placeholder="Street, City" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Operating Hours</label>
              <input className="ad-input" value={marketForm.hours} onChange={(e) => handleMarketFormChange('hours', e.target.value)} placeholder="4:00 AM – 6:00 PM" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: '#8aab96' }}>
                <input type="checkbox" checked={marketForm.open} onChange={(e) => handleMarketFormChange('open', e.target.checked)} />
                Currently Open
              </label>
            </div>
          </div>

          <div className="ad-sub-section">
            <div className="ad-sub-title">Ingredient Prices & Stock</div>
            <div id="ad-market-ing-rows">
              {marketIngredients.map((ing, idx) => (
                <div key={idx} className="ad-sub-row">
                  <input className="ad-input" placeholder="Ingredient name" value={ing.name} onChange={(e) => updateMarketIngredient(idx, 'name', e.target.value)} />
                  <input className="ad-input" placeholder="Qty" value={ing.qty} onChange={(e) => updateMarketIngredient(idx, 'qty', e.target.value)} />
                  <input className="ad-input" type="number" placeholder="₱" value={ing.price} onChange={(e) => updateMarketIngredient(idx, 'price', e.target.value)} />
                  <select className="ad-select" value={ing.status} onChange={(e) => updateMarketIngredient(idx, 'status', e.target.value)}>
                    <option value="avail">Avail</option>
                    <option value="limited">Limited</option>
                    <option value="unavail">Unavail</option>
                  </select>
                  <button className="ad-sub-remove" type="button" onClick={() => removeMarketIngredientRow(idx)}>✕</button>
                </div>
              ))}
            </div>
            <button className="ad-sub-add-btn" type="button" onClick={addMarketIngredientRow}>+ Add Ingredient</button>
          </div>

          <div className="ad-modal-actions">
            <button className="ad-btn ad-btn-outline" type="button" onClick={closeMarketModal}>Cancel</button>
            <button className="ad-btn ad-btn-primary" type="button" onClick={saveMarket}>Save Market</button>
          </div>
        </div>
      </div>

      <div className={recipeModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay'} onClick={(e) => { if (e.target === e.currentTarget) closeRecipeModal(); }}>
        <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ad-modal-title" id="ad-recipe-modal-title">
            {recipeModalMode === 'edit' ? 'Edit Recipe' : 'Add New Recipe'}
          </div>
          <div className="ad-form-grid">
            <div className="ad-field ad-field-full">
              <label className="ad-field-label">Recipe Name</label>
              <input className="ad-input" value={recipeForm.name} onChange={(e) => handleRecipeFormChange('name', e.target.value)} placeholder="e.g. Egg & Malunggay Scramble" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Emoji</label>
              <input className="ad-input" value={recipeForm.emoji} onChange={(e) => handleRecipeFormChange('emoji', e.target.value)} placeholder="🍳" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Meal Type</label>
              <select className="ad-select" value={recipeForm.type} onChange={(e) => handleRecipeFormChange('type', e.target.value)}>
                {RECIPE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Difficulty</label>
              <select className="ad-select" value={recipeForm.difficulty} onChange={(e) => handleRecipeFormChange('difficulty', e.target.value)}>
                {RECIPE_DIFFICULTY.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Cook Time (min)</label>
              <input className="ad-input" type="number" value={recipeForm.cookTime} onChange={(e) => handleRecipeFormChange('cookTime', e.target.value)} placeholder="15" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Servings</label>
              <input className="ad-input" type="number" value={recipeForm.servings} onChange={(e) => handleRecipeFormChange('servings', e.target.value)} placeholder="1" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Cost (₱)</label>
              <input className="ad-input" type="number" value={recipeForm.cost} onChange={(e) => handleRecipeFormChange('cost', e.target.value)} placeholder="45" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Calories</label>
              <input className="ad-input" type="number" value={recipeForm.kcal} onChange={(e) => handleRecipeFormChange('kcal', e.target.value)} placeholder="380" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Protein (g)</label>
              <input className="ad-input" type="number" value={recipeForm.protein} onChange={(e) => handleRecipeFormChange('protein', e.target.value)} placeholder="24" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Carbs (g)</label>
              <input className="ad-input" type="number" value={recipeForm.carbs} onChange={(e) => handleRecipeFormChange('carbs', e.target.value)} placeholder="18" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Fats (g)</label>
              <input className="ad-input" type="number" value={recipeForm.fats} onChange={(e) => handleRecipeFormChange('fats', e.target.value)} placeholder="12" />
            </div>
          </div>

          <div className="ad-field" style={{ marginBottom: 12 }}>
            <label className="ad-field-label">Dietary Tags</label>
            <div className="ad-checkbox-row">
              {DIETARY_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={recipeForm.dietTags.includes(option.value) ? 'ad-checkbox-pill selected' : 'ad-checkbox-pill'}
                  onClick={() => toggleRecipeTag('dietTags', option.value)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="ad-field" style={{ marginBottom: 12 }}>
            <label className="ad-field-label">Goal Tags</label>
            <div className="ad-checkbox-row">
              {GOAL_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={recipeForm.goalTags.includes(option.value) ? 'ad-checkbox-pill selected' : 'ad-checkbox-pill'}
                  onClick={() => toggleRecipeTag('goalTags', option.value)}
                >
                  {option.label}
                </div>
              ))}
            </div>
          </div>

          <div className="ad-sub-section">
            <div className="ad-sub-title">Ingredients</div>
            {recipeIngredients.map((ing, idx) => (
              <div key={idx} className="ad-sub-row" style={{ gridTemplateColumns: '1fr 90px 90px 32px' }}>
                <input className="ad-input" placeholder="Ingredient name" value={ing.name} onChange={(e) => updateRecipeIngredient(idx, 'name', e.target.value)} />
                <input className="ad-input" placeholder="Qty" value={ing.qty} onChange={(e) => updateRecipeIngredient(idx, 'qty', e.target.value)} />
                <select className="ad-select" value={ing.status} onChange={(e) => updateRecipeIngredient(idx, 'status', e.target.value)}>
                  <option value="avail">Avail</option>
                  <option value="warn">Warn</option>
                </select>
                <button className="ad-sub-remove" type="button" onClick={() => removeRecipeIngredientRow(idx)}>✕</button>
              </div>
            ))}
            <button className="ad-sub-add-btn" type="button" onClick={addRecipeIngredientRow}>+ Add Ingredient</button>
          </div>

          <div className="ad-sub-section">
            <div className="ad-sub-title">Cooking Steps</div>
            {recipeSteps.map((step, idx) => (
              <div key={idx} style={{ marginBottom: 8, padding: 10, background: '#111f16', borderRadius: 9, border: '1px solid rgba(45,220,122,0.08)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="ad-input" placeholder="Step title" style={{ flex: 1 }} value={step.title} onChange={(e) => updateRecipeStep(idx, 'title', e.target.value)} />
                  <input className="ad-input" type="number" placeholder="Timer (sec)" style={{ width: 110 }} value={step.timer} onChange={(e) => updateRecipeStep(idx, 'timer', e.target.value)} />
                  <button className="ad-sub-remove" type="button" onClick={() => removeRecipeStepRow(idx)}>✕</button>
                </div>
                <textarea className="ad-textarea" placeholder="Step description" value={step.description} onChange={(e) => updateRecipeStep(idx, 'description', e.target.value)} />
              </div>
            ))}
            <button className="ad-sub-add-btn" type="button" onClick={addRecipeStepRow}>+ Add Step</button>
          </div>

          <div className="ad-modal-actions">
            <button className="ad-btn ad-btn-outline" type="button" onClick={closeRecipeModal}>Cancel</button>
            <button className="ad-btn ad-btn-primary" type="button" onClick={saveRecipe}>Save Recipe</button>
          </div>
        </div>
      </div>

      <div className={fnriModalOpen ? 'ad-modal-overlay active' : 'ad-modal-overlay'} onClick={(e) => { if (e.target === e.currentTarget) closeFnriModal(); }}>
        <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ad-modal-title" id="ad-fnri-modal-title">
            {fnriModalMode === 'edit' ? 'Edit Food Item' : 'Add New Food Item'}
          </div>
          <div className="ad-form-grid">
            <div className="ad-field">
              <label className="ad-field-label">FCT ID</label>
              <input className="ad-input" value={fnriForm.fct_id} onChange={(e) => setFnriForm((prev) => ({ ...prev, fct_id: e.target.value }))} placeholder="A001" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Food Name</label>
              <input className="ad-input" value={fnriForm.food_name} onChange={(e) => setFnriForm((prev) => ({ ...prev, food_name: e.target.value }))} placeholder="Rice, cooked, white" />
            </div>
            <div className="ad-field ad-field-full">
              <label className="ad-field-label">Alternate / Local Name</label>
              <input className="ad-input" value={fnriForm.alternate_name} onChange={(e) => setFnriForm((prev) => ({ ...prev, alternate_name: e.target.value }))} placeholder="Kanin" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Energy (kcal per 100g)</label>
              <input className="ad-input" type="number" value={fnriForm.energy_kcal} onChange={(e) => setFnriForm((prev) => ({ ...prev, energy_kcal: e.target.value }))} placeholder="130" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Protein (g)</label>
              <input className="ad-input" type="number" value={fnriForm.protein_g} onChange={(e) => setFnriForm((prev) => ({ ...prev, protein_g: e.target.value }))} placeholder="2.4" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Total Fat (g)</label>
              <input className="ad-input" type="number" value={fnriForm.total_fat_g} onChange={(e) => setFnriForm((prev) => ({ ...prev, total_fat_g: e.target.value }))} placeholder="0.2" />
            </div>
            <div className="ad-field">
              <label className="ad-field-label">Available Carbs (g)</label>
              <input className="ad-input" type="number" value={fnriForm.available_carbohydrate_g} onChange={(e) => setFnriForm((prev) => ({ ...prev, available_carbohydrate_g: e.target.value }))} placeholder="28.7" />
            </div>
            <div className="ad-field ad-field-full">
              <label className="ad-field-label">Dietary Fiber (g)</label>
              <input className="ad-input" type="number" value={fnriForm.dietary_fiber_g} onChange={(e) => setFnriForm((prev) => ({ ...prev, dietary_fiber_g: e.target.value }))} placeholder="0.4" />
            </div>
          </div>
          <div className="ad-modal-actions">
            <button className="ad-btn ad-btn-outline" type="button" onClick={closeFnriModal}>Cancel</button>
            <button className="ad-btn ad-btn-primary" type="button" onClick={saveFnri}>Save Food Item</button>
          </div>
        </div>
      </div>

      <div className={toast.visible ? 'ad-toast show' : 'ad-toast' + (toast.error ? ' error' : '')}>
        {toast.message}
      </div>
    </div>
  );
}
