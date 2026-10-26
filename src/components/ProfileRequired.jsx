import React from 'react';
import { Link } from 'react-router-dom';

export default function ProfileRequired({ loading, error, onRetry }) {
  return React.createElement('main', { className: 'dash-main' },
    React.createElement('section', { className: 'dash-content', 'aria-labelledby': 'profile-required-title' },
      React.createElement('h1', { id: 'profile-required-title' }, loading ? 'Loading your profile…' : error ? 'Could not load your profile' : 'Complete your health profile'),
      React.createElement('p', { role: error ? 'alert' : 'status' }, loading
        ? 'Checking your saved details.'
        : error ? 'Check your connection, then try again. Your saved information has not been changed.'
          : 'Add your age, biological sex, height, weight, activity level and goal before using personalized targets and meal planning.'),
      !loading && (error
        ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: onRetry }, 'Try again')
        : React.createElement(Link, { to: '/onboarding', className: 'btn btn-primary' }, 'Complete profile')),
      !loading && React.createElement('p', null, React.createElement(Link, { to: '/recipes' }, 'Browse recipes')),
    ));
}
