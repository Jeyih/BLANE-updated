/* ============================================================
   BLANE — App Root
   Route map (old .html file  →  new React route)
   ------------------------------------------------------------
   index.html         -> "/"            (public, built this step)
   onboarding.html     -> "/onboarding"   (protected, placeholder)
   dashboard.html      -> "/dashboard"    (protected, placeholder)
   mealplan.html        -> "/mealplan"     (protected, placeholder)
   recipes.html         -> "/recipes"      (protected, placeholder)
   markets.html          -> "/markets"      (protected, placeholder)
   profile.html          -> "/profile"      (protected, placeholder)
   admin.html             -> "/admin"        (admin-only, placeholder)

   Placeholder pages will be filled in one-by-one in the
   following migration steps, same order as the original build.
   ============================================================ */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MealPlan from './pages/MealPlan';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />

          {/* Protected — placeholders for now, built next in order */}
          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/mealplan"   element={<MealPlan />} />
            <Route path="/recipes"    element={<ComingSoon title="Recipes" />} />
            <Route path="/markets"    element={<ComingSoon title="Markets" />} />
            <Route path="/profile"    element={<ComingSoon title="Profile" />} />
            <Route path="/admin"      element={<ComingSoon title="Admin Panel" />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}