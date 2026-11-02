import React, { useMemo, useState } from 'react';
import { groceryRecipeGroups } from '../lib/meal-groceries.js';

export default function GroceryItems({ items, rows, recipes, onToggle, onRemove }) {
  const [view, setView] = useState('recipes');
  const groups = useMemo(() => groceryRecipeGroups(items, recipes), [items, recipes]);
  const complete = rows.filter(row => row.checked).length;
  function renderItem(item, showRecipes = false) {
    const names = item.recipeNames?.length ? item.recipeNames : item.sourceLabels || [];
    return <div key={item.key} className={`grocery-item${item.checked ? ' checked' : ''}`}>
      <input type="checkbox" className="grocery-checkbox" checked={Boolean(item.checked)} onChange={() => onToggle(item)} aria-label={`Bought ${item.name}`} />
      <div className="grocery-item-copy">
        <span className="grocery-item-name">{item.name} <span className="grocery-inline-qty">({item.qty})</span></span>
        {showRecipes && names.length > 0 && <small className="grocery-item-recipes">For: {names.join(' · ')}</small>}
      </div>
      <button type="button" className="grocery-remove-btn" onClick={() => onRemove(item.indices)} aria-label={`Remove ${item.name}`}>×</button>
    </div>;
  }
  return <>
    <p className="grocery-summary">{groups.length} {groups.length === 1 ? 'meal' : 'meals'} · {complete} of {rows.length} ingredients checked</p>
    <div className="grocery-view-switch" aria-label="Grocery list view">
      <button type="button" aria-pressed={view === 'recipes'} onClick={() => setView('recipes')}>By recipe</button>
      <button type="button" aria-pressed={view === 'ingredients'} onClick={() => setView('ingredients')}>Shopping list</button>
    </div>
    <div className="grocery-list">
      {!items.length ? <div className="grocery-empty">Add a meal to see its recipe and ingredients here.</div>
        : view === 'recipes' ? groups.map(group => <section className="grocery-recipe-group" key={group.key}>
          <header><h3>For: {group.name}</h3><small>{group.label}</small></header>
          {group.items.map(item => renderItem(item))}
        </section>) : [...rows].sort((a, b) => Number(a.checked) - Number(b.checked) || String(a.name).localeCompare(String(b.name))).map(item => renderItem(item, true))}
    </div>
  </>;
}
