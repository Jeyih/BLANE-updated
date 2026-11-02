import React from 'react';
import { PGH_RECIPE_SOURCE as source, PGH_RECIPE_REFERENCES as recipes } from '../data/pgh-recipe-references.js';
import '../styles/recipe-references.css';

export default function PublishedRecipeReferences() {
  return <details className="recipe-references">
    <summary>Low-protein recipe references <span>{recipes.length} published recipes</span></summary>
    <div className="recipe-references-content">
      <h2>Recipes from the NSRC / PGH recipe book</h2>
      <p>Published references for review. These small servings are not complete meals and are not added to automatic meal plans.</p>
      <p>Combined-condition approval is pending. The book does not provide phenylalanine, renal-mineral values or tested texture levels for these recipes. Ingredients have not been cleared against your saved profile.</p>
      <a href={source.url} target="_blank" rel="noopener noreferrer">Open the original recipe book</a>
      <p className="recipe-reference-credit">{source.publisher}</p>
      <div className="recipe-reference-grid">
        {recipes.map(recipe => <article className="recipe-reference-card" key={recipe.id} aria-label={recipe.name}>
          <div className="recipe-reference-category">{recipe.category} · Reference only</div>
          <h3>{recipe.name}</h3>
          <p><strong>Published serving:</strong> {recipe.serving}<br/><strong>Batch yield:</strong> {recipe.yield}</p>
          <dl className="recipe-reference-nutrients">
            <div><dt>Calories</dt><dd>{recipe.nutrients.kcal} kcal</dd></div>
            <div><dt>Protein</dt><dd>{recipe.nutrients.protein.toFixed(2)} g</dd></div>
            <div><dt>Carbs</dt><dd>{recipe.nutrients.carbs.toFixed(2)} g</dd></div>
            <div><dt>Fat</dt><dd>{recipe.nutrients.fat.toFixed(2)} g</dd></div>
          </dl>
          <p className="recipe-reference-note">Values reported by the book per published serving. Changing ingredients or portions requires recalculation. Price estimate not established.</p>
          <details><summary>Ingredients and preparation</summary>
            <p><strong>Ingredients for the full batch</strong></p>
            <ul>{recipe.ingredients.map(([name, quantity]) => <li key={name}>{name}: {quantity}</li>)}</ul>
            <p><strong>Steps</strong></p>
            <ol>{recipe.preparation.map((step, index) => <li key={index}>{step}</li>)}</ol>
            <p className="recipe-reference-review">{recipe.checks} Quantities are transcribed as printed, including salt; they are not individualized recommendations.</p>
          </details>
          <a href={`${source.url}#page=${recipe.pdfPage}`} target="_blank" rel="noopener noreferrer">Source: printed page {recipe.printedPage} (PDF page {recipe.pdfPage})</a>
        </article>)}
      </div>
    </div>
  </details>;
}
