import React from 'react';
import { useIngredientPrices } from '../context/PriceContext';
import { formatPrice } from '../lib/pricing';
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
      'Auto-checks every 15 seconds while this page is active. Retailer checks are shared for 30 seconds; the button requests a fresh check. Suppliers do not send instant change notifications.',
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
      'DA NCR averages and Philippine store listings are reference estimates. Jelexie is a Tarlac brand; other listings are not confirmed Tarlac market quotes.',
    ),
    React.createElement(
      'p',
      null,
      'Cooked foods may use labeled raw-ingredient estimates. Base-only subtotals exclude extra ingredients and are not complete meal costs.',
    ),
    React.createElement(
      'p',
      null,
      'Liquid household measures use 240 ml per cup, 15 ml per tablespoon and 5 ml per teaspoon. Approximate quantities are labeled; \u201Cscant\u201D uses the stated full measure as an upper estimate.',
    ),
    React.createElement(
      'p',
      null,
      'Rare ingredients may use comparable Philippine product benchmarks for budgeting. These are labeled estimates, not exact prices for the requested species or cut; open the ingredients to see each comparison.',
    ),
    React.createElement(
      'p',
      null,
      'Prices use Philippine DA reports and Philippine store listings in pesos only. Unsupported assumptions are excluded from affordability results. Carrot, cabbage, squash and sitaw use labeled DOST-FNRI purchase/edible portion references; other cooked-food conversions still need documented evidence.',
    ),
    warning && React.createElement('p', { className: 'price-warning' }, warning),
    stale &&
      React.createElement(
        'p',
        { className: 'price-warning' },
        'This report is over 14 days old. Check current prices before shopping.',
      ),
    report &&
      React.createElement(
        'a',
        { href: report.url, target: '_blank', rel: 'noreferrer' },
        'View official DA report',
      ),
    showCatalog && React.createElement(IngredientPriceCatalogue, null),
    showCatalog &&
      React.createElement(
        'details',
        { className: 'price-catalog' },
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
                      { href: p.sourceUrl, target: '_blank', rel: 'noreferrer' },
                      p.name,
                    ),
                    React.createElement(
                      'div',
                      { className: 'price-estimate-note' },
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
                    formatPrice(p.price),
                    ' / ',
                    p.unit,
                    p.packPrice &&
                      React.createElement(
                        'div',
                        { className: 'price-estimate-note' },
                        formatPrice(p.packPrice),
                        ' / ',
                        p.packQuantity,
                      ),
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
