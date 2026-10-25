import { setActiveAccount } from '../lib/account-storage.js';
import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
const AuthContext = createContext(null);
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: session2 } }) => {
      setActiveAccount(session2?.user?.id);
      setSession(session2);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'TOKEN_REFRESHED') return;
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
    return data;
  }
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
