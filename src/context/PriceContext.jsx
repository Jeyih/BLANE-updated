import React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { loadPriceCatalogue, isSourcedPrice } from '../lib/pricing';
import { loadPriceReferenceData } from '../lib/price-reference.js';
import { PRICE_POLL_MS } from '../lib/price-refresh-policy';
const PriceContext = createContext(null);
function PriceProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({
    records: [],
    report: null,
    referenceData: null,
    foods: [],
    recipeIngredients: [],
    loading: true,
    warning: '',
  });
  const requestRef = useRef(0);
  const inFlightRef = useRef(null);
  const catalogueRef = useRef(null);
  const referenceDataRef = useRef(null);
  const refresh = useCallback(
    (options = {}) => {
      const { force = false, silent = false, reloadCatalogue = false } = options;
      const userId = user?.id || null;
      if (inFlightRef.current?.userId === userId) return inFlightRef.current.job;
      const request = ++requestRef.current;
      if (!silent) setState((prev) => ({ ...prev, loading: true }));
      const job = (async () => {
        const cachedCatalogue = catalogueRef.current;
        const cachedReferences = referenceDataRef.current;
        const [reference, catalogue, priceReferences] = await Promise.allSettled([
          fetch(`/.netlify/functions/ingredient-prices${force ? '?refresh=1' : ''}`, {
            cache: 'no-store',
            signal: AbortSignal.timeout(26e3),
          }).then(async (r) => {
            if (!r.ok) throw new Error('Reference source unavailable');
            const data = await r.json();
            if (!Array.isArray(data.records)) throw new Error('Invalid price feed');
            return data;
          }),
          user
            ? !reloadCatalogue && cachedCatalogue?.userId === userId
              ? Promise.resolve(cachedCatalogue.data)
              : loadPriceCatalogue(supabase)
            : Promise.resolve({ foods: [], recipeIngredients: [] }),
          cachedReferences && !reloadCatalogue
            ? Promise.resolve(cachedReferences)
            : loadPriceReferenceData(supabase),
        ]);
        if (request !== requestRef.current) return;
        if (catalogue.status === 'fulfilled')
          catalogueRef.current = { userId, data: catalogue.value };
        const feed = reference.status === 'fulfilled' ? reference.value : null;
        const dbReferences = priceReferences.status === 'fulfilled' ? priceReferences.value : null;
        if (dbReferences) referenceDataRef.current = dbReferences;
        const dbRecords = dbReferences
          ? [...dbReferences.daSnapshot.records, ...dbReferences.retailSnapshot.records]
          : null;
        const warnings = [
          reference.status === 'fulfilled'
            ? feed.warning
            : dbRecords
              ? 'Live refresh unavailable; showing the last database-saved DA and retailer quotes.'
              : 'Live refresh unavailable; sourced prices could not be loaded.',
          priceReferences.status === 'rejected'
            ? 'Database price references could not be loaded.'
            : '',
          catalogue.status === 'rejected'
            ? 'Ingredient catalogue could not be loaded; coverage is unavailable.'
            : '',
        ].filter(Boolean);
        setState((prev) => ({
          records: feed
            ? JSON.stringify(feed.records.filter(isSourcedPrice)) === JSON.stringify(prev.records)
              ? prev.records
              : feed.records.filter(isSourcedPrice)
            : dbRecords
              ? dbRecords.filter(isSourcedPrice)
              : prev.records,
          report: feed?.report || dbReferences?.daSnapshot.report || prev.report,
          referenceData: dbReferences || prev.referenceData,
          foods: catalogue.status === 'fulfilled' ? catalogue.value.foods : prev.foods,
          recipeIngredients:
            catalogue.status === 'fulfilled'
              ? catalogue.value.recipeIngredients
              : prev.recipeIngredients,
          lastCheckedAt: feed?.lastCheckedAt || prev.lastCheckedAt,
          loading: false,
          warning: warnings.join(' '),
        }));
      })().finally(() => {
        if (inFlightRef.current?.job === job) inFlightRef.current = null;
      });
      inFlightRef.current = { userId, job };
      return job;
    },
    [user?.id],
  );
  useEffect(() => {
    refresh();
    const reload = () => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false)
        refresh({ silent: true });
    };
    const edited = () => refresh({ force: true, reloadCatalogue: true });
    const timer = setInterval(reload, PRICE_POLL_MS);
    window.addEventListener('blane-prices-updated', edited);
    window.addEventListener('online', reload);
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', reload);
    return () => {
      requestRef.current += 1;
      inFlightRef.current = null;
      clearInterval(timer);
      window.removeEventListener('blane-prices-updated', edited);
      window.removeEventListener('online', reload);
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', reload);
    };
  }, [refresh]);
  return React.createElement(PriceContext.Provider, { value: { ...state, refresh } }, children);
}
const useIngredientPrices = () => useContext(PriceContext);
export { PriceProvider, useIngredientPrices };
