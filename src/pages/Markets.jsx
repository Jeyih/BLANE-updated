import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { IngSeasonTag } from '../components/SeasonalBadges';
import '../styles/markets.css';
import 'leaflet/dist/leaflet.css';

const FILTERS = ['All', 'Palengke', 'Supermarket', 'Talipapa', 'Grocery'];

const TYPE_META = {
  palengke:    { label: 'Palengke',    color: '#60a5fa' },
  supermarket: { label: 'Supermarket', color: '#2ddc7a' },
  talipapa:    { label: 'Talipapa',    color: '#fbbf24' },
  grocery:     { label: 'Grocery',     color: '#a78bfa' },
};

const DEFAULT_CENTER = { lat: 15.4858, lng: 120.5970 };

const initialLocationState = {
  name: 'Tarlac City, Central Luzon, PH',
  sub: 'Showing markets within 3 km radius · Last updated just now',
};

const TARLAC_LOCATIONS = [
  { name: 'Tarlac City Public Market', sub: 'Poblacion, Central Tarlac City', lat: 15.4858, lng: 120.5970 },
  { name: 'San Roque', sub: 'Commercial center district', lat: 15.4720, lng: 120.6050 },
  { name: 'Capas Hub', sub: 'Southern market corridor', lat: 15.3333, lng: 120.5894 },
  { name: 'Paniqui Hub', sub: 'Northern trading hub', lat: 15.6667, lng: 120.5833 },
  { name: 'Concepcion', sub: 'East agri-commercial zone', lat: 15.3244, lng: 120.6558 },
];

function normalizeIngredientName(name) {
  return String(name || '').trim().toLowerCase();
}

function getSavedMealIds() {
  try {
    const savedPlan = JSON.parse(localStorage.getItem('blane_meal_plan') || '{}');
    const selectedDay = Number(localStorage.getItem('blane_meal_plan_day'));
    const daySlots = Number.isInteger(selectedDay) && Array.isArray(savedPlan[selectedDay])
      ? savedPlan[selectedDay]
      : Object.values(savedPlan).flat();
    return [...new Set(
      daySlots
        .map((slot) => slot?.mealId)
        .filter(Boolean)
        .map((id) => String(id))
    )];
  } catch (error) {
    console.error('Failed to read saved meal plan:', error);
    return [];
  }
}

