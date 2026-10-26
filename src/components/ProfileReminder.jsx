import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/profile-reminder.css';

export default function ProfileReminder() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return React.createElement('aside', { className: 'profile-reminder', 'aria-label': 'Optional profile setup' },
    React.createElement('span', { className: 'profile-reminder-icon', 'aria-hidden': true },
      React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 },
        React.createElement('path', { d: 'M5 20C3 10 7 4 20 4c0 13-6 17-15 16ZM5 20l10-10' }))),
    React.createElement('div', { className: 'profile-reminder-copy' },
      React.createElement('strong', null, 'Personalize when you’re ready.'),
      React.createElement('p', null, 'Complete your profile for personalized targets and suggestions. You can still browse and plan meals yourself.')),
    React.createElement(Link, { to: '/onboarding', className: 'profile-reminder-action' }, 'Complete profile', React.createElement('span', { 'aria-hidden': true }, ' →')),
    React.createElement('button', { type: 'button', className: 'profile-reminder-later', onClick: () => setDismissed(true) }, 'Later'));
}
