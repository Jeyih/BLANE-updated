import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { isAdmin } from '../lib/admin-auth';
import FeedbackDialog from './FeedbackDialog';
import '../styles/nav.css';
const NAV_LINKS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: React.createElement('rect', { x: '3', y: '3', width: '7', height: '7' }),
  },
  { to: '/mealplan', label: 'Meal Plan' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/markets', label: 'Markets' },
  { to: '/profile', label: 'Profile' },
];
const NAV_ICONS = {
  '/dashboard': React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    React.createElement('rect', { x: '3', y: '3', width: '7', height: '7' }),
    React.createElement('rect', { x: '14', y: '3', width: '7', height: '7' }),
    React.createElement('rect', { x: '3', y: '14', width: '7', height: '7' }),
    React.createElement('rect', { x: '14', y: '14', width: '7', height: '7' }),
  ),
  '/mealplan': React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    React.createElement('path', { d: 'M3 6h18M3 12h18M3 18h18' }),
  ),
  '/recipes': React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
    React.createElement('path', { d: 'M12 8v4l3 3' }),
  ),
  '/markets': React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    React.createElement('path', { d: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z' }),
    React.createElement('circle', { cx: '12', cy: '10', r: '3' }),
  ),
  '/profile': React.createElement(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    },
    React.createElement('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
    React.createElement('circle', { cx: '12', cy: '7', r: '4' }),
  ),
};
function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('...');
  const [fullName, setFullName] = useState('...');
  const [initial, setInitial] = useState('?');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const dropdownRef = useRef(null);
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
      const first = rawName.split(' ')[0];
      setFullName(rawName);
      setFirstName(first);
      setInitial(first.charAt(0).toUpperCase());
    }
    loadName();
    return () => {
      cancelled = true;
    };
  }, [user]);
  useEffect(() => {
    let cancelled = false;
    setUserIsAdmin(false);
    if (!user)
      return () => {
        cancelled = true;
      };
    isAdmin(user)
      .then((allowed) => {
        if (!cancelled) setUserIsAdmin(allowed);
      })
      .catch((error) => {
        console.error('Unable to verify administrator access:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);
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
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'nav',
      { className: 'dash-navbar' },
      React.createElement(
        Link,
        { to: '/dashboard', className: 'dash-navbar-logo' },
        React.createElement(
          'div',
          { className: 'dash-navbar-logo-icon' },
          React.createElement(
            'svg',
            { viewBox: '0 0 24 24', xmlns: 'http://www.w3.org/2000/svg' },
            React.createElement('path', {
              d: 'M12 2C7.4 2 4 5.4 4 9c0 2.4 1.2 4.5 3 5.7V18c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2v-3.3c1.8-1.2 3-3.3 3-5.7 0-3.6-3.4-7-8-7zm0 2c3.3 0 6 2.7 6 5 0 2-1.2 3.7-3 4.6V18H9v-4.4C7.2 12.7 6 11 6 9c0-2.3 2.7-5 6-5z',
            }),
          ),
        ),
        React.createElement(
          'span',
          { className: 'dash-navbar-logo-text' },
          React.createElement('span', null, 'BL'),
          'ANE',
        ),
      ),
      React.createElement(
        'nav',
        { className: 'dash-nav-links' },
        NAV_LINKS.map((link) =>
          React.createElement(
            Link,
            {
              key: link.to,
              to: link.to,
              className: 'dash-nav-link' + (location.pathname === link.to ? ' active' : ''),
            },
            NAV_ICONS[link.to],
            link.label,
          ),
        ),
      ),
      React.createElement('div', { className: 'dash-navbar-spacer' }),
      React.createElement(
        'div',
        { className: 'dash-navbar-right' },
        React.createElement(
          'span',
          { className: 'dash-greeting' },
          'Hello, ',
          React.createElement('strong', null, firstName),
        ),
        React.createElement(
          'button',
          {
            className: 'dash-feedback-trigger',
            type: 'button',
            onClick: () => setFeedbackOpen(true),
          },
          React.createElement(
            'svg',
            {
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: '2',
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            React.createElement('path', {
              d: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z',
            }),
          ),
          'Feedback',
        ),
        React.createElement(
          'div',
          { style: { position: 'relative' }, ref: dropdownRef },
          React.createElement(
            'button',
            {
              className: 'dash-avatar-btn',
              onClick: (e) => {
                e.stopPropagation();
                setDropdownOpen((v) => !v);
              },
            },
            React.createElement('span', null, initial),
          ),
          React.createElement(
            'div',
            { className: 'dash-dropdown' + (dropdownOpen ? ' open' : '') },
            React.createElement(
              'div',
              { className: 'dash-dropdown-header' },
              React.createElement('div', { className: 'dash-dropdown-name' }, fullName),
              React.createElement('div', { className: 'dash-dropdown-email' }, user?.email),
            ),
            React.createElement(
              Link,
              {
                to: '/profile',
                className: 'dash-dropdown-item',
                onClick: () => setDropdownOpen(false),
              },
              React.createElement(
                'svg',
                { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                React.createElement('path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }),
                React.createElement('circle', { cx: '12', cy: '7', r: '4' }),
              ),
              'My Profile',
            ),
            React.createElement(
              Link,
              {
                to: '/onboarding',
                className: 'dash-dropdown-item',
                onClick: () => setDropdownOpen(false),
              },
              React.createElement(
                'svg',
                { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                React.createElement('circle', { cx: '12', cy: '12', r: '3' }),
                React.createElement('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' }),
                React.createElement('path', { d: 'M4.93 4.93a10 10 0 0 0 0 14.14' }),
              ),
              'Edit Health Profile',
            ),
            userIsAdmin &&
              React.createElement(
                React.Fragment,
                null,
                React.createElement('div', { className: 'dash-dropdown-divider' }),
                React.createElement(
                  Link,
                  {
                    to: '/admin',
                    className: 'dash-dropdown-item',
                    style: { color: '#a78bfa' },
                    onClick: () => setDropdownOpen(false),
                  },
                  React.createElement(
                    'svg',
                    {
                      viewBox: '0 0 24 24',
                      fill: 'none',
                      stroke: 'currentColor',
                      strokeWidth: '2',
                      width: '14',
                      height: '14',
                    },
                    React.createElement('path', {
                      d: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z',
                    }),
                  ),
                  'Admin Panel',
                ),
              ),
            React.createElement('div', { className: 'dash-dropdown-divider' }),
            React.createElement(
              'button',
              { className: 'dash-dropdown-item danger', onClick: handleLogout },
              React.createElement(
                'svg',
                { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                React.createElement('path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }),
                React.createElement('polyline', { points: '16 17 21 12 16 7' }),
                React.createElement('line', { x1: '21', y1: '12', x2: '9', y2: '12' }),
              ),
              'Sign out',
            ),
          ),
        ),
        React.createElement(
          'button',
          {
            className: 'dash-hamburger' + (mobileOpen ? ' active' : ''),
            'aria-label': 'Toggle menu',
            onClick: () => setMobileOpen((v) => !v),
          },
          React.createElement('span', null),
          React.createElement('span', null),
          React.createElement('span', null),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'dash-mobile-nav' + (mobileOpen ? ' open' : '') },
      NAV_LINKS.map((link) =>
        React.createElement(
          Link,
          {
            key: link.to,
            to: link.to,
            className: 'dash-nav-link' + (location.pathname === link.to ? ' active' : ''),
            onClick: () => setMobileOpen(false),
          },
          link.label,
        ),
      ),
      React.createElement(
        'button',
        {
          className: 'dash-nav-link dash-mobile-feedback',
          type: 'button',
          onClick: () => {
            setMobileOpen(false);
            setFeedbackOpen(true);
          },
        },
        'Feedback',
      ),
      React.createElement(
        'button',
        {
          className: 'dash-nav-link',
          style: {
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#f87171',
          },
          onClick: handleLogout,
        },
        'Sign out',
      ),
    ),
    React.createElement(FeedbackDialog, {
      open: feedbackOpen,
      onClose: () => setFeedbackOpen(false),
    }),
  );
}
export { Navbar as default };
