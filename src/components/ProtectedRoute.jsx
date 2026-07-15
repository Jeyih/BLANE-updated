/* ============================================================
   BLANE — Protected Route
   Replaces: guardPage() and guardOnboarding() from js/auth.js

   Old vanilla pattern (top of every protected page's JS file):
     const session = await guardPage();
     if (!session) return;

   New React pattern (in App.jsx routing):
     <Route element={<ProtectedRoute />}>
       <Route path="/dashboard" element={<Dashboard />} />
     </Route>

   Not logged in -> redirects to "/" (Landing), same as before.
   ============================================================ */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#060d0a', color: '#4d6e5a', fontFamily: 'DM Sans, sans-serif', fontSize: '14px',
      }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  return <Outlet />;
}
