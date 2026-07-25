/* ============================================================
   BLANE — Shared Navbar
   Replaces: js/nav.js + the <nav class="dash-navbar"> markup
   that was copy-pasted at the top of every protected page
   (dashboard.html, mealplan.html, recipes.html, markets.html,
   profile.html).

   Old vanilla pattern: each .html file had its own hardcoded
   copy of the navbar with a manually-set "active" class on the
   current page's link.

   New React pattern: ONE <Navbar /> component, rendered once
   per protected page. `useLocation()` automatically figures out
   which link should be active — no more manually editing 5
   copies of the same markup.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isAdmin } from '../lib/adminAuth';
import '../styles/nav.css';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: <rect x="3" y="3" width="7" height="7"/> },
  { to: '/mealplan',  label: 'Meal Plan' },
  { to: '/recipes',   label: 'Recipes' },
  { to: '/markets',   label: 'Markets' },
  { to: '/profile',   label: 'Profile' },
];

const NAV_ICONS = {
  '/dashboard': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  '/mealplan': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>,
  '/recipes': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
  '/markets': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  '/profile': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [firstName, setFirstName]   = useState('...');
  const [fullName, setFullName]     = useState('...');
  const [initial, setInitial]       = useState('?');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen]     = useState(false);

  const dropdownRef = useRef(null);

  /* Load display name from profiles table (replaces the fetch
     block at the top of the old nav.js DOMContentLoaded) */
  useEffect(() => {
    let cancelled = false;
    async function loadName() {
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;
      const rawName = profile?.full_name || user.email.split('@')[0];
      const first   = rawName.split(' ')[0];
      setFullName(rawName);
      setFirstName(first);
      setInitial(first.charAt(0).toUpperCase());
    }
    loadName();
    return () => { cancelled = true; };
  }, [user]);

  /* Close dropdown on outside click (replaces the document click
     listener in old nav.js) */
  useEffect(() => {
    function onDocClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  const userIsAdmin = isAdmin(user);

  return (
    <>
      <nav className="dash-navbar">
        <Link to="/dashboard" className="dash-navbar-logo">
          <div className="dash-navbar-logo-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z"/>
            </svg>
          </div>
          <span className="dash-navbar-logo-text"><span>BL</span>ANE</span>
        </Link>

        <nav className="dash-nav-links">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={'dash-nav-link' + (location.pathname === link.to ? ' active' : '')}
            >
              {NAV_ICONS[link.to]}
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="dash-navbar-spacer"></div>

        <div className="dash-navbar-right">
          <span className="dash-greeting">Hello, <strong>{firstName}</strong></span>

          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              className="dash-avatar-btn"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
            >
              <span>{initial}</span>
            </button>

            <div className={'dash-dropdown' + (dropdownOpen ? ' open' : '')}>
              <div className="dash-dropdown-header">
                <div className="dash-dropdown-name">{fullName}</div>
                <div className="dash-dropdown-email">{user?.email}</div>
              </div>
              <Link to="/profile" className="dash-dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                My Profile
              </Link>
              <Link to="/onboarding" className="dash-dropdown-item" onClick={() => setDropdownOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                Edit Health Profile
              </Link>

              {userIsAdmin && (
                <>
                  <div className="dash-dropdown-divider"></div>
                  <Link to="/admin" className="dash-dropdown-item" style={{ color: '#a78bfa' }} onClick={() => setDropdownOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/></svg>
                    Admin Panel
                  </Link>
                </>
              )}

              <div className="dash-dropdown-divider"></div>
              <button className="dash-dropdown-item danger" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Sign out
              </button>
            </div>
          </div>

          <button
            className={'dash-hamburger' + (mobileOpen ? ' active' : '')}
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      <div className={'dash-mobile-nav' + (mobileOpen ? ' open' : '')}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={'dash-nav-link' + (location.pathname === link.to ? ' active' : '')}
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </Link>
        ))}
        <button
          className="dash-nav-link"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#f87171' }}
          onClick={handleLogout}
        >
          Sign out
        </button>
      </div>
    </>
  );
}