import { createClient } from '@supabase/supabase-js';
import { createOfflineFetch } from './offline-data.js';
import { readSavedSession } from './offline-session.js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnon) {
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key.',
  );
}
const SUPABASE_URL = supabaseUrl;
const cachedFetch = createOfflineFetch({ baseUrl: supabaseUrl });
const onlineClient = createClient(supabaseUrl, supabaseAnon, { global: { fetch: cachedFetch } });
// Offline reads must not wait for an expired session's network refresh. This
// client can only replay cached GETs; it does not grant server authentication.
const offlineClient = createClient(supabaseUrl, supabaseAnon, {
  accessToken: async () => readSavedSession(supabaseUrl)?.access_token || null,
  global: { fetch: cachedFetch },
});
const supabase = new Proxy(onlineClient, {
  get(target, property) {
    if (property === 'from') return (...args) => (navigator.onLine === false ? offlineClient : target).from(...args);
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const REDIRECT_AFTER_LOGIN = '/dashboard';
const REDIRECT_AFTER_REGISTER = '/onboarding';
const REDIRECT_AFTER_ONBOARD = '/dashboard';
export {
  REDIRECT_AFTER_LOGIN,
  REDIRECT_AFTER_ONBOARD,
  REDIRECT_AFTER_REGISTER,
  SUPABASE_URL,
  supabase,
};
