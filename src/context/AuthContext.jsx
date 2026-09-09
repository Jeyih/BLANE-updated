/* ============================================================
   BLANE — Auth Context
   Replaces: js/auth.js entirely.

   Old vanilla-JS functions  →  New React equivalents
   ------------------------------------------------------------
   handleLoginSubmit()       →  useAuth().login(email, password)
   handleRegisterSubmit()    →  useAuth().register(name, email, password)
   handleLogout()            →  useAuth().logout()
   guardPage()                →  <ProtectedRoute> (see ProtectedRoute.jsx)
   guardOnboarding()          →  <ProtectedRoute> on the Onboarding route
   redirectIfLoggedIn()       →  handled inside the Landing page itself

   Wrap the whole app in <AuthProvider> once, in main.jsx.
   Any component can then call useAuth() to read the session
   or trigger login/register/logout.
   ============================================================ */
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /* Get the current session once on mount */
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    /* Keep session in sync on login/logout/token refresh, in any tab */
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Skip token refreshes — they create a new session object but the user hasn't changed.
      // Without this, switching windows triggers a re-render cascade that re-fetches all data.
      if (event === 'TOKEN_REFRESHED') return;
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  /* ---- LOGIN — mirrors old handleLoginSubmit() ---- */
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /* ---- REGISTER — mirrors old handleRegisterSubmit() ---- */
  async function register(fullName, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;

    /* Same "already registered" check the old code did */
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists.');
    }

    return data; // data.session is null if email confirmation is required
  }

  /* ---- LOGOUT — mirrors old handleLogout() ---- */
  async function logout() {
    await supabase.auth.signOut();
  }

  const value = { session, user: session?.user ?? null, loading, login, register, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
