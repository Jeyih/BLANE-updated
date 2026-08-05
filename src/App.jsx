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
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { loadConstraintDefinitions } from './lib/constraints';
import { loadIngredientSeasons } from './lib/seasonal';

import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MealPlan from './pages/MealPlan';
import Recipes from './pages/Recipes';
import Markets from './pages/Markets';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function initDatabaseLookups() {
      await Promise.all([loadConstraintDefinitions(), loadIngredientSeasons()]);
      if (active) setDataLoaded(true);
    }

    initDatabaseLookups();
    return () => { active = false; };
  }, []);

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
            <Route path="/recipes"    element={<Recipes />} />
            <Route path="/markets"    element={<Markets />} />
            <Route path="/profile"    element={<Profile />} />
            <Route path="/admin"      element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}