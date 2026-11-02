import React from 'react';
import { recipeEvidenceCsv } from '../lib/recipe-evidence.js';
import '../styles/recipe-references.css';

export default function RecipeEvidence({ recipe }) {
  function download() {
    const url = URL.createObjectURL(new Blob([recipeEvidenceCsv(recipe)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `BLANE-${String(recipe.id || 'recipe').replace(/[^a-z0-9_-]/gi, '-')}-evidence.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <details className="recipe-references recipe-evidence">
    <summary>Recipe evidence <span>Sources and batch worksheet</span></summary>
    <div className="recipe-references-content">
      <p>Download the recorded quantities and price sources. Complete the blank fields with actual product labels, batch measurements and reviewer findings.</p>
      <button type="button" className="recipe-evidence-download" onClick={download}>Download evidence worksheet (CSV)</button>
    </div>
  </details>;
}
