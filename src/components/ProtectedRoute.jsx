import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading) {
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
  return React.createElement(Outlet, null);
}
export { ProtectedRoute as default };
