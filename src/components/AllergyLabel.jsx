import React from 'react';
import { allergyCopy } from '../lib/allergy-copy.js';
import '../styles/medical-conditions.css';

// Use the same two-line option layout as the health-condition choices.
export default function AllergyLabel({ option }) {
  const { label, description } = allergyCopy(option);
  return React.createElement('span', { className: 'medical-option-copy', title: option.label },
    React.createElement('span', { className: 'medical-option-label' }, label),
    description && React.createElement('span', { className: 'medical-option-help' }, description),
  );
}
