import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
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

  useEffect(() => {
    if (!user) return;
    loadMarkets();
  }, [user]);

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
    setLoading(true);
    const { data: marketsData, error: marketsErr } = await supabase
      .from('markets')
      .select('*')
      .order('name');

    if (marketsErr) {
      console.error('Failed to load markets:', marketsErr.message);
      setMarkets([]);
      setLoading(false);
      return;
    }

    const { data: ingredientsData, error: ingErr } = await supabase
      .from('market_ingredients')
      .select('*');

    if (ingErr) {
      console.error('Failed to load market ingredients:', ingErr.message);
    }

    const ingredientsByMarket = {};
    (ingredientsData || []).forEach((ing) => {
      if (!ingredientsByMarket[ing.market_id]) ingredientsByMarket[ing.market_id] = [];
      ingredientsByMarket[ing.market_id].push({
        name: ing.name,
        qty: ing.qty,
        price: '₱' + ing.price,
        status: ing.status,
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
      availableTags: (ingredientsByMarket[market.id] || []).slice(0, 6).map((i) => i.name),
      ingredients: ingredientsByMarket[market.id] || [],
    }));

    setMarkets(loaded);
    setLoading(false);
  }

  function initMap() {
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
              <h1 className="mk-page-title">Nearby Markets</h1>
              <p className="mk-page-sub">GeoMarket Ingredient Scanner — Tarlac City, Central Luzon</p>
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
                        {market.availableTags.slice(0, 5).map((tag) => (
                          <span key={tag} className="mk-ing-tag found">
                            {tag}
                          </span>
                        ))}
                        {market.availableTags.length > 5 && (
                          <span className="mk-ing-tag">+{market.availableTags.length - 5}</span>
                        )}
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
