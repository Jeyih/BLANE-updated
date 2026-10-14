import { useMemo, useState } from 'react';
import { useIngredientPrices } from '../context/PriceContext';
import { formatPrice, priceCoverage, ingredientPriceAudit } from '../lib/pricing';

const PAGE_SIZE = 50;
export default function IngredientPriceCatalogue() {
  const { records, foods, recipeIngredients, loading } = useIngredientPrices();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('recipes');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const coverage = useMemo(() => priceCoverage(foods, recipeIngredients, records), [foods, recipeIngredients, records]);
  const rows = useMemo(() => coverage.catalogue.filter((food) =>
    (scope !== 'recipes' || food.inRecipes) &&
    (status === 'all' || (status === 'assumptions' ? Boolean(food.quote) && food.evidence.needsReview : status === 'priced' ? Boolean(food.quote) : !food.quote)) &&
    `${food.food_name} ${food.fct_id}`.toLowerCase().includes(query.toLowerCase().trim())
  ), [coverage, scope, status, query]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function exportMissing() {
    const missing = coverage.catalogue.filter((food) => !food.quote);
    const csv = [['Food ID', 'Ingredient', 'Used in recipes', 'Price PHP', 'Quantity basis', 'Source URL', 'Observed date'],
      ...missing.map((food) => [food.fct_id, food.food_name, food.inRecipes ? 'Yes' : 'No', '', '', '', ''])]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'BLANE-missing-ingredient-prices.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  function exportAudit() {
    const selected = coverage.catalogue.filter((food) => scope !== 'recipes' || food.inRecipes);
    const header = ['Ingredient', 'Source price PHP', 'Source unit', 'Evidence status', 'Actual listed product', 'Source URL', 'Observed date', 'Assumptions', 'Conversion database URLs', 'Required verification'];
    const csv = [header, ...selected.map((food) => {
      const audit = ingredientPriceAudit(food.food_name, recipeIngredients, records);
      const source = audit.quote?.records[0];
      return [food.food_name, audit.quote?.price ?? '', audit.quote?.unit || '', audit.evidence.label,
        source?.description || source?.name || '', source?.sourceUrl || '', source?.observedAt || '',
        [...audit.assumptions, ...audit.conversionNotes].join(' | '), audit.conversionSources.join(' | '), audit.verificationTasks.join(' | ')];
    })].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'BLANE-price-evidence-audit.csv'; link.click(); URL.revokeObjectURL(url);
  }

  return <details className="price-catalog">
    <summary>All ingredient prices and coverage</summary>
    {!foods.length ? <p>{loading ? 'Loading ingredient catalogue…' : 'Catalogue unavailable. Sign in and refresh prices.'}</p> : <>
      <p><strong>{coverage.recipePriced} / {coverage.recipeUnique}</strong> recipe ingredients have price estimates ·
        <strong> {coverage.recipeEntriesPriced} / {coverage.recipeEntries}</strong> recipe quantities can be costed.</p>
      <p>Full food catalogue: {coverage.priced} / {coverage.total} with matching prices; {coverage.total - coverage.priced} still need a sourced quote.</p>
      <p>A verified source price does not prove the recipe calculation is exact. Raw/cooked yields, different products and incomplete prepared foods need verification. Use the assumption filter or export the full evidence audit.</p>
      <div className="price-catalog-controls">
        <input aria-label="Search ingredient prices" placeholder="Search ingredient or food ID" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
        <select aria-label="Ingredient catalogue scope" value={scope} onChange={(e) => { setScope(e.target.value); setPage(0); }}>
          <option value="recipes">Used in recipes</option><option value="all">All food records</option>
        </select>
        <select aria-label="Ingredient price status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="all">All price statuses</option><option value="priced">Has price</option><option value="missing">Missing price</option>
          <option value="assumptions">Has assumptions / needs review</option>
        </select>
        <button type="button" onClick={exportMissing}>Export missing-price list</button>
        <button type="button" onClick={exportAudit}>Export price evidence audit</button>
      </div>
      <div className="price-table-wrap"><table><thead><tr><th>Ingredient</th><th>Price / unit</th><th>Evidence</th><th>Source</th><th>Observation date</th></tr></thead>
        <tbody>{visible.map((food) => <tr key={food.fct_id}>
          <td>{food.food_name}<div className="price-estimate-note">Food ID {food.fct_id}</div></td>
          <td>{food.quote ? <>{formatPrice(food.quote.price)} / {food.quote.unit}<div className="price-estimate-note">{food.quote.records[0].partial ? 'Base ingredient only' : food.quote.records[0].estimateType === 'comparable' ? 'Comparable-product estimate' : food.quote.records[0].estimateType === 'raw' ? 'Raw-ingredient estimate' : 'Product reference'}<br />{food.quote.records[0].notes}<br />{food.quote.records[0].packPrice && `${formatPrice(food.quote.records[0].packPrice)} / ${food.quote.records[0].packQuantity}`} {food.quote.records[0].availability}</div></> : 'Price unavailable'}</td>
          <td>{food.evidence.label}<div className="price-estimate-note">{food.evidence.reason}{food.conversionNotes?.map((note) => <p key={note}>{note}</p>)}{food.conversionSources?.map((url) => <div key={url}><a href={url} target="_blank" rel="noreferrer">DOST-FNRI portion reference</a></div>)}</div>{food.verificationTasks?.length > 0 && <details><summary>How to verify</summary><ul>{food.verificationTasks.map((task) => <li key={task}>{task}</li>)}</ul></details>}</td>
          <td>{food.quote ? food.quote.records[0].kind === 'local' ? `Tarlac recorded quotes (${food.quote.records.length})`
            : <a href={food.quote.records[0].sourceUrl} target="_blank" rel="noreferrer">{food.quote.records[0].source}</a> : 'Needs a matching market or retailer quote'}</td>
          <td>{food.quote ? [...new Set(food.quote.records.map((p) => p.observedAt || 'Date not provided'))].join(', ') : '—'}</td>
        </tr>)}</tbody>
      </table>{!rows.length && <p>No ingredients match these filters.</p>}</div>
      <div className="price-pagination">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>{rows.length ? currentPage * PAGE_SIZE + 1 : 0}–{Math.min((currentPage + 1) * PAGE_SIZE, rows.length)} of {rows.length}</span>
        <button type="button" disabled={(currentPage + 1) * PAGE_SIZE >= rows.length} onClick={() => setPage(currentPage + 1)}>Next</button>
      </div>
      <p>Retail product prices are reference estimates, not confirmed prices at every Tarlac market. Old market entries without a verified source are excluded from pricing.</p>
      <p>A sourced unit price may still need a recipe volume or piece count before its cost can be calculated. Missing prices require a matching retailer listing with a verifiable pack size.</p>
    </>}
  </details>;
}
