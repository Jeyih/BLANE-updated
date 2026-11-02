import React from 'react';
import { cookingGuide } from '../lib/cooking-guide.js';

export default function RecipeCookingGuide({ steps, formatTimer }) {
  const guide = cookingGuide(steps);
  const instructions = guide.cooking.flatMap(step => step.lines.map((line, index) => ({
    line, timer: index === step.lines.length - 1 ? step.timer : null, title: step.title,
  })));
  return <section className="recipe-cooking-guide" aria-label="Cooking instructions">
    <p className="modal-section-note">Use the ingredient amounts above. Follow these steps in order.</p>
    {guide.cooking.length ? <ol className="modal-steps cooking-step-list">
      {instructions.map((step, index) => <li className="modal-step" key={index}>
        <span className="modal-step-num" aria-hidden="true">{index + 1}</span>
        <div className="modal-step-content">
          <p className="modal-step-desc cooking-instruction">{step.line}</p>
          {step.timer && <div className="modal-step-timer">Time for {step.title.toLowerCase()}: {formatTimer(step.timer)}</div>}
        </div>
      </li>)}
    </ol> : <p className="modal-section-note">Cooking steps have not been recorded for this recipe.</p>}
    <section className="cooking-word-help" aria-label="Cooking words explained">
      <h3 className="modal-step-title">Cooking words explained</h3>
      <ol className="cooking-explanation-list">
        <li><strong>Simmer:</strong> Cook gently with small bubbles.</li>
        <li><strong>Saute:</strong> Cook in a pan with the oil listed in the recipe. Stir as it cooks.</li>
        <li><strong>Drain:</strong> Pour off the extra liquid.</li>
        <li><strong>Trim:</strong> Remove the parts the recipe does not use.</li>
      </ol>
    </section>
    {guide.notes.length > 0 && <section className="cooking-word-help" aria-label="Recipe notes and review information">
      <h3 className="modal-step-title">Recipe notes and review information</h3>
      <ol className="cooking-explanation-list">{guide.notes.map((note, index) => <li key={index}><strong>{note.title}: </strong>{note.desc}</li>)}</ol>
    </section>}
  </section>;
}
