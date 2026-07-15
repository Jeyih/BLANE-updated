/* ============================================================
   BLANE — Supabase Client
   Replaces: js/supabase-config.js + the createClient() call
   that used to live at the top of js/auth.js

   Import this one instance everywhere instead of creating
   new clients:  import { supabase } from '../lib/supabase'
   ============================================================ */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* Redirect targets — same as the old REDIRECT_AFTER_* constants
   in supabase-config.js, now used by AuthContext instead. */
export const REDIRECT_AFTER_LOGIN    = '/dashboard';
export const REDIRECT_AFTER_REGISTER = '/onboarding';
export const REDIRECT_AFTER_ONBOARD  = '/dashboard';
