import React from 'react';
import { clinicalReviewRequirements } from '../lib/constraint-rules.js';

export default function ClinicalReviewNotice({ active = [] }) {
  const requirements = clinicalReviewRequirements(active);
  if (!requirements.length) return null;
  return React.createElement('aside', { className: 'clinical-review-notice', 'aria-label': 'Special diet review' },
    React.createElement('strong', null, 'Special diet review needed'),
    React.createElement('p', null, 'Some research recipes are excluded because the required assessment is missing. A higher budget or an AI suggestion cannot replace this review.'),
    React.createElement('ul', null, requirements.map(item => React.createElement('li', { key: item.key },
      React.createElement('strong', null, `${item.label}: `), item.reason))),
    React.createElement('p', null, 'Other displayed meals pass the stored ingredient rules only; this does not confirm suitability for your prescribed diet. Keep your diagnosed conditions recorded.'));
}
