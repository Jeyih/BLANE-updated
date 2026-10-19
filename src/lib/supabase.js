import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnon) {
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key.',
  );
}
const SUPABASE_URL = supabaseUrl;
const supabase = createClient(supabaseUrl, supabaseAnon);
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
