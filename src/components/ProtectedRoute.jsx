import React from 'react';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { hasInitialProfile } from '../lib/onboarding-profile';
function ProtectedRoute() {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const [profileState, setProfileState] = useState('loading');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    let request = 0;
    async function checkProfile() {
      const current = ++request;
      setProfileState('loading');
      try {
        const { data, error } = await supabase.from('profiles')
          .select('age,sex,height_cm,weight_kg,goal').eq('id', session.user.id).maybeSingle()
          .abortSignal(AbortSignal.timeout(15000));
        if (!active || current !== request) return;
        setProfileState(error ? 'error' : hasInitialProfile(data) ? 'ready' : 'needs-setup');
      } catch { if (active && current === request) setProfileState('error'); }
    }
    checkProfile();
    window.addEventListener('blane-profile-saved', checkProfile);
    return () => { active = false; window.removeEventListener('blane-profile-saved', checkProfile); };
  }, [session?.user?.id, retry]);
  const setupOrProfile = ['/onboarding', '/profile', '/admin'].includes(pathname);
  if (loading || (session && !setupOrProfile && profileState === 'loading')) {
    return React.createElement(
      'div',
      {
        style: {
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060d0a',
          color: '#4d6e5a',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
        },
      },
      'Loading\u2026',
    );
  }
  if (!session) return React.createElement(Navigate, { to: '/', replace: true });
  if (!setupOrProfile && profileState === 'error') {
    return React.createElement('main', { style: { padding: '64px 24px', color: '#e8f5ee' } },
      React.createElement('h1', null, 'Could not load your saved profile'),
      React.createElement('p', { role: 'alert' }, 'Check your connection and try again. Your saved details have not been changed.'),
      React.createElement('button', { type: 'button', onClick: () => setRetry(value => value + 1) }, 'Try again'));
  }
  if (!setupOrProfile && profileState === 'needs-setup') return React.createElement(Navigate, { to: '/onboarding', replace: true });
  return React.createElement(Outlet, null);
}
export { ProtectedRoute as default };
