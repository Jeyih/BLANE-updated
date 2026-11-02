import React, { useId } from 'react';
import { MAX_HEALTH_GOALS, healthGoalDescription, selectedHealthGoals, toggleHealthGoal, primaryHealthGoal } from '../lib/health-goals.js';
import '../styles/health-goals.css';

export default function HealthGoalPicker({ options, value, onChange, readOnly = false, disabled = false }) {
  const id = useId();
  const selected = selectedHealthGoals(value);
  const choices = readOnly ? options.filter(option => selected.includes(option.key)) : options;
  const label = key => options.find(option => option.key === key)?.label || key;
  return React.createElement('div', { className: 'health-goals' },
    !readOnly && React.createElement('p', { className: 'health-goals-help', id: `${id}-help` },
      `Choose 1–${MAX_HEALTH_GOALS} goals. Your primary goal sets calorie targets; all selected goals help rank dashboard meals.`),
    !readOnly && React.createElement('p', { className: 'health-goals-count', role: 'status' },
      `${selected.length} of ${MAX_HEALTH_GOALS} selected`,
      selected.length === MAX_HEALTH_GOALS ? ' · Deselect one to choose another.' : ''),
    React.createElement('div', { className: 'health-goals-grid', role: 'group', 'aria-label': 'Health goals', 'aria-describedby': readOnly ? undefined : `${id}-help` },
      choices.map(option => {
        const checked = selected.includes(option.key);
        return React.createElement(readOnly ? 'div' : 'button', {
          key: option.key,
          className: `health-goal${checked ? ' selected' : ''}`,
          ...(readOnly ? {} : {
            type: 'button', 'aria-pressed': checked,
            disabled: disabled || (!checked && selected.length >= MAX_HEALTH_GOALS),
            onClick: () => onChange(toggleHealthGoal(value, option.key)),
          }),
        },
        React.createElement('span', { className: 'health-goal-icon', 'aria-hidden': true }, option.icon || '🎯'),
        React.createElement('span', { className: 'health-goal-label' }, option.label),
        healthGoalDescription(option) && React.createElement('span', { className: 'health-goal-desc' }, healthGoalDescription(option)),
        value.goal === option.key && React.createElement('span', { className: 'health-goal-primary' }, 'Primary'));
      })),
    !readOnly && selected.length > 0 && React.createElement('div', { className: 'health-goal-primary-field' },
      React.createElement('label', { htmlFor: `${id}-primary` }, 'Primary goal'),
      React.createElement('select', {
        id: `${id}-primary`, value: value.goal, disabled,
        onChange: event => onChange(primaryHealthGoal(value, event.target.value)),
      }, selected.map(key => React.createElement('option', { key, value: key }, label(key))))),
    readOnly && !selected.length && React.createElement('span', null, 'None selected'),
  );
}
