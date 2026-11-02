import React, { useMemo, useState } from 'react';
import { useIngredientPrices } from '../context/PriceContext';
import { supabase } from '../lib/supabase';
import { priceIngredient, ingredientQuote, formatSourcePrice } from '../lib/pricing';
import { validCostBasis } from '../lib/recipe-cost-basis';
import review from '../data/ingredient-costing-review.json';
import '../styles/recipe-cost-evidence.css';

// Rendered only inside the administrator route. Database RLS also enforces writes.
export default function RecipeCostEvidence() {
  const { records, recipeIngredients, referenceData, refresh } = useIngredientPrices();
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ amount: '', evidence: '', measuredAt: '', confirmed: false });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => review.map((row) => {
    const ingredients = recipeIngredients.filter((i) => i.name === row.ingredient);
    const usages = ingredients.map((i) => priceIngredient(i, records, referenceData || {}));
    const quote = ingredientQuote(row.ingredient, records, referenceData || {});
    return { ...row, usages, recipeCount: new Set(ingredients.map(i => i.recipe_id)).size,
      priority: !quote ? 0 : usages.some(u => u.cost === null) ? 1
        : usages.some(u => u.evidence.needsReview) ? 2 : 3 };
  }).sort((a, b) => Number(b.recipeCount > 0) - Number(a.recipeCount > 0)
    || a.priority - b.priority || b.recipeCount - a.recipeCount
    || a.ingredient.localeCompare(b.ingredient)), [recipeIngredients, records, referenceData]);
  const ingredient = recipeIngredients.find((i) => String(i.id) === selected);
  const quote = ingredient && ingredientQuote(ingredient.name, records, referenceData || {});
  const source = quote?.records[0];
  const blocked = !ingredient || !source || source.partial || source.estimateType === 'comparable';
  function choose(id) {
    setSelected(id); setMessage('');
    const saved = referenceData?.recipeCostBases?.[id];
    setForm({ amount: saved?.amount ?? '', evidence: saved?.evidence ?? '',
      measuredAt: saved?.measuredAt ?? '', confirmed: false });
  }
  async function save(event) {
    event.preventDefault();
    if (blocked || saving) return;
    const basis = { ...form, amount: Number(form.amount), unit: quote.unit,
      name: ingredient.name, grams: Number(ingredient.grams), quantity: ingredient.quantity || '',
      sourceUrl: source.sourceUrl };
    if (!validCostBasis(basis)) {
      setMessage('Enter a positive purchase quantity, date and evidence notes (at least 20 characters). Confirm the product and quantity first.'); return;
    }
    setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('price_reference_data').upsert({
        catalogue: 'recipe_cost_basis', entry_key: String(ingredient.id), data: basis,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'catalogue,entry_key' });
      if (error) throw error;
      await refresh({ reloadCatalogue: true, silent: true });
      setMessage('Quantity evidence saved. Sourced prices still update automatically.');
    } catch {
      setMessage('Not saved. Administrator access and the recipe-cost-evidence database migration are required. Your inputs are still here.');
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!selected || saving) return;
    setSaving(true); setMessage('');
    try {
      const { error } = await supabase.from('price_reference_data').delete()
        .eq('catalogue', 'recipe_cost_basis').eq('entry_key', selected);
      if (error) throw error;
      await refresh({ reloadCatalogue: true, silent: true });
      choose(selected); setMessage('Recorded basis removed. Default evidence checks apply again.');
    } catch { setMessage('Could not remove the basis. Check administrator access and database setup.'); }
    finally { setSaving(false); }
  }
  return <details className="cost-evidence price-catalog">
    <summary>Recipe costing evidence · 46 reviewed ingredients</summary>
    <p>Recipe ingredients come first: missing source prices, missing cost quantities, then estimates needing verification. Items used in more recipes receive priority within each group.</p>
    <p>Soy sauce, corn oil and liquid milk now support published density estimates. Other items below still need the listed evidence. FNRI edible percentages are not cooking yields.</p>
    <p>Record quantities only. Prices come from the automatic source feed. Full dishes and different-product estimates require recipe or source corrections first.</p>
    <label>Find an ingredient<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reviewed ingredients" /></label>
    <div className="price-table-wrap"><table><thead><tr><th>Ingredient</th><th>Recipes affected</th><th>Current evidence</th><th>Next step</th></tr></thead>
      <tbody>{rows.filter((r) => r.ingredient.toLowerCase().includes(query.toLowerCase())).map((row) => <tr key={row.ingredient}>
        <td>{row.ingredient}<br /><a href={row.sourceUrl} target="_blank" rel="noreferrer">FNRI food record</a></td>
        <td>{row.recipeCount}</td>
        <td>{row.usages.length ? [...new Set(row.usages.map((u) => u.evidence.label))].join('; ') : 'No loaded recipe usage'}
          <br />{row.usages.filter((u) => u.cost !== null && !u.evidence.needsReview).length} / {row.usages.length} usages supported</td>
        <td><details><summary>{row.route}</summary><p>{row.existingEvidence}</p><p>{row.action}</p></details></td>
      </tr>)}</tbody></table></div>
    <h3>Record a recipe ingredient’s purchase quantity</h3>
    <p>The quantity must correspond to this ingredient’s displayed nutrition grams for the recipe. For cooked foods, document the raw purchase and cooked output weights and how the portion was allocated. Do not enter an entire batch quantity for one portion.</p>
    <label>Recipe ingredient<select value={selected} disabled={saving} onChange={(e) => choose(e.target.value)}>
      <option value="">Choose a recipe ingredient</option>
      {recipeIngredients.map((i) => <option key={i.id} value={String(i.id)}>{i.recipe_id} · {i.name} · {i.grams} g</option>)}
    </select></label>
    {ingredient && <>
      <p>{ingredient.name}: {ingredient.grams} g nutrition basis; quantity label: {ingredient.quantity || 'Not recorded'}.</p>
      {source && <p>Source product: {source.description || source.name} · {formatSourcePrice(source)}. <a href={source.sourceUrl} target="_blank" rel="noreferrer">Check product and pack</a></p>}
      {blocked ? <p role="status">This item needs an exact source or a complete component recipe before a quantity can resolve its cost.</p> :
        <form onSubmit={save}>
          <label>Purchase quantity ({quote.unit})<input type="number" min="0.000001" step="any" required value={form.amount} disabled={saving} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <small>Use kilograms for g ÷ 1,000; litres for ml ÷ 1,000; exact counts for pieces.</small>
          <label>Measurement date<input type="date" required disabled={saving} value={form.measuredAt} onChange={(e) => setForm({ ...form, measuredAt: e.target.value })} /></label>
          <label>Evidence and calculation<textarea required minLength={20} disabled={saving} value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} placeholder="Measured purchase amount, edible/cooked output, portion calculation and evidence reference. No personal information." /></label>
          <label className="cost-evidence-confirm"><input type="checkbox" required disabled={saving} checked={form.confirmed} onChange={(e) => setForm({ ...form, confirmed: e.target.checked })} />I checked the exact product, preparation, pack basis and portion calculation.</label>
          <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save quantity evidence'}</button>
        </form>}
      {referenceData?.recipeCostBases?.[selected] && <button type="button" disabled={saving} onClick={remove}>Remove recorded basis</button>}
    </>}
    {message && <p role="status">{message}</p>}
  </details>;
}
