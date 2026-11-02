import { setActiveAccount } from '../lib/account-storage.js';
import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { clearOfflineAccount } from '../lib/offline-data.js';
import { readSavedSession } from '../lib/offline-session.js';
const savedOfflineSession = () => readSavedSession(import.meta.env.VITE_SUPABASE_URL);
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (navigator.onLine === false) {
      const saved = savedOfflineSession();
      setActiveAccount(saved?.user?.id);
      setSession(saved);
      setLoading(false);
    }
    supabase.auth.getSession().then(({ data: { session: session2 } }) => {
      const available = session2 || (navigator.onLine === false ? savedOfflineSession() : null);
      setActiveAccount(available?.user?.id);
      setSession(available);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED') return;
      if (event === 'INITIAL_SESSION' && !newSession && navigator.onLine === false) return;
      setActiveAccount(newSession?.user?.id);
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  async function register(fullName, email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists.');
    }
    return data;
  }
  async function resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
    return data;
  }
  async function updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    if (!data?.user?.id || data.user.id !== session?.user?.id) {
      throw new Error('The password update could not be confirmed for this account. Request a new reset link.');
    }
    return data;
  }
  async function logout() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    clearOfflineAccount(session?.user?.id);
    setActiveAccount(null);
  }
  const value = {
    session,
    user: session?.user ?? null,
    loading,
    login,
    register,
    resetPassword,
    updatePassword,
    logout,
  };
  return React.createElement(AuthContext.Provider, { value }, React.createElement(React.Fragment, { key: session?.user?.id || 'guest' }, children));
}
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
export { AuthProvider, useAuth };
