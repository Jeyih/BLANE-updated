import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/profile-required.css';

function SetupIcon({ kind, className = '' }) {
  const paths = {
    person: ['M20 21v-2a7 7 0 0 0-14 0v2', 'M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
    measure: ['M4 7h16v10H4z', 'M8 7v4m4-4v6m4-6v4'],
    goal: ['M20 12a8 8 0 1 1-8-8', 'M16 12a4 4 0 1 1-4-4', 'M12 12l8-8', 'M16 4h4v4'],
    arrow: ['M5 12h14', 'm13 6 6 6-6 6'],
    leaf: ['M5 20C3 10 7 4 20 4c0 13-6 17-15 16Z', 'M5 20 15 10'],
  };
  return React.createElement('svg', { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    paths[kind].map((d, i) => React.createElement('path', { d, key: i })));
}

export default function ProfileRequired({ loading, error, onRetry }) {
  const setup = !loading && !error;
  return React.createElement('main', { className: 'profile-setup-page' },
    React.createElement('section', { className: 'profile-setup-card' + (!setup ? ' profile-setup-compact' : ''), 'aria-labelledby': 'profile-required-title', 'aria-busy': Boolean(loading) },
      React.createElement('div', { className: 'profile-setup-copy' },
        React.createElement('span', { className: 'profile-setup-eyebrow' },
          React.createElement(SetupIcon, { kind: 'leaf' }), 'YOUR BLANE EXPERIENCE'),
        React.createElement('h1', { id: 'profile-required-title' }, loading ? 'Getting things ready…' : error ? 'Let’s try that again.' : 'Your goals. Your meal plan.'),
        React.createElement('p', { className: 'profile-setup-description', role: error ? 'alert' : 'status' }, loading
          ? 'We’re checking your saved profile.'
          : error ? 'We couldn’t load your profile. Check your connection and try again. Your saved details are unchanged.'
            : 'Complete your health profile so your calorie estimates and meal suggestions reflect you.'),
        setup && React.createElement('p', { className: 'profile-setup-note' }, 'A few details now. More useful planning ahead.'),
        !loading && React.createElement('div', { className: 'profile-setup-actions' },
          error
            ? React.createElement('button', { type: 'button', className: 'profile-setup-primary', onClick: onRetry }, 'Try again', React.createElement(SetupIcon, { kind: 'arrow' }))
            : React.createElement(Link, { to: '/onboarding', className: 'profile-setup-primary' }, 'Complete my profile', React.createElement(SetupIcon, { kind: 'arrow' })),
          React.createElement(Link, { to: '/recipes', className: 'profile-setup-secondary' }, 'Browse recipes'),
        ),
        setup && React.createElement('p', { className: 'profile-setup-footnote' }, 'You can update your details anytime in Profile.'),
      ),
      setup && React.createElement('aside', { className: 'profile-setup-details', 'aria-label': 'Details needed for your profile' },
        React.createElement('div', { className: 'profile-setup-illustration', 'aria-hidden': true },
          React.createElement('div', { className: 'profile-setup-icon-orbit' }, React.createElement(SetupIcon, { kind: 'leaf' }))),
        React.createElement('h2', null, 'Let’s start with you'),
        React.createElement('p', { className: 'profile-setup-details-intro' }, 'Here’s what we’ll use to tailor your estimates.'),
        React.createElement('ul', { className: 'profile-setup-checklist' },
          [['person', 'About you', 'Age and biological sex'], ['measure', 'Your measurements', 'Height and weight'], ['goal', 'Your routine & goal', 'Activity level and health goal']].map(([kind, title, text]) =>
            React.createElement('li', { key: kind },
              React.createElement('span', { className: 'profile-setup-item-icon' }, React.createElement(SetupIcon, { kind })),
              React.createElement('div', null, React.createElement('strong', null, title), React.createElement('span', null, text)),
            )),
        ),
      ),
    ));
}
