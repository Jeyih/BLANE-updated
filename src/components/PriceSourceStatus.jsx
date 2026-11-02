import React from 'react';
import { useIngredientPrices } from '../context/PriceContext';
import { formatSourcePrice } from '../lib/pricing';
import IngredientPriceCatalogue from './IngredientPriceCatalogue';
import '../styles/prices.css';
function PriceSourceStatus({ showCatalog = false }) {
  const { records, loading, report, warning, refresh, lastCheckedAt } = useIngredientPrices();
  const reference = records.filter((p) => p.kind === 'reference');
  const official = reference.filter((p) => p.sourceType !== 'retailer');
  const retail = reference.filter((p) => p.sourceType === 'retailer');
  const stale = report && Date.now() - new Date(report.observedAt).getTime() > 14 * 864e5;
  return React.createElement(
    'div',
    { className: 'price-source' },
    React.createElement(
      'div',
      { className: 'price-source-row' },
      React.createElement(
        'div',
        { role: 'status' },
        React.createElement('strong', null, 'Ingredient prices \xB7 Verified sources'),
        React.createElement(
          'p',
          null,
          official.length,
          ' DA reference prices \xB7 ',
          retail.length,
          ' retailer reference prices \xB7 ',
          report?.label,
        ),
      ),
      React.createElement(
        'button',
        { type: 'button', disabled: loading, onClick: () => refresh({ force: true }) },
        loading ? 'Checking prices\u2026' : 'Check prices now',
      ),
    ),
    React.createElement(
      'p',
      null,
      'Checks every 15 seconds on this page. Retailer results may be cached for 30 seconds.',
    ),
    lastCheckedAt &&
      React.createElement(
        'p',
        null,
        'Last source check: ',
        new Date(lastCheckedAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' }),
      ),
    React.createElement(
      'p',
      null,
      'Estimates use DA NCR reports and Philippine retailers. Local store prices may differ.',
    ),
    React.createElement(
      'p',
      null,
      'Raw-input estimates exclude preparation costs. Partial subtotals are not full meal prices.',
    ),
    React.createElement(
      'p',
      null,
      'Measures: 1 cup = 240 ml, 1 tbsp = 15 ml, 1 tsp = 5 ml. Approximate amounts are labelled.',
    ),
    React.createElement(
      'p',
      null,
      'Comparable products are labelled as estimates. Open an ingredient to see its source.',
    ),
    React.createElement(
      'p',
      null,
      'Prices are in pesos. FNRI portion conversions are labelled; unverified costs stay out of budget matches.',
    ),
    warning && React.createElement('p', { className: 'price-warning' }, warning),
    stale &&
      React.createElement(
        'p',
        { className: 'price-warning' },
        'Report older than 14 days. Check prices before shopping.',
      ),
    report &&
      React.createElement(
        'a',
        { href: report.url, target: '_blank', rel: 'noreferrer' },
        'View official DA report',
      ),
    showCatalog && React.createElement(IngredientPriceCatalogue, null),
    React.createElement('p', null, 'Soy sauce, corn oil and milk use published density estimates where needed. See ingredient evidence.'),
    showCatalog &&
      React.createElement(
        'details',
        { className: 'price-catalog price-reference-catalog' },
        React.createElement(
          'summary',
          null,
          'View ingredient reference prices (',
          reference.length,
          ')',
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
                React.createElement('th', null, 'Region / date'),
              ),
            ),
            React.createElement(
              'tbody',
              null,
              reference.map((p) =>
                React.createElement(
                  'tr',
                  { key: `${p.key}-${p.sourceUrl}` },
                  React.createElement(
                    'td',
                    null,
                    React.createElement(
                      'a',
                      { href: p.sourceUrl, target: '_blank', rel: 'noreferrer', title: p.name },
                      p.name,
                    ),
                    React.createElement(
                      'div',
                      { className: 'price-estimate-note price-two-line', title: [p.description, p.notes, p.availability].filter(Boolean).join(' · ') },
                      p.description,
                      React.createElement('br', null),
                      p.notes,
                      ' ',
                      p.availability,
                    ),
                  ),
                  React.createElement(
                    'td',
                    null,
                    formatSourcePrice(p),
                  ),
                  React.createElement('td', null, p.region, ' \xB7 ', p.observedAt),
                ),
              ),
            ),
          ),
        ),
      ),
  );
}
export { PriceSourceStatus as default };
