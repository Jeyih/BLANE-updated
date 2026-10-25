import React from 'react';
import { useMemo, useState } from 'react';
import { useIngredientPrices } from '../context/PriceContext';
import { formatPrice, priceCoverage, ingredientPriceAudit } from '../lib/pricing';
const PAGE_SIZE = 50;
function IngredientPriceCatalogue() {
  const { records, foods, recipeIngredients, referenceData, loading } = useIngredientPrices();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('recipes');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const coverage = useMemo(
    () => priceCoverage(foods, recipeIngredients, records, referenceData || {}),
    [foods, recipeIngredients, records, referenceData],
  );
  const rows = useMemo(
    () =>
      coverage.catalogue.filter(
        (food) =>
          (scope !== 'recipes' || food.inRecipes) &&
          (status === 'all' ||
            (status === 'assumptions'
              ? Boolean(food.quote) && food.evidence.needsReview
              : status === 'priced'
                ? Boolean(food.quote)
                : !food.quote)) &&
          `${food.food_name} ${food.fct_id}`.toLowerCase().includes(query.toLowerCase().trim()),
      ),
    [coverage, scope, status, query],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  function exportMissing() {
    const missing = coverage.catalogue.filter((food) => !food.quote);
    const csv = [
      [
        'Food ID',
        'Ingredient',
        'Used in recipes',
        'Price PHP',
        'Quantity basis',
        'Source URL',
        'Observed date',
      ],
      ...missing.map((food) => [
        food.fct_id,
        food.food_name,
        food.inRecipes ? 'Yes' : 'No',
        '',
        '',
        '',
        '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BLANE-missing-ingredient-prices.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportAudit() {
    const selected = coverage.catalogue.filter((food) => scope !== 'recipes' || food.inRecipes);
    const header = [
      'Ingredient',
      'Source price PHP',
      'Source unit',
      'Evidence status',
      'Actual listed product',
      'Source URL',
      'Observed date',
      'Assumptions',
      'Conversion database URLs',
      'Required verification',
    ];
    const csv = [
      header,
      ...selected.map((food) => {
        const audit = ingredientPriceAudit(
          food.food_name,
          recipeIngredients,
          records,
          referenceData || {},
        );
        const source = audit.quote?.records[0];
        return [
          food.food_name,
          audit.quote?.price ?? '',
          audit.quote?.unit || '',
          audit.evidence.label,
          source?.description || source?.name || '',
          source?.sourceUrl || '',
          source?.observedAt || '',
          [...audit.assumptions, ...audit.conversionNotes].join(' | '),
          audit.conversionSources.join(' | '),
          audit.verificationTasks.join(' | '),
        ];
      }),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BLANE-price-evidence-audit.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return React.createElement(
    'details',
    { className: 'price-catalog' },
    React.createElement('summary', null, 'All ingredient prices and coverage'),
    !foods.length
      ? React.createElement(
          'p',
          null,
          loading
            ? 'Loading ingredient catalogue\u2026'
            : 'Catalogue unavailable. Sign in and refresh prices.',
        )
      : React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'p',
            null,
            React.createElement(
              'strong',
              null,
              coverage.recipePriced,
              ' / ',
              coverage.recipeUnique,
            ),
            ' recipe ingredients have price estimates \xB7',
            React.createElement(
              'strong',
              null,
              ' ',
              coverage.recipeEntriesPriced,
              ' / ',
              coverage.recipeEntries,
            ),
            ' recipe quantities can be costed.',
          ),
          React.createElement(
            'p',
            null,
            'Full food catalogue: ',
            coverage.priced,
            ' / ',
            coverage.total,
            ' with matching prices; ',
            coverage.total - coverage.priced,
            ' still need a sourced quote.',
          ),
          React.createElement(
            'p',
            null,
            'A verified source price does not prove the recipe calculation is exact. Raw/cooked yields, different products and incomplete prepared foods need verification. Use the assumption filter or export the full evidence audit.',
          ),
          React.createElement(
            'div',
            { className: 'price-catalog-controls' },
            React.createElement('input', {
              'aria-label': 'Search ingredient prices',
              placeholder: 'Search ingredient or food ID',
              value: query,
              onChange: (e) => {
                setQuery(e.target.value);
                setPage(0);
              },
            }),
            React.createElement(
              'select',
              {
                'aria-label': 'Ingredient catalogue scope',
                value: scope,
                onChange: (e) => {
                  setScope(e.target.value);
                  setPage(0);
                },
              },
              React.createElement('option', { value: 'recipes' }, 'Used in recipes'),
              React.createElement('option', { value: 'all' }, 'All food records'),
            ),
            React.createElement(
              'select',
              {
                'aria-label': 'Ingredient price status',
                value: status,
                onChange: (e) => {
                  setStatus(e.target.value);
                  setPage(0);
                },
              },
              React.createElement('option', { value: 'all' }, 'All price statuses'),
              React.createElement('option', { value: 'priced' }, 'Has price'),
              React.createElement('option', { value: 'missing' }, 'Missing price'),
              React.createElement(
                'option',
                { value: 'assumptions' },
                'Has assumptions / needs review',
              ),
            ),
            React.createElement(
              'button',
              { type: 'button', onClick: exportMissing },
              'Export missing-price list',
            ),
            React.createElement(
              'button',
              { type: 'button', onClick: exportAudit },
              'Export price evidence audit',
            ),
          ),
          React.createElement(
            'div',
            { className: 'price-table-wrap' },
            React.createElement(
              'table',
              null,
              React.createElement(
                'thead',
                null,
                React.createElement(
                  'tr',
                  null,
                  React.createElement('th', null, 'Ingredient'),
                  React.createElement('th', null, 'Price / unit'),
                  React.createElement('th', null, 'Evidence'),
                  React.createElement('th', null, 'Source'),
                  React.createElement('th', null, 'Observation date'),
                ),
              ),
              React.createElement(
                'tbody',
                null,
                visible.map((food) =>
                  React.createElement(
                    'tr',
                    { key: food.fct_id },
                    React.createElement(
                      'td',
                      null,
                      food.food_name,
                      React.createElement(
                        'div',
                        { className: 'price-estimate-note' },
                        'Food ID ',
                        food.fct_id,
                      ),
                    ),
                    React.createElement(
                      'td',
                      null,
                      food.quote
                        ? React.createElement(
                            React.Fragment,
                            null,
                            formatPrice(food.quote.price),
                            ' / ',
                            food.quote.unit,
                            React.createElement(
                              'div',
                              { className: 'price-estimate-note' },
                              food.quote.records[0].partial
                                ? 'Base ingredient only'
                                : food.quote.records[0].estimateType === 'comparable'
                                  ? 'Comparable-product estimate'
                                  : food.quote.records[0].estimateType === 'raw'
                                    ? 'Raw-ingredient estimate'
                                    : 'Product reference',
                              React.createElement('br', null),
                              food.quote.records[0].notes,
                              React.createElement('br', null),
                              food.quote.records[0].packPrice &&
                                `${formatPrice(food.quote.records[0].packPrice)} / ${food.quote.records[0].packQuantity}`,
                              ' ',
                              food.quote.records[0].availability,
                            ),
                          )
                        : 'Price unavailable',
                    ),
                    React.createElement(
                      'td',
                      null,
                      food.evidence.label,
                      React.createElement(
                        'div',
                        { className: 'price-estimate-note' },
                        food.evidence.reason,
                        food.conversionNotes?.map((note) =>
                          React.createElement('p', { key: note }, note),
                        ),
                        food.conversionSources?.map((url) =>
                          React.createElement(
                            'div',
                            { key: url },
                            React.createElement(
                              'a',
                              { href: url, target: '_blank', rel: 'noreferrer' },
                              'DOST-FNRI portion reference',
                            ),
                          ),
                        ),
                      ),
                      food.verificationTasks?.length > 0 &&
                        React.createElement(
                          'details',
                          null,
                          React.createElement('summary', null, 'How to verify'),
                          React.createElement(
                            'ul',
                            null,
                            food.verificationTasks.map((task) =>
                              React.createElement('li', { key: task }, task),
                            ),
                          ),
                        ),
                    ),
                    React.createElement(
                      'td',
                      null,
                      food.quote
                        ? food.quote.records[0].kind === 'local'
                          ? `Local recorded quotes (${food.quote.records.length})`
                          : React.createElement(
                              'a',
                              {
                                href: food.quote.records[0].sourceUrl,
                                target: '_blank',
                                rel: 'noreferrer',
                              },
                              food.quote.records[0].source,
                            )
                        : 'Needs a matching market or retailer quote',
                    ),
                    React.createElement(
                      'td',
                      null,
                      food.quote
                        ? [
                            ...new Set(
                              food.quote.records.map((p) => p.observedAt || 'Date not provided'),
                            ),
                          ].join(', ')
                        : '\u2014',
                    ),
                  ),
                ),
              ),
            ),
            !rows.length && React.createElement('p', null, 'No ingredients match these filters.'),
          ),
          React.createElement(
            'div',
            { className: 'price-pagination' },
            React.createElement(
              'button',
              {
                type: 'button',
                disabled: currentPage === 0,
                onClick: () => setPage(currentPage - 1),
              },
              'Previous',
            ),
            React.createElement(
              'span',
              null,
              rows.length ? currentPage * PAGE_SIZE + 1 : 0,
              '\u2013',
              Math.min((currentPage + 1) * PAGE_SIZE, rows.length),
              ' of ',
              rows.length,
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                disabled: (currentPage + 1) * PAGE_SIZE >= rows.length,
                onClick: () => setPage(currentPage + 1),
              },
              'Next',
            ),
          ),
          React.createElement(
            'p',
            null,
            'Retail product prices are reference estimates, not confirmed prices at every listed market. Old market entries without a verified source are excluded from pricing.',
          ),
          React.createElement(
            'p',
            null,
            'A sourced unit price may still need a recipe volume or piece count before its cost can be calculated. Missing prices require a matching retailer listing with a verifiable pack size.',
          ),
        ),
  );
}
export { IngredientPriceCatalogue as default };
