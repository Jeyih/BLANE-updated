import React from 'react';
import { CB_CONSTRAINTS } from '../lib/constraints';
import '../styles/constraints.css';
import { mealReviewBadge } from '../lib/meal-review';
function ConstraintActiveBar({ activeConstraints }) {
  if (activeConstraints.length === 0) {
    return React.createElement(
      'div',
      { className: 'cb-active-bar' },
      React.createElement(
        'span',
        { className: 'cb-active-bar-label' },
        '\u{1F6E1}\uFE0F Constraints:',
      ),
      React.createElement(
        'span',
        { className: 'cb-no-constraints' },
        'No dietary constraints set \u2014 ',
        React.createElement(
          'a',
          { href: '/profile', style: { color: '#2ddc7a' } },
          'add them in your profile',
        ),
      ),
    );
  }
  return React.createElement(
    'div',
    { className: 'cb-active-bar' },
    React.createElement(
      'span',
      { className: 'cb-active-bar-label' },
      '\u{1F6E1}\uFE0F Active constraints: ',
      React.createElement('span', null, activeConstraints.length),
    ),
    React.createElement(
      'div',
      { className: 'cb-active-chips' },
      activeConstraints.map((key) => {
        const c = CB_CONSTRAINTS[key] || { severity: 'dietary', icon: '\u26A0', label: key.replace('unmatched:', 'Unverified: ') };
        return React.createElement(
          'span',
          { key, className: 'cb-active-chip ' + c.severity },
          c.icon,
          ' ',
          c.label,
        );
      }),
    ),
  );
}
function ViolationBadge({ violations, aiVerdict }) {
  if (violations.length === 0) {
    const badge = mealReviewBadge(violations, aiVerdict);
    return React.createElement(
      'span',
      { className: 'cb-violation-badge ' + badge.className, title: 'Stored rule checks are limited. Review ingredients, portions and any AI cautions; this is not medical clearance.', role: 'status' },
      badge.text,
    );
  }
  const order = { allergy: 0, medical: 1, dietary: 2 };
  const sorted = [...violations].sort((a, b) => order[a.severity] - order[b.severity]);
  const top = sorted[0];
  const moreCount = violations.length - 1;
  return React.createElement(
    'span',
    { className: 'cb-violation-badge ' + top.severity },
    top.icon,
    ' ',
    top.constraintLabel,
    moreCount > 0 ? ' +' + moreCount : '',
  );
}
function ViolationDetail({ violations }) {
  if (violations.length === 0) return null;
  const allergies = violations.filter((v) => v.severity === 'allergy');
  const medicals = violations.filter((v) => v.severity === 'medical');
  const dietaries = violations.filter((v) => v.severity === 'dietary');
  return React.createElement(
    'div',
    { className: 'cb-modal-section' },
    React.createElement(
      'div',
      {
        style: {
          fontFamily: "'Syne',sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: '#e8f5ee',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        },
      },
      '\u{1F6E1}\uFE0F Constraint Warnings',
      React.createElement(
        'span',
        {
          style: {
            fontSize: 11,
            background: 'rgba(248,113,113,0.1)',
            color: '#f87171',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 100,
            padding: '2px 8px',
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 600,
          },
        },
        violations.length,
        ' flag',
        violations.length > 1 ? 's' : '',
      ),
    ),
    React.createElement(ViolationGroup, {
      items: allergies,
      sev: 'allergy',
      header: 'Allergy Alert \u2014 these ingredients conflict with your allergy profile.',
    }),
    React.createElement(ViolationGroup, {
      items: medicals,
      sev: 'medical',
      header: 'Medical Advisory \u2014 review with your healthcare provider.',
    }),
    React.createElement(ViolationGroup, {
      items: dietaries,
      sev: 'dietary',
      header: 'Dietary Preference \u2014 this recipe contains restricted items.',
    }),
  );
}
function ViolationGroup({ items, sev, header }) {
  if (items.length === 0) return null;
  const icon =
    sev === 'allergy' ? '\u{1F6A8}' : sev === 'medical' ? '\u2695\uFE0F' : '\u26A0\uFE0F';
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      { className: 'cb-modal-header ' + sev },
      React.createElement('span', { className: 'cb-modal-header-icon' }, icon),
      React.createElement(
        'div',
        { className: 'cb-modal-header-text' },
        React.createElement('strong', null, header),
      ),
    ),
    React.createElement(
      'div',
      { className: 'cb-violation-list', style: { marginBottom: 10 } },
      items.map((v, i) =>
        React.createElement(
          'div',
          { key: i, className: 'cb-violation-row' },
          React.createElement('span', { style: { fontSize: 14 } }, v.icon),
          React.createElement('div', { className: 'cb-violation-row-ing' }, v.ingredient),
          React.createElement('div', { className: 'cb-violation-row-reason' }, v.reason),
          React.createElement(
            'span',
            { className: 'cb-violation-severity ' + sev },
            sev.charAt(0).toUpperCase() + sev.slice(1),
          ),
        ),
      ),
    ),
  );
}
export { ConstraintActiveBar, ViolationBadge, ViolationDetail };