export default function Markets() {
  const { user } = useAuth();
  const [markets, setMarkets] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [locationText, setLocationText] = useState(initialLocationState);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);

  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const marketRequestRef = useRef(0);

  useEffect(() => {
    if (!user) return;
    loadMarkets();
  }, [user]);

  useEffect(() => {
    function refreshMealPlanIngredients() {
      if (user) loadMarkets();
    }

    window.addEventListener('blane-meal-plan-updated', refreshMealPlanIngredients);
    function handleMealPlanStorage(event) {
      if (event.key === 'blane_meal_plan' || event.key === 'blane_meal_plan_day') {
        refreshMealPlanIngredients();
      }
    }

    window.addEventListener('storage', handleMealPlanStorage);
    return () => {
      window.removeEventListener('blane-meal-plan-updated', refreshMealPlanIngredients);
      window.removeEventListener('storage', handleMealPlanStorage);
    };
  }, [user]);

  // Clean up Leaflet map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!mapRef.current) initMap();
      else updateMap();
    }
  }, [loading, activeFilter, markets, selectedMarketId, userCoords]);

  const filteredMarkets = useMemo(() => {
    if (activeFilter === 'All') return markets;
    return markets.filter((market) => market.type === activeFilter.toLowerCase());
  }, [activeFilter, markets]);

  const sortedMarkets = useMemo(() => {
    return [...filteredMarkets].sort((a, b) => a.distance - b.distance);
  }, [filteredMarkets]);

  const selectedMarket = useMemo(() => {
    return markets.find((market) => market.id === selectedMarketId) || null;
  }, [markets, selectedMarketId]);

  async function loadMarkets() {
    const requestId = ++marketRequestRef.current;
    setLoading(true);
    const { data: marketsData, error: marketsErr } = await supabase
      .from('markets')
      .select('*')
      .order('name');

    if (requestId !== marketRequestRef.current) return;
    if (marketsErr) {
      console.error('Failed to load markets:', marketsErr.message);
      setMarkets([]);
      setLoading(false);
      return;
    }

    const savedMealIds = getSavedMealIds();
    const { data: mealIngredients, error: mealIngredientsError } = savedMealIds.length
      ? await supabase
        .from('recipe_ingredients')
        .select('*')
        .in('recipe_id', savedMealIds)
      : { data: [], error: null };

    if (requestId !== marketRequestRef.current) return;
    if (mealIngredientsError) {
      console.error('Failed to load meal plan ingredients:', mealIngredientsError.message);
    }

    const mealPlanIngredientNames = new Set(
      (mealIngredients || [])
        .map((ingredient) => ingredient.name || ingredient.ingredient_name || ingredient.food_name)
        .map(normalizeIngredientName)
        .filter(Boolean)
    );

    const ingredientResults = await Promise.all(
      (marketsData || []).map(async (market) => {
        const { data, error } = await supabase
          .from('market_ingredients')
          .select('*')
          .eq('market_id', market.id)
          .order('name');

        if (error) {
          console.error(`Failed to load ingredients for ${market.name}:`, error.message);
        }

        return { marketId: market.id, ingredients: data || [] };
      })
    );

    if (requestId !== marketRequestRef.current) return;

    const ingredientsByMarket = {};
    const ingredientCatalog = new Map();
    ingredientResults.forEach(({ marketId, ingredients }) => {
      ingredientsByMarket[marketId] = ingredients.map((ing) => {
        const ingredient = {
          name: ing.name,
          qty: ing.qty,
          price: ing.price == null ? '—' : '₱' + ing.price,
          status: ing.status,
        };

        const key = normalizeIngredientName(ing.name);
        if (key && !ingredientCatalog.has(key)) ingredientCatalog.set(key, ingredient.name);
        return ingredient;
      });
    });

    const loaded = (marketsData || []).map((market) => ({
      id: market.id,
      name: market.name,
      type: market.type,
      icon: market.icon,
      distance: market.distance_km || 0,
      open: market.is_open,
      hours: market.hours || 'Hours unknown',
      address: market.address || 'Address unavailable',
      lat: market.lat || DEFAULT_CENTER.lat,
      lng: market.lng || DEFAULT_CENTER.lng,
      availableTags: completeMarketIngredients(ingredientsByMarket[market.id] || [], ingredientCatalog, mealPlanIngredientNames)
        .map((i) => i.name),
      ingredients: completeMarketIngredients(ingredientsByMarket[market.id] || [], ingredientCatalog, mealPlanIngredientNames),
    }));

    setMarkets(loaded);
    setLoading(false);
  }

  function selectPresetLocation(loc) {
    const coords = { lat: loc.lat, lng: loc.lng, accuracy: 50 };
    setUserCoords(coords);
    placeUserMarker(coords, 50);
    updateDistances(coords);
    setLocationText({
      name: loc.name,
      sub: `${loc.sub} · Live distances updated`,
    });
    if (mapRef.current) {
      mapRef.current.setView([loc.lat, loc.lng], 14, { animate: true });
    }
  }

  function initMap() {
    const container = document.getElementById('map');
    if (!container || container._leaflet_id) return;

    mapRef.current = L.map('map', { zoomControl: false }).setView([
      DEFAULT_CENTER.lat,
      DEFAULT_CENTER.lng,
    ], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    updateMap();
  }

  function updateMap() {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    filteredMarkets.forEach((market) => {
      const meta = TYPE_META[market.type] || TYPE_META.grocery;
      const marker = L.marker([market.lat, market.lng], {
        icon: buildMarketDivIcon(market, meta),
      }).addTo(markersLayerRef.current);

      marker.bindPopup(
        `<div style="font-family:DM Sans,sans-serif;min-width:160px;">` +
          `<div style="font-weight:700;font-size:13px;margin-bottom:3px;">${market.icon} ${market.name}</div>` +
          `<div style="font-size:11px;color:#666;">${meta.label} · ${market.distance} km · ` +
            (market.open
              ? '<span style="color:#16a34a;">Open</span>'
              : '<span style="color:#dc2626;">Closed</span>') +
          `</div>` +
        `</div>`
      );

      marker.on('click', () => handleSelectMarket(market.id));
    });

    if (userCoords) {
      placeUserMarker(userCoords, userCoords.accuracy || 50);
    }
  }

  function buildMarketDivIcon(market, meta) {
    const isSelected = market.id === selectedMarketId;
    const color = market.open ? meta.color : '#9ca3af';
    return L.divIcon({
      className: 'mk-leaflet-pin',
      html:
        `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;` +
        `background:${color};transform:rotate(-45deg);` +
        `border:2px solid ${isSelected ? '#ffffff' : 'rgba(0,0,0,0.25)'};` +
        `box-shadow:0 2px 6px rgba(0,0,0,0.4);` +
        `display:flex;align-items:center;justify-content:center;">` +
          `<span style="transform:rotate(45deg);font-size:14px;">${market.icon}</span>` +
        `</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function handleSelectMarket(id) {
    setSelectedMarketId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    if (!mapRef.current || !selectedMarket) return;
    mapRef.current.setView([selectedMarket.lat, selectedMarket.lng], 15, { animate: true });
  }, [selectedMarket]);

  function placeUserMarker(coords, accuracyMeters) {
    const youIcon = L.divIcon({
      className: 'mk-user-pin',
      html:
        '<div style="position:relative;width:18px;height:18px;">' +
          '<div style="position:absolute;inset:0;background:#2563eb;border:3px solid #ffffff;' +
          'border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.25);"></div>' +
        '</div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
    } else {
      userMarkerRef.current = L.marker([coords.lat, coords.lng], {
        icon: youIcon,
        zIndexOffset: 1000,
      })
        .addTo(mapRef.current)
        .bindPopup('<strong>You are here</strong>');
    }

    if (userCircleRef.current) {
      userCircleRef.current.setLatLng([coords.lat, coords.lng]);
      userCircleRef.current.setRadius(accuracyMeters || 50);
    } else {
      userCircleRef.current = L.circle([coords.lat, coords.lng], {
        radius: accuracyMeters || 50,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(mapRef.current);
    }
  }

  function updateDistances(coords) {
    setMarkets((prev) => prev.map((market) => ({
      ...market,
      distance: haversineKm(coords.lat, coords.lng, market.lat, market.lng),
    })));
  }

  function locateUser() {
    if (!navigator.geolocation) {
      window.alert('Your browser does not support geolocation.');
      return;
    }

    setLocationText({ name: 'Locating you…', sub: 'Requesting GPS permission' });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setUserCoords(coords);
        placeUserMarker(coords, pos.coords.accuracy);
        updateDistances(coords);
        setLocationText({
          name: 'Your Current Location',
          sub: `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)} · Accuracy ±${Math.round(pos.coords.accuracy)}m`,
        });
      },
      (err) => {
        let msg = 'Could not get your location.';
        if (err.code === 1) msg = 'Location permission denied. Showing default area instead.';
        if (err.code === 2) msg = 'Location unavailable. Showing default area instead.';
        if (err.code === 3) msg = 'Location request timed out. Showing default area instead.';
        setLocationText({ name: initialLocationState.name, sub: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function recenterMap() {
    if (!mapRef.current) return;
    if (userCoords) {
      mapRef.current.setView([userCoords.lat, userCoords.lng], 15, { animate: true });
    } else {
      mapRef.current.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 14, { animate: true });
    }
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }

  return (
    <>
      <Navbar />
      <main className="mk-main">
        <div className="mk-content">
          <div className="mk-page-header">
            <div>
              <h1 className="mk-page-title">GeoMarket Scanner</h1>
              <p className="mk-page-sub">Find local markets and ingredients — Tarlac City, Central Luzon</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="mk-live-badge">● Live data</span>
            </div>
          </div>

          <div className="mk-location-bar">
            <div className="mk-location-icon">📍</div>
            <div className="mk-location-text">
              <div className="mk-location-name">{locationText.name}</div>
              <div className="mk-location-sub">{locationText.sub}</div>
            </div>
            <button className="mk-locate-btn" type="button" onClick={locateUser}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4" />
                <path d="M12 19v4" />
                <path d="M4.22 4.22l2.83 2.83" />
                <path d="M16.95 16.95l2.83 2.83" />
                <path d="M1 12h4" />
                <path d="M19 12h4" />
                <path d="M4.22 19.78l2.83-2.83" />
                <path d="M16.95 7.05l2.83-2.83" />
              </svg>
              Update Location
            </button>
          </div>

          {/* Quick Location Preset Chips for Ages 8-60 / Defense Demo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px',
            background: '#12261b',
            border: '1px solid rgba(45, 220, 122, 0.22)',
            borderRadius: '16px',
            padding: '12px 16px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#2ddc7a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📍 Quick Hub:</span>
            </span>
            {TARLAC_LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                type="button"
                onClick={() => selectPresetLocation(loc)}
                style={{
                  background: locationText.name === loc.name ? '#2ddc7a' : 'rgba(255, 255, 255, 0.06)',
                  color: locationText.name === loc.name ? '#0a1610' : '#d1fae5',
                  border: locationText.name === loc.name ? '1px solid #ffffff' : '1px solid rgba(45, 220, 122, 0.25)',
                  borderRadius: '100px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
              >
                {loc.name}
              </button>
            ))}
          </div>

          <div className="mk-filter-row">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={`mk-filter-btn ${filter === activeFilter ? 'active' : ''}`}
                type="button"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
            <span className="mk-market-count">
              <span>{filteredMarkets.length}</span> markets nearby
            </span>
          </div>

          <div className="mk-layout">
            <div className="mk-map-wrap">
              <div id="map"></div>
              <div className="mk-map-controls">
                <button className="mk-map-ctrl-btn" type="button" title="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                  +
                </button>
                <button className="mk-map-ctrl-btn" type="button" title="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                  −
                </button>
                <button className="mk-map-ctrl-btn" type="button" title="Re-center" onClick={recenterMap}>
                  ⊙
                </button>
              </div>

              <div className="mk-map-legend">
                {Object.keys(TYPE_META).map((type) => (
                  <div key={type} className="mk-legend-item">
                    <div className="mk-legend-dot" style={{ background: TYPE_META[type].color }} />
                    {TYPE_META[type].label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mk-list-col">
              {loading ? (
                <div className="mk-empty">
                  <span className="mk-empty-icon">⏳</span>
                  Loading markets…
                </div>
              ) : sortedMarkets.length === 0 ? (
                <div className="mk-empty">
                  <span className="mk-empty-icon">🗺️</span>
                  No markets match this filter.
                </div>
              ) : (
                sortedMarkets.map((market) => {
                  const meta = TYPE_META[market.type] || TYPE_META.grocery;
                  return (
                    <button
                      key={market.id}
                      type="button"
                      className={`mk-market-card ${market.id === selectedMarketId ? 'selected' : ''}`}
                      onClick={() => handleSelectMarket(market.id)}
                    >
                      <div className="mk-card-top">
                        <div className="mk-card-icon">{market.icon}</div>
                        <div className="mk-card-info">
                          <div className="mk-card-name">{market.name}</div>
                          <div className="mk-card-meta">
                            <span className={`mk-type-badge ${market.type}`}>{meta.label}</span>
                            <span className="mk-distance">📍 {market.distance} km</span>
                          </div>
                        </div>
                        <span className={`mk-status-badge ${market.open ? 'open' : 'closed'}`}>
                          {market.open ? '● Open' : '● Closed'}
                        </span>
                      </div>
                      <div className="mk-card-ingredients">
                        {market.availableTags.map((tag) => (
                          <span key={tag} className="mk-ing-tag found">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className={`mk-detail-panel ${selectedMarket ? 'open' : ''}`}>
            <div className="mk-detail-inner">
              {selectedMarket ? (
                <>
                  <div className="mk-detail-header">
                    <div className="mk-detail-title-block">
                      <div className="mk-detail-icon">{selectedMarket.icon}</div>
                      <div>
                        <div className="mk-detail-name">{selectedMarket.name}</div>
                        <div className="mk-detail-meta">
                          <span className={`mk-type-badge ${selectedMarket.type}`}>
                            {TYPE_META[selectedMarket.type]?.label}
                          </span>
                          <span className={`mk-status-badge ${selectedMarket.open ? 'open' : 'closed'}`}>
                            {selectedMarket.open ? '● Open' : '● Closed'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="mk-detail-close" type="button" onClick={() => setSelectedMarketId(null)}>
                      ✕
                    </button>
                  </div>

                  <div className="mk-info-chips">
                    <div className="mk-info-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <strong>{selectedMarket.distance} km</strong> away
                    </div>
                    <div className="mk-info-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      {selectedMarket.hours}
                    </div>
                    <div className="mk-info-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      {selectedMarket.address}
                    </div>
                  </div>

                  <div className="mk-detail-section-title">Ingredient Availability & Prices</div>
                  <div className="mk-ingredient-table">
                    <div className="mk-ing-row mk-ing-row-header">
                      <span>Ingredient</span>
                      <span style={{ textAlign: 'center' }}>Qty</span>
                      <span style={{ textAlign: 'center' }}>Price</span>
                      <span style={{ textAlign: 'center' }}>Status</span>
                      <span style={{ textAlign: 'center' }}>Season</span>
                    </div>
                    {selectedMarket.ingredients.map((ing) => (
                      <div key={ing.name} className="mk-ing-row">
                        <div className="mk-ing-row-name">
                          <span className="mk-ing-dot" />
                          {ing.name}
                        </div>
                        <div className="mk-ing-row-qty">{ing.qty}</div>
                        <div className="mk-ing-row-price">{ing.price}</div>
                        <div className={`mk-ing-row-status ${ing.status}`}>
                          {ing.status === 'avail'
                            ? '✓ Available'
                            : ing.status === 'limited'
                            ? '⚠ Limited'
                            : '✕ Unavailable'}
                        </div>
                        <div className="mk-ing-row-season">
                          <IngSeasonTag ingredientName={ing.name} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}

function completeMarketIngredients(existingIngredients, ingredientCatalog, mealPlanIngredientNames) {
  const existingByName = new Map(
    existingIngredients.map((ingredient) => [normalizeIngredientName(ingredient.name), ingredient])
  );

  return [...mealPlanIngredientNames]
    .map((key) => existingByName.get(key))
    .filter(Boolean);
}

function GeoMarketScanner({ markets, userCoords, onLocate }) {
  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [scanData, setScanData] = useState(null);
  const [gpsLabel, setGpsLabel] = useState('📡 Enable GPS Location');
  // Data moved to DB: placeholders to be populated by effects or parent loader
  const [quickSuggestions, setQuickSuggestions] = useState([]);
  const [todayPlanIngredients, setTodayPlanIngredients] = useState([]);
  const [substitutes, setSubstitutes] = useState({});

  useEffect(() => {
    if (userCoords) {
      setGpsLabel(`✓ GPS: ${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`);
    }
  }, [userCoords]);

  function runSearch(searchQuery) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }

    const matches = markets
      .map((market) => {
        const ingredients = market.ingredients.filter((ing) => ing.name.toLowerCase().includes(q));
        return { market, ingredients };
      })
      .filter((item) => item.ingredients.length > 0)
      .sort((a, b) => {
        if (a.market.open !== b.market.open) return b.market.open ? 1 : -1;
        return a.market.distance - b.market.distance;
      });

    setResults(matches);
  }

  function handleSearch() {
    runSearch(query);
    setActiveTab('search');
  }

  function handleQuickSearch(value) {
    setQuery(value);
    runSearch(value);
    setActiveTab('search');
  }

  function buildScanMatrix() {
    const marketsToScan = markets.slice(0, 5);
    const found = [];
    const limited = [];
    const missing = [];

    const matrix = todayPlanIngredients.map((ingredient) => {
      const row = { name: ingredient, statusByMarket: {} };
      let ingredientFound = false;
      let ingredientLimited = false;

      marketsToScan.forEach((market) => {
        const match = market.ingredients.find((ing) =>
          ing.name.toLowerCase().includes(ingredient.toLowerCase()) ||
          ingredient.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0])
        );

        const status = match ? match.status : 'unknown';
        row.statusByMarket[market.id] = status;

        if (status === 'avail') ingredientFound = true;
        if (status === 'limited') ingredientLimited = true;
      });

      if (ingredientFound) found.push(ingredient);
      else if (ingredientLimited) limited.push(ingredient);
      else missing.push(ingredient);

      return row;
    });

    const marketScores = marketsToScan.map((market) => {
      const score = matrix.reduce((count, row) => count + (row.statusByMarket[market.id] === 'avail' ? 1 : 0), 0);
      return { market, score };
    });

    const bestMarket = marketScores.sort((a, b) => b.score - a.score)[0] || null;

    setScanData({ matrix, markets: marketsToScan, found, limited, missing, bestMarket });
    setActiveTab('scan');
  }

  function getSubstitutes(ingredient) {
    return (substitutes[ingredient.toLowerCase()] || substitutes.default) || [];
  }

  return (
    <div className="gm-scanner">
      <div className="gm-header">
        <div className="gm-header-left">
          <div className="gm-header-icon">🔍</div>
          <div>
            <div className="gm-title">GeoMarket Ingredient Scanner</div>
            <div className="gm-sub">Find ingredients at nearby markets · Module 04</div>
          </div>
        </div>
        <button className="gm-gps-badge" type="button" onClick={() => { setGpsLabel('📡 Locating...'); onLocate(); }}>
          {gpsLabel}
        </button>
      </div>

      <div className="gm-tabs">
        <button className={`gm-tab ${activeTab === 'search' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('search')}>
          Search Ingredient
        </button>
        <button className={`gm-tab ${activeTab === 'scan' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('scan')}>
          Scan Meal Plan
        </button>
        <button className={`gm-tab ${activeTab === 'subs' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('subs')}>
          Substitutes
        </button>
      </div>

      <div className="gm-tab-body">
        <div className={`gm-panel ${activeTab === 'search' ? 'active' : ''}`}>
          <div className="gm-search-row">
            <div className="gm-search-wrap">
              <span className="gm-search-icon">🔍</span>
              <input
                className="gm-search-input"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSearch();
                }}
                placeholder="e.g. Malunggay, Bangus, Broccoli..."
              />
            </div>
            <button className="gm-search-btn" type="button" onClick={handleSearch}>
              Search
            </button>
          </div>

          <div className="gm-quick-pills">
            {quickSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="gm-quick-pill"
                onClick={() => handleQuickSearch(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="gm-search-results">
            {results.length === 0 ? (
              <div className="gm-no-results">
                Type an ingredient above or tap a suggestion to search.
              </div>
            ) : (
              results.map(({ market, ingredients }) => (
                <div key={market.id} className="gm-result-market">
                  <div className="gm-result-market-header">
                    <span className="gm-result-market-icon">{market.icon}</span>
                    <span className="gm-result-market-name">{market.name}</span>
                    <span className="gm-result-market-dist">
                      {market.distance} km · {market.open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  {ingredients.map((ing) => (
                    <div key={ing.name} className="gm-result-ing-row">
                      <div className="gm-result-ing-name">
                        <div className="gm-result-ing-dot" />
                        {ing.name}
                      </div>
                      <div className="gm-result-ing-price">{ing.price}</div>
                      <span className={`gm-result-ing-status ${ing.status}`}>
                        {ing.status === 'avail'
                          ? '✓ Available'
                          : ing.status === 'limited'
                          ? '⚠ Limited'
                          : '✕ Unavailable'}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`gm-panel ${activeTab === 'scan' ? 'active' : ''}`}>
          <div className="gm-scan-btn-row">
            <button className="gm-scan-btn" type="button" onClick={buildScanMatrix}>
              Scan Today's Meal Plan
            </button>
            <span className="gm-scan-meta">{todayPlanIngredients.length} ingredients to scan</span>
          </div>

          {!scanData ? (
            <div className="gm-no-results">
              Run the scan to compare today's plan against nearby market availability.
            </div>
          ) : (
            <>
              <div className="gm-scan-summary">
                <div className="gm-summary-chip found">✓ {scanData.found.length} Available</div>
                <div className="gm-summary-chip limited">⚠ {scanData.limited.length} Limited</div>
                <div className="gm-summary-chip missing">✕ {scanData.missing.length} Not Found</div>
              </div>

              <div className="gm-matrix-wrap">
                <table className="gm-matrix">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      {scanData.markets.map((market) => (
                        <th key={market.id} className="market-col">
                          {market.icon}
                          <br />
                          <span style={{ fontSize: 10 }}>{market.name.split(' ')[0]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scanData.matrix.map((row) => (
                      <tr key={row.name}>
                        <td className="gm-matrix-ing-cell">{row.name}</td>
                        {scanData.markets.map((market) => {
                          const status = row.statusByMarket[market.id] || 'unknown';
                          const symbol = status === 'avail' ? '✓' : status === 'limited' ? '⚠' : status === 'unavail' ? '✕' : '?';
                          return (
                            <td key={market.id} className="gm-matrix-status-cell">
                              <div className={`gm-matrix-dot ${status}`}>{symbol}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {scanData.bestMarket && (
                  <div className="gm-best-market">
                    <span className="gm-best-icon">🏆</span>
                    <div className="gm-best-text">
                      <strong>Best market: {scanData.bestMarket.market.name}</strong> carries {scanData.bestMarket.score} of {todayPlanIngredients.length} ingredients from today's meal plan · {scanData.bestMarket.market.open ? 'Open' : 'Closed'}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>

        <div className={`gm-panel ${activeTab === 'subs' ? 'active' : ''}`}>
          <p className="gm-sub-intro">
            Missing meal plan ingredients that are not found nearby and locally recommended substitutes.
          </p>
          <div className="gm-missing-list">
            {!scanData || scanData.missing.length === 0 ? (
              <div className="gm-no-results">
                {scanData ? 'No missing ingredients detected — everything on your meal plan is available.' : 'Run Scan Meal Plan first to identify missing ingredients.'}
              </div>
            ) : (
              scanData.missing.map((missing) => {
                const substitutes = getSubstitutes(missing);
                return (
                  <div key={missing} className="gm-missing-card">
                    <div className="gm-missing-name">{missing}</div>
                    {substitutes.map((sub) => (
                      <div key={sub.name} className="gm-sub-row">
                        <div className="gm-sub-icon">{sub.icon}</div>
                        <div>
                          <div className="gm-sub-meta"><strong>{sub.name}</strong></div>
                          <div className="gm-sub-note">{sub.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

