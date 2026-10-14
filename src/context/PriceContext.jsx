import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { loadPriceCatalogue, isSourcedPrice } from '../lib/pricing';
import snapshot from '../../public/data/ingredient-prices.json';
import retailSnapshot from '../../public/data/retail-prices.json';
import { PRICE_POLL_MS } from '../lib/price-refresh-policy';

const PriceContext = createContext(null);
export function PriceProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ records: [...snapshot.records, ...retailSnapshot.records], report: snapshot.report,
    foods: [], recipeIngredients: [], loading: true, warning: '' });
  const requestRef = useRef(0);
  const inFlightRef = useRef(null);
  const catalogueRef = useRef(null);
  const refresh = useCallback((options = {}) => {
    const { force = false, silent = false, reloadCatalogue = false } = options;
    const userId = user?.id || null;
    if (inFlightRef.current?.userId === userId) return inFlightRef.current.job;
    const request = ++requestRef.current;
    if (!silent) setState((prev) => ({ ...prev, loading: true }));
    const job = (async () => {
    const cachedCatalogue = catalogueRef.current;
    const [reference, catalogue] = await Promise.allSettled([
      fetch(`/.netlify/functions/ingredient-prices${force ? '?refresh=1' : ''}`, { cache: 'no-store', signal: AbortSignal.timeout(26000) }).then(async (r) => {
        if (!r.ok) throw new Error('Reference source unavailable');
        const data = await r.json();
        if (!Array.isArray(data.records)) throw new Error('Invalid price feed');
        return data;
      }),
      user ? !reloadCatalogue && cachedCatalogue?.userId === userId ? Promise.resolve(cachedCatalogue.data)
        : loadPriceCatalogue(supabase) : Promise.resolve({ foods: [], recipeIngredients: [] }),
    ]);
    if (request !== requestRef.current) return;
    if (catalogue.status === 'fulfilled') catalogueRef.current = { userId, data: catalogue.value };
    const feed = reference.status === 'fulfilled' ? reference.value : null;
    const warnings = [reference.status === 'fulfilled' ? feed.warning : 'Live refresh unavailable; showing the last imported DA and retailer quotes.',
      catalogue.status === 'rejected' ? 'Ingredient catalogue could not be loaded; coverage is unavailable.' : ''].filter(Boolean);
    setState((prev) => ({ records: feed ? JSON.stringify(feed.records.filter(isSourcedPrice)) === JSON.stringify(prev.records) ? prev.records : feed.records.filter(isSourcedPrice) : prev.records,
      report: feed?.report || prev.report, foods: catalogue.status === 'fulfilled' ? catalogue.value.foods : prev.foods,
      recipeIngredients: catalogue.status === 'fulfilled' ? catalogue.value.recipeIngredients : prev.recipeIngredients,
      lastCheckedAt: feed?.lastCheckedAt || prev.lastCheckedAt,
      loading: false, warning: warnings.join(' ') }));
    })().finally(() => { if (inFlightRef.current?.job === job) inFlightRef.current = null; });
    inFlightRef.current = { userId, job };
    return job;
  }, [user?.id]);
  useEffect(() => {
    refresh();
    const reload = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) refresh({ silent: true }); };
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
  return <PriceContext.Provider value={{ ...state, refresh }}>{children}</PriceContext.Provider>;
}
export const useIngredientPrices = () => useContext(PriceContext);
