import React from 'react';
import { formatEstimatedPrice, formatSourcePrice } from '../lib/pricing';
import { IngSeasonTag, SeasonalAltBanner } from './SeasonalBadges';

export default function RecipeIngredient({ ingredient: ing, quantity }) {
  const sources = ing.priceRecords || [];
  const grams = Number(ing.grams);
  return <article className="recipe-ingredient-card" aria-label={ing.name}>
    <div className="modal-ingredient-row">
      <span className="modal-ing-dot" aria-hidden="true" />
      <span className="modal-ing-name">{ing.name}</span>
      <span className={'modal-ing-status ' + ing.status} title="Recorded ingredient status">
        {ing.status === 'avail' ? '✓' : '⚠'}
      </span>
    </div>
    <div className="recipe-ing-meta">
      <span className="modal-ing-qty">{quantity}{Number.isFinite(grams) && grams > 0 ? ` · ${grams} g` : ''}</span>
      <IngSeasonTag ingredientName={ing.name} />
    </div>
    <div className="recipe-ing-prices">
      <div className="recipe-ing-estimate">
        <span className="recipe-ing-label">Estimated ingredient cost</span>
        <strong>{formatEstimatedPrice(ing.cost)}</strong>
        {ing.evidence?.label && <span className={'recipe-ing-evidence' + (ing.evidence.needsReview ? ' needs-review' : '')}>{ing.evidence.label}</span>}
      </div>
      <div className="recipe-ing-sources">
        {sources.length ? sources.map((source, index) => <div className="recipe-ing-source" key={`${source.sourceUrl}-${index}`}>
          <span className="recipe-ing-label">Store pack / source price</span>
          <strong>{formatSourcePrice(source)}</strong>
          {source.description && <span className="recipe-ing-product">{source.description}</span>}
          <div className="recipe-ing-source-meta">
            <a href={source.sourceUrl} target="_blank" rel="noreferrer">{source.source || 'View source'} <span aria-hidden="true">↗</span></a>
            {source.observedAt && <span>Checked {source.observedAt}</span>}
          </div>
          {(source.notes || source.conversionNote || source.conversionSourceUrl) && <details className="recipe-ing-notes">
            <summary>Price notes &amp; evidence</summary>
            {source.notes && <p>{source.notes}</p>}
            {source.conversionNote && <p>{source.conversionNote}</p>}
            {source.conversionSourceUrl && <a href={source.conversionSourceUrl} target="_blank" rel="noreferrer">View quantity conversion reference ↗</a>}
          </details>}
        </div>) : <div className="recipe-ing-source"><span className="recipe-ing-label">Source price</span><span className="recipe-ing-product">Not available yet</span></div>}
      </div>
    </div>
    <SeasonalAltBanner ingredientName={ing.name} />
  </article>;
}
