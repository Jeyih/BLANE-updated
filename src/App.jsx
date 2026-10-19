import React from 'react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PriceProvider } from './context/PriceContext';
import ProtectedRoute from './components/ProtectedRoute';
import { loadConstraintDefinitions } from './lib/constraints';
import { loadIngredientSeasons } from './lib/seasonal';
import Landing from './pages/Landing';
import ResetPassword from './pages/ResetPassword';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import MealPlan from './pages/MealPlan';
import Recipes from './pages/Recipes';
import Markets from './pages/Markets';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import ComingSoon from './pages/ComingSoon';
function App() {
  const [dataLoaded, setDataLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    async function initDatabaseLookups() {
      await Promise.all([loadConstraintDefinitions(), loadIngredientSeasons()]);
      if (active) setDataLoaded(true);
    }
    initDatabaseLookups();
    return () => {
      active = false;
    };
  }, []);
  return React.createElement(
    AuthProvider,
    null,
    React.createElement(
      PriceProvider,
      null,
      React.createElement(
        BrowserRouter,
        null,
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/', element: React.createElement(Landing, null) }),
          React.createElement(Route, {
            path: '/reset-password',
            element: React.createElement(ResetPassword, null),
          }),
          React.createElement(
            Route,
            { element: React.createElement(ProtectedRoute, null) },
            React.createElement(Route, {
              path: '/onboarding',
              element: React.createElement(Onboarding, null),
            }),
            React.createElement(Route, {
              path: '/dashboard',
              element: React.createElement(Dashboard, null),
            }),
            React.createElement(Route, {
              path: '/mealplan',
              element: React.createElement(MealPlan, null),
            }),
            React.createElement(Route, {
              path: '/recipes',
              element: React.createElement(Recipes, null),
            }),
            React.createElement(Route, {
              path: '/markets',
              element: React.createElement(Markets, null),
            }),
            React.createElement(Route, {
              path: '/profile',
              element: React.createElement(Profile, null),
            }),
            React.createElement(Route, {
              path: '/admin',
              element: React.createElement(Admin, null),
            }),
          ),
        ),
      ),
    ),
  );
}
export { App as default };
