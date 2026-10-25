import test from 'node:test';
import assert from 'node:assert/strict';
import { reportLinks, parseDaRows } from './da-prices.js';
import { createHandler } from '../netlify/functions/ingredient-prices.mjs';

const report = {
  label: 'DA reference',
  observedAt: '2026-10-11',
  url: 'https://www.da.gov.ph/report.pdf',
};
const daSnapshot = {
  report,
  records: [
    {
      name: 'White rice',
      key: 'white rice',
      price: 48.42,
      unit: 'kg',
      description: 'Well Milled 1-19% bran streak',
      region: 'NCR',
      kind: 'reference',
      observedAt: report.observedAt,
      source: 'DA-AMAS weekly average',
      sourceUrl: report.url,
      currency: 'PHP',
      sourceCountry: 'PH',
    },
  ],
};
const retailSnapshot = {
  records: [
    {
      name: 'Garlic bulb',
      key: 'garlic bulb',
      price: 227,
      unit: 'kg',
      kind: 'reference',
      sourceType: 'retailer',
      verified: true,
      currency: 'PHP',
      sourceCountry: 'PH',
      sourceUrl: 'https://shopmetro.ph/product/native-garlic-1kg/',
      observedAt: '2026-10-15',
    },
  ],
};
const daCatalog = [
  { name: 'White rice', pattern: '^Well Milled\\b', requiredSection: 'LOCAL COMMERCIAL RICE' },
  { name: 'Tomato', pattern: '^Tomato\\b' },
];

test('selects the newest completed report across month and year boundaries', () => {
  const link = (label) =>
    `<a href="https://www.da.gov.ph/Weekly-Average-Prices-${label}.pdf">${label}</a>`;
  const result = reportLinks(
    link('October 5-11, 2026') + link('September 28-October 4, 2026') + link('October 12-18, 2026'),
    Date.parse('2026-10-14'),
  );
  assert.equal(result[0].observedAt, '2026-10-11');
  assert.equal(result[1].observedAt, '2026-10-04');
  assert.equal(
    reportLinks(link('December 29, 2025 - January 3, 2026'), Date.parse('2026-10-14'))[0]
      .observedAt,
    '2026-01-03',
  );
});

test('database-supplied DA catalogue preserves sections, units, and source values', () => {
  const lines = [
    'IMPORTED COMMERCIAL RICE',
    'Well Milled 1-19% bran streak kg 48.42',
    'LOCAL COMMERCIAL RICE',
    'Well Milled 1-19% bran streak kg 48.42',
    'Tomato kg 80.00',
  ];
  const records = parseDaRows(lines, report, daCatalog, 2);
  assert.deepEqual(records.map((row) => row.name), ['White rice', 'Tomato']);
  assert.equal(records[0].price, 48.42);
  assert.equal(records[0].sourceUrl, report.url);
  assert.throws(() => parseDaRows(['Tomato kg -'], report, daCatalog));
  assert.throws(() => parseDaRows(['Tomato kg 80.00'], report));
});

test('changed sources use database snapshots with a visible warning', async () => {
  const loadReferenceData = async () => ({
    daSnapshot,
    retailSnapshot,
    daCatalog,
    metroSources: [],
    shopifySources: [],
    retailSpecials: {
      tocino: {},
      whole_duck: {},
      duck_breast: {},
    },
  });
  const handler = createHandler({
    loadReferenceData,
    saveDa: async () => {},
    saveRetail: async () => {},
  });
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  globalThis.fetch = async () => {
    throw new Error('Offline');
  };
  console.error = () => {};
  try {
    const result = await handler({ httpMethod: 'GET' });
    const body = JSON.parse(result.body);
    assert.equal(result.statusCode, 200);
    assert.equal(body.status, 'cached');
    assert.ok(body.warning);
    assert.deepEqual(body.records, [...daSnapshot.records, ...retailSnapshot.records]);
    assert.equal((await handler({ httpMethod: 'POST' })).statusCode, 405);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});
