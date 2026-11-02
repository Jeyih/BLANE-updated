import React, { useEffect, useId, useState } from 'react';
import { addProfileEntry, customProfileEntries, replaceProfileEntry, removeProfileEntry } from '../lib/profile-entries.js';
import '../styles/profile-entries.css';
import { resolveConstraintKey } from '../lib/constraint-rules.js';
import { allergyCopy } from '../lib/allergy-copy.js';
import { medicalConditionCopy } from '../lib/medical-condition-copy.js';

export default function CustomProfileEntries({ values, options, editing, onChange, onEditingChange, disabled = false, label, allowAdd = false, addButtonLabel = label === 'food allergy' ? 'Add allergy' : 'Add entry' }) {
  const addInputId = useId();
  const [editingValue, setEditingValue] = useState(null);
  const [draft, setDraft] = useState('');
  const [newDraft, setNewDraft] = useState('');
  const [error, setError] = useState('');
  const entries = customProfileEntries(values, options);
  const definitions = Object.fromEntries(options.map(option => [option.key, option]));
  const optionLabel = option => label === 'food allergy' ? allergyCopy(option).label : label === 'health condition' ? medicalConditionCopy(option).label : option.label || option.key;
  const entryStillVisible = editingValue === null || entries.includes(editingValue);
  const hasPendingEdit = editing && ((editingValue !== null && entryStillVisible) || (allowAdd && Boolean(newDraft.trim())));
  useEffect(() => { onEditingChange?.(hasPendingEdit); }, [hasPendingEdit, onEditingChange]);
  useEffect(() => {
    if (!editing || !entryStillVisible) { setEditingValue(null); setError(''); }
  }, [editing, entryStillVisible]);
  useEffect(() => { if (!editing) setNewDraft(''); }, [editing]);
  if (!entries.length && !(editing && allowAdd)) return null;
  function apply(value) {
    try {
      onChange(replaceProfileEntry(values, value, resolveConstraintKey(draft, definitions) || draft));
      setEditingValue(null);
      setError('');
    } catch (issue) { setError(issue.message); }
  }
  function add() {
    try {
      onChange(addProfileEntry(values, resolveConstraintKey(newDraft, definitions) || newDraft));
      setNewDraft('');
      setError('');
    } catch (issue) { setError(issue.message); }
  }
  return React.createElement('div', { className: 'pf-custom-entries', 'aria-label': `Custom ${label} entries` },
    entries.length > 0 && React.createElement('p', { className: 'pf-custom-note' },
      'Unrecognized entries stay recorded, but automatic meal selection is blocked until their dietary rules can be checked. Use a supported option only when it accurately describes your entry.'),
    entries.map(value => React.createElement('div', { className: 'pf-custom-entry', key: value },
      editing && editingValue === value
        ? React.createElement(React.Fragment, null,
            React.createElement('input', {
              className: 'pf-custom-input', value: draft, disabled, autoFocus: true,
              'aria-label': `Edit ${label}: ${value}`,
              onChange: event => { setDraft(event.target.value); setError(''); },
              onKeyDown: event => {
                if (event.key === 'Enter') { event.preventDefault(); apply(value); }
                if (event.key === 'Escape') { event.preventDefault(); setEditingValue(null); setError(''); }
              },
            }),
            React.createElement('button', { type: 'button', disabled, onClick: () => apply(value) }, 'Apply'),
            React.createElement('button', { type: 'button', disabled, onClick: () => { setEditingValue(null); setError(''); } }, 'Cancel edit'))
        : React.createElement(React.Fragment, null,
            React.createElement('span', { className: 'pf-custom-value' }, value),
            React.createElement('span', { className: 'pf-custom-badge' }, resolveConstraintKey(value, definitions) ? 'Recognized rule' : 'Needs review'),
            editing && !resolveConstraintKey(value, definitions) && React.createElement('select', {
              className: 'pf-custom-input', value: '', disabled,
              'aria-label': `Replace ${value} with a supported ${label}`,
              onChange: event => { if (event.target.value) onChange(replaceProfileEntry(values, value, event.target.value)); },
            }, React.createElement('option', { value: '' }, 'Replace with a matching supported option…'),
              options.map(option => React.createElement('option', { key: option.key, value: option.key }, optionLabel(option)))),
            editing && React.createElement('button', {
              type: 'button', disabled, 'aria-label': `Edit ${label}: ${value}`,
              onClick: () => { setEditingValue(value); setDraft(value); setError(''); },
            }, 'Edit')),
      editing && React.createElement('button', {
        type: 'button', disabled, 'aria-label': `Remove ${label}: ${value}`,
        onClick: () => { onChange(removeProfileEntry(values, value)); setEditingValue(null); setError(''); },
      }, 'Remove'),
    )),
    editing && allowAdd && React.createElement('div', { className: 'pf-custom-add' },
      React.createElement('label', { htmlFor: addInputId, className: 'pf-custom-note' }, `Other ${label} (optional)`),
      React.createElement('div', { className: 'pf-custom-entry' },
        React.createElement('input', {
          id: addInputId, className: 'pf-custom-input', value: newDraft, disabled,
          placeholder: `Enter another ${label}`,
          onChange: event => { setNewDraft(event.target.value); setError(''); },
          onKeyDown: event => { if (event.key === 'Enter') { event.preventDefault(); add(); } },
        }),
        React.createElement('button', { type: 'button', disabled: disabled || !newDraft.trim(), onClick: add }, addButtonLabel),
        newDraft && React.createElement('button', { type: 'button', disabled, onClick: () => { setNewDraft(''); setError(''); } }, 'Clear'),
      ),
    ),
    editing && error && React.createElement('p', { className: 'pf-custom-error', role: 'alert' }, error),
    editing && React.createElement('p', { className: 'pf-custom-note' },
      editingValue !== null ? 'Apply or cancel this edit before selecting Save Changes.'
        : newDraft.trim() ? `Select ${addButtonLabel} or Clear before saving your profile.`
        : 'Keep genuine allergies and conditions recorded. Select Save Changes to save your edits.'),
  );
}
