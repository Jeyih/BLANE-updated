import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useIngredientPrices } from '../context/PriceContext';
import { marketIngredientPriceText } from '../lib/pricing';
import {
  fetchMarketSnapshot,
  getMealPlanRecipeIds,
  mealPlanMarketIngredients,
  MARKET_REFRESH_MS,
  marketDistanceKm,
} from '../lib/market-refresh';
import Navbar from '../components/Navbar';
import MarketsTour from '../components/MarketsTour';
import { IngSeasonTag } from '../components/SeasonalBadges';
import '../styles/markets.css';
import 'leaflet/dist/leaflet.css';
const FILTERS = ['All', 'Palengke', 'Supermarket', 'Talipapa', 'Grocery'];
const TYPE_META = {
  palengke: { label: 'Palengke', color: '#60a5fa' },
  supermarket: { label: 'Supermarket', color: '#2ddc7a' },
  talipapa: { label: 'Talipapa', color: '#fbbf24' },
  grocery: { label: 'Grocery', color: '#a78bfa' },
};
const DEFAULT_CENTER = { lat: 15.4858, lng: 120.597 };
const initialLocationState = {
  name: 'Tarlac City, Central Luzon, PH',
  sub: 'Choose a hub or update your location to compare market distances',
};
const TARLAC_LOCATIONS = [
  {
    name: 'Tarlac City Public Market',
    sub: 'Poblacion, Central Tarlac City',
    lat: 15.4858,
    lng: 120.597,
  },
  { name: 'San Roque', sub: 'Commercial center district', lat: 15.472, lng: 120.605 },
  { name: 'Capas Hub', sub: 'Southern market corridor', lat: 15.3333, lng: 120.5894 },
  { name: 'Paniqui Hub', sub: 'Northern trading hub', lat: 15.6667, lng: 120.5833 },
  { name: 'Concepcion', sub: 'East agri-commercial zone', lat: 15.3244, lng: 120.6558 },
];
function Markets() {
  const { records: priceRecords } = useIngredientPrices();
  const { user } = useAuth();
  const [markets, setMarkets] = useState([]);
  const [tourOpen, setTourOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [marketSearchInput, setMarketSearchInput] = useState('');
  const [marketSearch, setMarketSearch] = useState('');
  const [selectedMarketId, setSelectedMarketId] = useState(null);
  const [locationText, setLocationText] = useState(initialLocationState);
  const [selectedLocation, setSelectedLocation] = useState('');
  const manualPinRef = useRef(false);
  const locationRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const coordsRef = useRef(null);
  coordsRef.current = userCoords;
  const refreshRef = useRef(null);
  const refreshJobRef = useRef(null);
  const abortRef = useRef(null);
  refreshRef.current = loadMarkets;
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const selectedGuideLineRef = useRef(null);
  const userMarkerRef = useRef(null);
  const userCircleRef = useRef(null);
  const routeRequestRef = useRef(0);
  const routeIdentityRef = useRef(null);
  const marketRequestRef = useRef(0);
  useEffect(() => {
    if (!user?.id) return;
    refreshRef.current();
    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        refreshRef.current({ silent: true });
      }
    };
    const timer = window.setInterval(refresh, MARKET_REFRESH_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('blane-prices-updated', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      marketRequestRef.current += 1;
      abortRef.current?.abort();
      refreshJobRef.current = null;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('blane-prices-updated', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    setTourOpen(localStorage.getItem(`blane_markets_tour_completed_${user.id}`) !== 'true');
  }, [user?.id]);
  useEffect(() => {
    function refreshMealPlanIngredients() {
      if (user) {
        marketRequestRef.current += 1;
        abortRef.current?.abort();
        refreshJobRef.current = null;
        refreshRef.current({ silent: true });
      }
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
  }, [loading, activeFilter, marketSearch, markets, selectedMarketId, userCoords]);
  const filteredMarkets = useMemo(() => {
    const query = marketSearch.trim().toLowerCase();
    return markets.filter(
      (market) =>
        (activeFilter === 'All' || market.type === activeFilter.toLowerCase()) &&
        (!query || `${market.name} ${market.address}`.toLowerCase().includes(query)),
    );
  }, [activeFilter, marketSearch, markets]);
  const sortedMarkets = useMemo(() => {
    return [...filteredMarkets].sort((a, b) => a.distance - b.distance);
  }, [filteredMarkets]);
  const selectedMarket = useMemo(() => {
    return markets.find((market) => market.id === selectedMarketId) || null;
  }, [markets, selectedMarketId]);
  function loadMarkets({ silent = false } = {}) {
    if (refreshJobRef.current) return refreshJobRef.current;
    const requestId = ++marketRequestRef.current;
    if (!silent) setLoading(true);
    setRefreshing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 2e4);
    const job = (async () => {
      try {
        const snapshot = await fetchMarketSnapshot(
          supabase,
          controller.signal,
          getMealPlanRecipeIds(localStorage),
        );
        if (requestId !== marketRequestRef.current) return;
        const ingredientsByMarket = new Map();
        for (const item of mealPlanMarketIngredients(
          snapshot.ingredients,
          snapshot.recipeIngredients,
        )) {
          const key = String(item.market_id);
          if (!ingredientsByMarket.has(key)) ingredientsByMarket.set(key, []);
          ingredientsByMarket
            .get(key)
            .push({
              name: item.name,
              qty: item.qty,
              price: item.price == null ? '\u2014' : '\u20B1' + item.price,
              status: item.status,
            });
        }
        const origin = coordsRef.current || DEFAULT_CENTER;
        const loaded = snapshot.markets
          .map((market) => {
            const ingredients = ingredientsByMarket.get(String(market.id)) || [];
            const position = {
              lat: market.lat ?? DEFAULT_CENTER.lat,
              lng: market.lng ?? DEFAULT_CENTER.lng,
            };
            return {
              id: market.id,
              name: market.name,
              type: market.type,
              icon: market.icon,
              distance: marketDistanceKm(origin, position),
              open: market.is_open,
              hours: market.hours || 'Hours unknown',
              address: market.address || 'Address unavailable',
              ...position,
              ingredients,
              availableTags: ingredients
                .filter((item) => ['avail', 'limited'].includes(item.status))
                .map((item) => item.name),
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setMarkets((previous) =>
          JSON.stringify(previous) === JSON.stringify(loaded) ? previous : loaded,
        );
        setLastRefreshedAt(new Date());
        setRefreshError('');
      } catch {
        if (requestId === marketRequestRef.current) {
          setRefreshError(
            'Market refresh unavailable. Any previously loaded records are still shown; try again when connected.',
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (requestId === marketRequestRef.current) {
          refreshJobRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    refreshJobRef.current = job;
    return job;
  }
  function selectPresetLocation(loc) {
    locationRequestRef.current += 1;
    manualPinRef.current = false;
    setSelectedLocation(loc.name);
    const coords = { lat: loc.lat, lng: loc.lng, accuracy: 0 };
    setUserCoords(coords);
    placeUserMarker(coords, 0);
    updateDistances(coords);
    setLocationText({ name: loc.name, sub: `${loc.sub} \xB7 Approximate area selected manually` });
    if (mapRef.current) {
      mapRef.current.setView([loc.lat, loc.lng], 14, { animate: true });
    }
  }
  function chooseManualPoint(latlng) {
    locationRequestRef.current += 1;
    manualPinRef.current = false;
    setSelectedLocation('');
    const coords = { lat: latlng.lat, lng: latlng.lng, accuracy: 0 };
    coordsRef.current = coords;
    setUserCoords(coords);
    placeUserMarker(coords, 0);
    updateDistances(coords);
    setLocationText({
      name: 'Your pinned location',
      sub: `Manual pin: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} \xB7 Location set manually`,
    });
  }
  function initMap() {
    const container = document.getElementById('map');
    if (!container || container._leaflet_id) return;
    mapRef.current = L.map('map', { zoomControl: false }).setView(
      [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      14,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);
    mapRef.current.on('click', (event) => {
      if (manualPinRef.current) chooseManualPoint(event.latlng);
    });
    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);
    updateMap();
  }
  function updateMap() {
    if (!mapRef.current || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();
    const selectedMarket2 = filteredMarkets.find((market) => market.id === selectedMarketId);
    const origin = userCoords || DEFAULT_CENTER;
    const routeIdentity = selectedMarket2
      ? `${selectedMarket2.id}:${origin.lat},${origin.lng}:${selectedMarket2.lat},${selectedMarket2.lng}`
      : null;
    const routeChanged = routeIdentityRef.current !== routeIdentity;
    if (routeChanged) {
      routeIdentityRef.current = routeIdentity;
      routeRequestRef.current += 1;
    }
    const routeRequestId = routeRequestRef.current;
    if (routeChanged && selectedGuideLineRef.current) {
      selectedGuideLineRef.current.remove();
      selectedGuideLineRef.current = null;
    }
    if (routeChanged && selectedMarket2) {
      const routeUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${selectedMarket2.lng},${selectedMarket2.lat}?overview=full&geometries=geojson`;
      fetch(routeUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`Routing request failed: ${response.status}`);
          return response.json();
        })
        .then((routeData) => {
          if (routeRequestId !== routeRequestRef.current || !mapRef.current) return;
          const coordinates = routeData.routes?.[0]?.geometry?.coordinates;
          if (!coordinates || coordinates.length < 2) throw new Error('No driving route found.');
          const routePoints = coordinates.map(([lng, lat]) => [lat, lng]);
          selectedGuideLineRef.current = L.layerGroup([
            L.polyline(routePoints, {
              color: '#ffffff',
              weight: 8,
              opacity: 0.9,
              lineCap: 'round',
            }),
            L.polyline(routePoints, { color: '#f97316', weight: 5, opacity: 1, lineCap: 'round' }),
          ]).addTo(mapRef.current);
          mapRef.current.fitBounds(L.latLngBounds(routePoints), {
            padding: [36, 36],
            maxZoom: 15,
            animate: true,
          });
        })
        .catch((error) => {
          if (routeRequestId !== routeRequestRef.current) return;
          routeIdentityRef.current = null;
          console.error('Failed to load driving route:', error.message);
        });
    }
    filteredMarkets.forEach((market) => {
      const meta = TYPE_META[market.type] || TYPE_META.grocery;
      const marker = L.marker([market.lat, market.lng], {
        icon: buildMarketDivIcon(market, meta),
      }).addTo(markersLayerRef.current);
      marker.bindPopup(
        `<div style="font-family:DM Sans,sans-serif;min-width:160px;"><div style="font-weight:700;font-size:13px;margin-bottom:3px;">${market.icon} ${market.name}</div><div style="font-size:11px;color:#666;">${meta.label} \xB7 ${market.distance} km \xB7 ` +
          (market.open
            ? '<span style="color:#16a34a;">Open</span>'
            : '<span style="color:#dc2626;">Closed</span>') +
          `</div></div>`,
      );
      marker.on('click', () => handleSelectMarket(market.id));
    });
    if (userCoords) {
      placeUserMarker(userCoords, userCoords.accuracy || 50);
    }
  }
  function buildMarketDivIcon(market, meta) {
    const isSelected = market.id === selectedMarketId;
    const opacity = selectedMarketId && !isSelected ? 0.35 : 1;
    const color = market.open ? meta.color : '#9ca3af';
    return L.divIcon({
      className: 'mk-leaflet-pin',
      html: `<div style="width:30px;height:30px;opacity:${opacity};border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid ${isSelected ? '#ffffff' : 'rgba(0,0,0,0.25)'};box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">${market.icon}</span></div>`,
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
  }, [selectedMarket?.id, selectedMarket?.lat, selectedMarket?.lng]);
  function placeUserMarker(coords, accuracyMeters) {
    const youIcon = L.divIcon({
      className: 'mk-user-pin',
      html: '<div style="position:relative;width:18px;height:18px;"><div style="position:absolute;inset:0;background:#2563eb;border:3px solid #ffffff;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.25);"></div></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (!mapRef.current) return;
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
    } else {
      userMarkerRef.current = L.marker([coords.lat, coords.lng], {
        icon: youIcon,
        zIndexOffset: 1e3,
      })
        .addTo(mapRef.current)
        .bindPopup('<strong>You are here</strong>');
    }
    if (userCircleRef.current) {
      userCircleRef.current.setLatLng([coords.lat, coords.lng]);
      userCircleRef.current.setRadius(accuracyMeters ?? 50);
    } else {
      userCircleRef.current = L.circle([coords.lat, coords.lng], {
        radius: accuracyMeters ?? 50,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(mapRef.current);
    }
  }
  function updateDistances(coords) {
    setMarkets((prev) =>
      prev.map((market) => ({ ...market, distance: marketDistanceKm(coords, market) })),
    );
  }
  function locateUser() {
    const request = ++locationRequestRef.current;
    if (!navigator.geolocation) {
      setLocationText((previous) => ({
        ...previous,
        sub: 'GPS is unavailable. Choose an area below or pin a location on the map.',
      }));
      return;
    }
    setLocationText({ name: 'Locating you\u2026', sub: 'Requesting GPS permission' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (request !== locationRequestRef.current) return;
        manualPinRef.current = false;
        setSelectedLocation('');
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setUserCoords(coords);
        placeUserMarker(coords, pos.coords.accuracy);
        updateDistances(coords);
        setLocationText({
          name: 'Your Current Location',
          sub: `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)} \xB7 Accuracy \xB1${Math.round(pos.coords.accuracy)}m`,
        });
      },
      (err) => {
        if (request !== locationRequestRef.current) return;
        let msg = 'Could not get your location.';
        if (err.code === 1)
          msg = 'Location permission denied. Choose an area below or pin a location on the map.';
        if (err.code === 2)
          msg = 'Location unavailable. Choose an area below or pin a location on the map.';
        if (err.code === 3)
          msg = 'Location request timed out. Choose an area below or pin a location on the map.';
        setLocationText((previous) => ({ ...previous, sub: msg }));
      },
      { enableHighAccuracy: true, timeout: 1e4, maximumAge: 0 },
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
  function closeTour() {
    if (user?.id) {
      localStorage.setItem(`blane_markets_tour_completed_${user.id}`, 'true');
    }
    setTourOpen(false);
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Navbar, null),
    React.createElement(MarketsTour, {
      isOpen: tourOpen,
      onClose: closeTour,
      hasSelectedMarket: Boolean(selectedMarket),
    }),
    React.createElement(
      'main',
      { className: 'mk-main' },
      React.createElement(
        'div',
        { className: 'mk-content' },
        React.createElement(
          'div',
          { className: 'mk-page-header', 'data-markets-tour': 'header' },
          React.createElement(
            'div',
            null,
            React.createElement('h1', { className: 'mk-page-title' }, 'GeoMarket Scanner'),
            React.createElement(
              'p',
              { className: 'mk-page-sub' },
              'Find local markets and ingredients \u2014 Tarlac City, Central Luzon',
            ),
          ),
          React.createElement(
            'div',
            { className: 'mk-header-actions' },
            React.createElement(
              'button',
              { className: 'mk-tour-trigger', type: 'button', onClick: () => setTourOpen(true) },
              React.createElement('span', { 'aria-hidden': 'true' }, '\u24D8'),
              ' Take a tour',
            ),
            React.createElement(
              'span',
              { className: 'mk-live-badge' },
              refreshError
                ? '\u25CF Refresh unavailable'
                : refreshing
                  ? '\u25CF Refreshing\u2026'
                  : '\u25CF Auto refresh',
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'mk-refresh-status' },
          React.createElement(
            'p',
            { role: 'status', 'aria-live': 'polite' },
            lastRefreshedAt
              ? `Market records refreshed ${lastRefreshedAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour12: true })} (Philippine time).`
              : 'No successful market refresh yet.',
            ' ',
            'Checks every 15 seconds while this page is visible.',
          ),
          React.createElement(
            'button',
            {
              className: 'mk-tour-trigger',
              type: 'button',
              disabled: refreshing,
              onClick: () => loadMarkets({ silent: true }),
            },
            refreshing ? 'Refreshing\u2026' : 'Refresh markets',
          ),
          refreshError &&
            React.createElement(
              'p',
              { className: 'mk-refresh-error', role: 'alert' },
              refreshError,
            ),
          React.createElement(
            'p',
            { className: 'mk-refresh-note' },
            'Availability is maintained by the project team. This refresh time does not confirm a store\u2019s current stock. Reference prices are estimates; check each source date.',
          ),
        ),
        React.createElement(
          'div',
          { className: 'mk-location-bar', 'data-markets-tour': 'location' },
          React.createElement('div', { className: 'mk-location-icon' }, '\u{1F4CD}'),
          React.createElement(
            'div',
            { className: 'mk-location-text' },
            React.createElement('div', { className: 'mk-location-name' }, locationText.name),
            React.createElement('div', { className: 'mk-location-sub' }, locationText.sub),
          ),
          React.createElement(
            'button',
            { className: 'mk-locate-btn', type: 'button', onClick: locateUser },
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
              React.createElement('circle', { cx: '12', cy: '12', r: '3' }),
              React.createElement('path', { d: 'M12 1v4' }),
              React.createElement('path', { d: 'M12 19v4' }),
              React.createElement('path', { d: 'M4.22 4.22l2.83 2.83' }),
              React.createElement('path', { d: 'M16.95 16.95l2.83 2.83' }),
              React.createElement('path', { d: 'M1 12h4' }),
              React.createElement('path', { d: 'M19 12h4' }),
              React.createElement('path', { d: 'M4.22 19.78l2.83-2.83' }),
              React.createElement('path', { d: 'M16.95 7.05l2.83-2.83' }),
            ),
            'Update Location',
          ),
        ),
        React.createElement(
          'form',
          {
            className: 'mk-market-search',
            role: 'search',
            'aria-label': 'Search markets',
            onSubmit: (event) => {
              event.preventDefault();
              setMarketSearch(marketSearchInput);
            },
          },
          React.createElement('input', {
            type: 'search',
            'aria-label': 'Market name or address',
            placeholder: 'Search market name or address\u2026',
            value: marketSearchInput,
            onChange: (event) => {
              setMarketSearchInput(event.target.value);
              if (!event.target.value) setMarketSearch('');
            },
          }),
          React.createElement('button', { type: 'submit', className: 'mk-tour-trigger' }, 'Search'),
          (marketSearchInput || marketSearch) &&
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'mk-tour-trigger',
                onClick: () => {
                  setMarketSearchInput('');
                  setMarketSearch('');
                },
              },
              'Clear',
            ),
        ),
        React.createElement(
          'div',
          { className: 'mk-filter-row', 'data-markets-tour': 'filters' },
          FILTERS.map((filter) =>
            React.createElement(
              'button',
              {
                key: filter,
                className: `mk-filter-btn ${filter === activeFilter ? 'active' : ''}`,
                type: 'button',
                onClick: () => setActiveFilter(filter),
              },
              filter,
            ),
          ),
          React.createElement(
            'span',
            { className: 'mk-market-count' },
            React.createElement('span', null, filteredMarkets.length),
            ' ',
            marketSearch ? 'matching markets' : 'markets nearby',
          ),
        ),
        React.createElement(
          'div',
          { className: 'mk-layout' },
          React.createElement(
            'div',
            { className: 'mk-map-wrap', 'data-markets-tour': 'map' },
            React.createElement('div', { id: 'map' }),
            React.createElement(
              'button',
              {
                className: 'mk-pin-location-btn',
                type: 'button',
                'aria-pressed': selectedLocation === '__pin',
                onClick: () => {
                  const pinning = selectedLocation !== '__pin';
                  locationRequestRef.current += 1;
                  manualPinRef.current = pinning;
                  setSelectedLocation(pinning ? '__pin' : '');
                  if (pinning)
                    setLocationText((previous) => ({
                      ...previous,
                      sub: 'Click a spot on the map to pin your location.',
                    }));
                },
              },
              '\u{1F4CD} ',
              selectedLocation === '__pin' ? 'Click map to pin' : 'Pin location',
            ),
            React.createElement(
              'div',
              { className: 'mk-map-controls' },
              React.createElement(
                'button',
                {
                  className: 'mk-map-ctrl-btn',
                  type: 'button',
                  title: 'Zoom in',
                  onClick: () => mapRef.current?.zoomIn(),
                },
                '+',
              ),
              React.createElement(
                'button',
                {
                  className: 'mk-map-ctrl-btn',
                  type: 'button',
                  title: 'Zoom out',
                  onClick: () => mapRef.current?.zoomOut(),
                },
                '\u2212',
              ),
              React.createElement(
                'button',
                {
                  className: 'mk-map-ctrl-btn',
                  type: 'button',
                  title: 'Re-center',
                  onClick: recenterMap,
                },
                '\u2299',
              ),
            ),
            React.createElement(
              'div',
              { className: 'mk-map-legend' },
              Object.keys(TYPE_META).map((type) =>
                React.createElement(
                  'div',
                  { key: type, className: 'mk-legend-item' },
                  React.createElement('div', {
                    className: 'mk-legend-dot',
                    style: { background: TYPE_META[type].color },
                  }),
                  TYPE_META[type].label,
                ),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'mk-list-col', 'data-markets-tour': 'list' },
            loading
              ? React.createElement(
                  'div',
                  { className: 'mk-empty' },
                  React.createElement('span', { className: 'mk-empty-icon' }, '\u23F3'),
                  'Loading markets\u2026',
                )
              : sortedMarkets.length === 0
                ? React.createElement(
                    'div',
                    { className: 'mk-empty' },
                    React.createElement('span', { className: 'mk-empty-icon' }, '\u{1F5FA}\uFE0F'),
                    'No markets match your search or filter.',
                  )
                : sortedMarkets.map((market) => {
                    const meta = TYPE_META[market.type] || TYPE_META.grocery;
                    return React.createElement(
                      'button',
                      {
                        key: market.id,
                        type: 'button',
                        className: `mk-market-card ${market.id === selectedMarketId ? 'selected' : ''}`,
                        onClick: () => handleSelectMarket(market.id),
                      },
                      React.createElement(
                        'div',
                        { className: 'mk-card-top' },
                        React.createElement('div', { className: 'mk-card-icon' }, market.icon),
                        React.createElement(
                          'div',
                          { className: 'mk-card-info' },
                          React.createElement('div', { className: 'mk-card-name' }, market.name),
                          React.createElement(
                            'div',
                            { className: 'mk-card-meta' },
                            React.createElement(
                              'span',
                              { className: `mk-type-badge ${market.type}` },
                              meta.label,
                            ),
                            React.createElement(
                              'span',
                              { className: 'mk-distance' },
                              '\u{1F4CD} ',
                              market.distance,
                              ' km',
                            ),
                          ),
                        ),
                        React.createElement(
                          'span',
                          { className: `mk-status-badge ${market.open ? 'open' : 'closed'}` },
                          market.open ? '\u25CF Open' : '\u25CF Closed',
                        ),
                      ),
                      React.createElement(
                        'div',
                        { className: 'mk-card-ingredients' },
                        market.availableTags.map((tag) =>
                          React.createElement(
                            'span',
                            { key: tag, className: 'mk-ing-tag found' },
                            tag,
                          ),
                        ),
                      ),
                    );
                  }),
          ),
        ),
        React.createElement(
          'div',
          {
            className: `mk-detail-panel ${selectedMarket ? 'open' : ''}`,
            'data-markets-tour': 'details',
          },
          React.createElement(
            'div',
            { className: 'mk-detail-inner' },
            selectedMarket
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    'div',
                    { className: 'mk-detail-header' },
                    React.createElement(
                      'div',
                      { className: 'mk-detail-title-block' },
                      React.createElement(
                        'div',
                        { className: 'mk-detail-icon' },
                        selectedMarket.icon,
                      ),
                      React.createElement(
                        'div',
                        null,
                        React.createElement(
                          'div',
                          { className: 'mk-detail-name' },
                          selectedMarket.name,
                        ),
                        React.createElement(
                          'div',
                          { className: 'mk-detail-meta' },
                          React.createElement(
                            'span',
                            { className: `mk-type-badge ${selectedMarket.type}` },
                            TYPE_META[selectedMarket.type]?.label,
                          ),
                          React.createElement(
                            'span',
                            {
                              className: `mk-status-badge ${selectedMarket.open ? 'open' : 'closed'}`,
                            },
                            selectedMarket.open ? '\u25CF Open' : '\u25CF Closed',
                          ),
                        ),
                      ),
                    ),
                    React.createElement(
                      'button',
                      {
                        className: 'mk-detail-close',
                        type: 'button',
                        onClick: () => setSelectedMarketId(null),
                      },
                      '\u2715',
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'mk-info-chips' },
                    React.createElement(
                      'div',
                      { className: 'mk-info-chip' },
                      React.createElement(
                        'svg',
                        {
                          viewBox: '0 0 24 24',
                          fill: 'none',
                          stroke: 'currentColor',
                          strokeWidth: '2',
                        },
                        React.createElement('path', {
                          d: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z',
                        }),
                        React.createElement('circle', { cx: '12', cy: '10', r: '3' }),
                      ),
                      React.createElement('strong', null, selectedMarket.distance, ' km'),
                      ' away',
                    ),
                    React.createElement(
                      'div',
                      { className: 'mk-info-chip' },
                      React.createElement(
                        'svg',
                        {
                          viewBox: '0 0 24 24',
                          fill: 'none',
                          stroke: 'currentColor',
                          strokeWidth: '2',
                        },
                        React.createElement('path', {
                          d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
                        }),
                        React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' }),
                      ),
                      selectedMarket.hours,
                    ),
                    React.createElement(
                      'div',
                      { className: 'mk-info-chip' },
                      React.createElement(
                        'svg',
                        {
                          viewBox: '0 0 24 24',
                          fill: 'none',
                          stroke: 'currentColor',
                          strokeWidth: '2',
                        },
                        React.createElement('path', {
                          d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
                        }),
                        React.createElement('polyline', { points: '9 22 9 12 15 12 15 22' }),
                      ),
                      selectedMarket.address,
                    ),
                  ),
                  React.createElement(
                    'div',
                    { className: 'mk-detail-section-title' },
                    'Meal Plan Ingredients & Prices',
                  ),
                  React.createElement(
                    'p',
                    { className: 'mk-refresh-note' },
                    'Only ingredients from your selected meal-plan day are shown.',
                  ),
                  React.createElement(
                    'div',
                    { className: 'mk-ingredient-table' },
                    React.createElement(
                      'div',
                      { className: 'mk-ing-row mk-ing-row-header' },
                      React.createElement('span', null, 'Ingredient'),
                      React.createElement('span', { style: { textAlign: 'center' } }, 'Qty'),
                      React.createElement('span', { style: { textAlign: 'center' } }, 'Price'),
                      React.createElement('span', { style: { textAlign: 'center' } }, 'Status'),
                      React.createElement('span', { style: { textAlign: 'center' } }, 'Season'),
                    ),
                    selectedMarket.ingredients.length === 0 &&
                      React.createElement(
                        'p',
                        { className: 'mk-empty' },
                        'No matching ingredients for your selected day. Add meals in Meal Plan or choose another market.',
                      ),
                    selectedMarket.ingredients.map((ing) =>
                      React.createElement(
                        'div',
                        { key: ing.name, className: 'mk-ing-row' },
                        React.createElement(
                          'div',
                          { className: 'mk-ing-row-name' },
                          React.createElement('span', { className: 'mk-ing-dot' }),
                          ing.name,
                        ),
                        React.createElement('div', { className: 'mk-ing-row-qty' }, ing.qty),
                        React.createElement(
                          'div',
                          { className: 'mk-ing-row-price' },
                          marketIngredientPriceText(ing, priceRecords),
                        ),
                        React.createElement(
                          'div',
                          { className: `mk-ing-row-status ${ing.status}` },
                          ing.status === 'avail'
                            ? '\u2713 Available'
                            : ing.status === 'limited'
                              ? '\u26A0 Limited'
                              : '\u2715 Unavailable',
                        ),
                        React.createElement(
                          'div',
                          { className: 'mk-ing-row-season' },
                          React.createElement(IngSeasonTag, { ingredientName: ing.name }),
                        ),
                      ),
                    ),
                  ),
                )
              : null,
          ),
        ),
      ),
    ),
  );
}
function GeoMarketScanner({ markets, userCoords, onLocate }) {
  const { records: priceRecords } = useIngredientPrices();
  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [scanData, setScanData] = useState(null);
  const [gpsLabel, setGpsLabel] = useState('\u{1F4E1} Enable GPS Location');
  const [quickSuggestions, setQuickSuggestions] = useState([]);
  const [todayPlanIngredients, setTodayPlanIngredients] = useState([]);
  const [substitutes, setSubstitutes] = useState({});
  useEffect(() => {
    if (userCoords) {
      setGpsLabel(`\u2713 GPS: ${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`);
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
        const match = market.ingredients.find(
          (ing) =>
            ing.name.toLowerCase().includes(ingredient.toLowerCase()) ||
            ingredient.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0]),
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
      const score = matrix.reduce(
        (count, row) => count + (row.statusByMarket[market.id] === 'avail' ? 1 : 0),
        0,
      );
      return { market, score };
    });
    const bestMarket = marketScores.sort((a, b) => b.score - a.score)[0] || null;
    setScanData({ matrix, markets: marketsToScan, found, limited, missing, bestMarket });
    setActiveTab('scan');
  }
  function getSubstitutes(ingredient) {
    return substitutes[ingredient.toLowerCase()] || substitutes.default || [];
  }
  return React.createElement(
    'div',
    { className: 'gm-scanner' },
    React.createElement(
      'div',
      { className: 'gm-header' },
      React.createElement(
        'div',
        { className: 'gm-header-left' },
        React.createElement('div', { className: 'gm-header-icon' }, '\u{1F50D}'),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'gm-title' }, 'GeoMarket Ingredient Scanner'),
          React.createElement(
            'div',
            { className: 'gm-sub' },
            'Find ingredients at nearby markets \xB7 Module 04',
          ),
        ),
      ),
      React.createElement(
        'button',
        {
          className: 'gm-gps-badge',
          type: 'button',
          onClick: () => {
            setGpsLabel('\u{1F4E1} Locating...');
            onLocate();
          },
        },
        gpsLabel,
      ),
    ),
    React.createElement(
      'div',
      { className: 'gm-tabs' },
      React.createElement(
        'button',
        {
          className: `gm-tab ${activeTab === 'search' ? 'active' : ''}`,
          type: 'button',
          onClick: () => setActiveTab('search'),
        },
        'Search Ingredient',
      ),
      React.createElement(
        'button',
        {
          className: `gm-tab ${activeTab === 'scan' ? 'active' : ''}`,
          type: 'button',
          onClick: () => setActiveTab('scan'),
        },
        'Scan Meal Plan',
      ),
      React.createElement(
        'button',
        {
          className: `gm-tab ${activeTab === 'subs' ? 'active' : ''}`,
          type: 'button',
          onClick: () => setActiveTab('subs'),
        },
        'Substitutes',
      ),
    ),
    React.createElement(
      'div',
      { className: 'gm-tab-body' },
      React.createElement(
        'div',
        { className: `gm-panel ${activeTab === 'search' ? 'active' : ''}` },
        React.createElement(
          'div',
          { className: 'gm-search-row' },
          React.createElement(
            'div',
            { className: 'gm-search-wrap' },
            React.createElement('span', { className: 'gm-search-icon' }, '\u{1F50D}'),
            React.createElement('input', {
              className: 'gm-search-input',
              type: 'text',
              value: query,
              onChange: (event) => setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') handleSearch();
              },
              placeholder: 'e.g. Malunggay, Bangus, Broccoli...',
            }),
          ),
          React.createElement(
            'button',
            { className: 'gm-search-btn', type: 'button', onClick: handleSearch },
            'Search',
          ),
        ),
        React.createElement(
          'div',
          { className: 'gm-quick-pills' },
          quickSuggestions.map((suggestion) =>
            React.createElement(
              'button',
              {
                key: suggestion,
                type: 'button',
                className: 'gm-quick-pill',
                onClick: () => handleQuickSearch(suggestion),
              },
              suggestion,
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'gm-search-results' },
          results.length === 0
            ? React.createElement(
                'div',
                { className: 'gm-no-results' },
                'Type an ingredient above or tap a suggestion to search.',
              )
            : results.map(({ market, ingredients }) =>
                React.createElement(
                  'div',
                  { key: market.id, className: 'gm-result-market' },
                  React.createElement(
                    'div',
                    { className: 'gm-result-market-header' },
                    React.createElement(
                      'span',
                      { className: 'gm-result-market-icon' },
                      market.icon,
                    ),
                    React.createElement(
                      'span',
                      { className: 'gm-result-market-name' },
                      market.name,
                    ),
                    React.createElement(
                      'span',
                      { className: 'gm-result-market-dist' },
                      market.distance,
                      ' km \xB7 ',
                      market.open ? 'Open' : 'Closed',
                    ),
                  ),
                  ingredients.map((ing) =>
                    React.createElement(
                      'div',
                      { key: ing.name, className: 'gm-result-ing-row' },
                      React.createElement(
                        'div',
                        { className: 'gm-result-ing-name' },
                        React.createElement('div', { className: 'gm-result-ing-dot' }),
                        ing.name,
                      ),
                      React.createElement(
                        'div',
                        { className: 'gm-result-ing-price' },
                        marketIngredientPriceText(ing, priceRecords),
                      ),
                      React.createElement(
                        'span',
                        { className: `gm-result-ing-status ${ing.status}` },
                        ing.status === 'avail'
                          ? '\u2713 Available'
                          : ing.status === 'limited'
                            ? '\u26A0 Limited'
                            : '\u2715 Unavailable',
                      ),
                    ),
                  ),
                ),
              ),
        ),
      ),
      React.createElement(
        'div',
        { className: `gm-panel ${activeTab === 'scan' ? 'active' : ''}` },
        React.createElement(
          'div',
          { className: 'gm-scan-btn-row' },
          React.createElement(
            'button',
            { className: 'gm-scan-btn', type: 'button', onClick: buildScanMatrix },
            "Scan Today's Meal Plan",
          ),
          React.createElement(
            'span',
            { className: 'gm-scan-meta' },
            todayPlanIngredients.length,
            ' ingredients to scan',
          ),
        ),
        !scanData
          ? React.createElement(
              'div',
              { className: 'gm-no-results' },
              "Run the scan to compare today's plan against nearby market availability.",
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(
                'div',
                { className: 'gm-scan-summary' },
                React.createElement(
                  'div',
                  { className: 'gm-summary-chip found' },
                  '\u2713 ',
                  scanData.found.length,
                  ' Available',
                ),
                React.createElement(
                  'div',
                  { className: 'gm-summary-chip limited' },
                  '\u26A0 ',
                  scanData.limited.length,
                  ' Limited',
                ),
                React.createElement(
                  'div',
                  { className: 'gm-summary-chip missing' },
                  '\u2715 ',
                  scanData.missing.length,
                  ' Not Found',
                ),
              ),
              React.createElement(
                'div',
                { className: 'gm-matrix-wrap' },
                React.createElement(
                  'table',
                  { className: 'gm-matrix' },
                  React.createElement(
                    'thead',
                    null,
                    React.createElement(
                      'tr',
                      null,
                      React.createElement('th', null, 'Ingredient'),
                      scanData.markets.map((market) =>
                        React.createElement(
                          'th',
                          { key: market.id, className: 'market-col' },
                          market.icon,
                          React.createElement('br', null),
                          React.createElement(
                            'span',
                            { style: { fontSize: 10 } },
                            market.name.split(' ')[0],
                          ),
                        ),
                      ),
                    ),
                  ),
                  React.createElement(
                    'tbody',
                    null,
                    scanData.matrix.map((row) =>
                      React.createElement(
                        'tr',
                        { key: row.name },
                        React.createElement('td', { className: 'gm-matrix-ing-cell' }, row.name),
                        scanData.markets.map((market) => {
                          const status = row.statusByMarket[market.id] || 'unknown';
                          const symbol =
                            status === 'avail'
                              ? '\u2713'
                              : status === 'limited'
                                ? '\u26A0'
                                : status === 'unavail'
                                  ? '\u2715'
                                  : '?';
                          return React.createElement(
                            'td',
                            { key: market.id, className: 'gm-matrix-status-cell' },
                            React.createElement(
                              'div',
                              { className: `gm-matrix-dot ${status}` },
                              symbol,
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ),
              ),
              scanData.bestMarket &&
                React.createElement(
                  'div',
                  { className: 'gm-best-market' },
                  React.createElement('span', { className: 'gm-best-icon' }, '\u{1F3C6}'),
                  React.createElement(
                    'div',
                    { className: 'gm-best-text' },
                    React.createElement(
                      'strong',
                      null,
                      'Best market: ',
                      scanData.bestMarket.market.name,
                    ),
                    ' carries ',
                    scanData.bestMarket.score,
                    ' of ',
                    todayPlanIngredients.length,
                    " ingredients from today's meal plan \xB7 ",
                    scanData.bestMarket.market.open ? 'Open' : 'Closed',
                  ),
                ),
            ),
      ),
      React.createElement(
        'div',
        { className: `gm-panel ${activeTab === 'subs' ? 'active' : ''}` },
        React.createElement(
          'p',
          { className: 'gm-sub-intro' },
          'Missing meal plan ingredients that are not found nearby and locally recommended substitutes.',
        ),
        React.createElement(
          'div',
          { className: 'gm-missing-list' },
          !scanData || scanData.missing.length === 0
            ? React.createElement(
                'div',
                { className: 'gm-no-results' },
                scanData
                  ? 'No missing ingredients detected \u2014 everything on your meal plan is available.'
                  : 'Run Scan Meal Plan first to identify missing ingredients.',
              )
            : scanData.missing.map((missing) => {
                const substitutes2 = getSubstitutes(missing);
                return React.createElement(
                  'div',
                  { key: missing, className: 'gm-missing-card' },
                  React.createElement('div', { className: 'gm-missing-name' }, missing),
                  substitutes2.map((sub) =>
                    React.createElement(
                      'div',
                      { key: sub.name, className: 'gm-sub-row' },
                      React.createElement('div', { className: 'gm-sub-icon' }, sub.icon),
                      React.createElement(
                        'div',
                        null,
                        React.createElement(
                          'div',
                          { className: 'gm-sub-meta' },
                          React.createElement('strong', null, sub.name),
                        ),
                        React.createElement('div', { className: 'gm-sub-note' }, sub.note),
                      ),
                    ),
                  ),
                );
              }),
        ),
      ),
    ),
  );
}
export { Markets as default };
