import React from 'react';
import { medicalConditionCopy } from '../lib/medical-condition-copy.js';
import '../styles/medical-conditions.css';

export default function MedicalConditionLabel({ option }) {
  const { label, description } = medicalConditionCopy(option);
  return React.createElement('span', { className: 'medical-option-copy', title: option.label },
    React.createElement('span', { className: 'medical-option-label' }, label),
    description && React.createElement('span', { className: 'medical-option-help' }, description),
  );
}
