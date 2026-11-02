import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { accountStorage, durableSessionStorage, subscribeAccountStorage } from '../lib/account-storage.js';
import { createMealStateSync } from '../lib/meal-state-sync.js';
import '../styles/meal-sync.css';

export default function MealStateSync({ userId, children }) {
  const [ready, setReady] = useState(!userId);
  const [state, setState] = useState({ status: 'saving', conflicts: [] });
  const [controller, setController] = useState(null);
  useEffect(() => {
    if (!userId) { setReady(true); return; }
    let active = true;
    const sync = createMealStateSync({
      account: userId, client: supabase,
      local: accountStorage(() => globalThis.localStorage, () => userId),
      session: accountStorage(() => durableSessionStorage, () => userId),
      subscribe: subscribeAccountStorage,
      onStatus: value => { if (active) setState(value); },
      onHydrate: () => {
        if (!active) return;
        window.dispatchEvent(new Event('blane-account-meals-hydrated'));
        window.dispatchEvent(new Event('blane-meal-plan-updated'));
        window.dispatchEvent(new Event('blane-portions-updated'));
      },
    });
    setController(sync);
    sync.start().finally(() => { if (active) setReady(true); });
    const retry = () => { void sync.sync(); };
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    const timer = setInterval(retry, 30000);
    return () => { active = false; sync.stop(); clearInterval(timer); window.removeEventListener('online', retry); window.removeEventListener('focus', retry); };
  }, [userId]);
  if (!ready) return React.createElement('p', { className: 'meal-sync-initial', role: 'status' }, 'Opening your saved meals…');
  const conflict = state.status === 'conflict' || state.conflicts.length > 0;
  const names = { blane_meal_plan_weeks_v1: 'weekly meal plans', blane_completed_meals_v2: 'Finished marks', blane_slot_optimizations_v1: 'portion adjustments', blane_grocery_v2: 'grocery list' };
  return React.createElement(React.Fragment, null,
    children,
    userId && (conflict || ['offline', 'pending', 'saving'].includes(state.status)) && React.createElement('aside', { className: 'meal-sync-notice', 'aria-label': 'Meal account saving' },
      React.createElement('span', { role: 'status' }, conflict ? `Different changes were saved for your ${state.conflicts.map(key => names[key] || 'meals').join(', ')}. Choose which version to keep. This replaces the conflicting saved items.` : state.status === 'offline' ? 'Account sync is unavailable. Your meals stay saved on this device.' : 'Saving meals to your account…'),
      conflict ? React.createElement(React.Fragment, null,
        React.createElement('button', { onClick: () => controller?.resolve('account') }, 'Use account version'),
        React.createElement('button', { onClick: () => controller?.resolve('device') }, 'Keep this device’s version'))
        : state.status === 'offline' && React.createElement('button', { onClick: () => controller?.sync() }, 'Retry saving')),
  );
}
