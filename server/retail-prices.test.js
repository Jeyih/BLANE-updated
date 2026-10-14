import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRetailPrice, productRecords, parseWholeDuckPrice } from './retail-prices.js';

const html = (product) => `<script type="application/ld+json">${JSON.stringify({ '@graph': [product] })}</script>`;
test('whole-duck benchmark uses the displayed PHP/kg rate, not the bag total', () => {
  const page = '<h1>Whole Duck Headless</h1><div class=product-price><span class=priceUnit>2.4 kg per bag<br> ₱ 598 /kg</span><span itemprop=price content=1435>1435</span><meta itemprop=priceCurrency content=PHP>';
  assert.equal(parseWholeDuckPrice(page).price, 598);
  assert.throws(() => parseWholeDuckPrice(page.replace('PHP', 'USD')));
  assert.throws(() => parseWholeDuckPrice(page.replace('/kg', '/pc')));
  assert.throws(() => parseWholeDuckPrice(page.replace('598', '0')));
});
test('retail pack price converts to PHP/kg and keeps traceable source information', () => {
  const row = parseRetailPrice(html({ '@type': 'Product', name: 'Beef Tocino 500g', offers: [{
    '@type': 'Offer', priceSpecification: [{ '@type': 'UnitPriceSpecification', priceCurrency: 'PHP', price: '402.50' }],
  }] }));
  assert.equal(row.price, 805);
  assert.equal(row.packPrice, 402.5);
  assert.equal(row.sourceType, 'retailer');
  assert.equal(row.kind, 'reference');
  assert.ok(row.sourceUrl.startsWith('https://montereycommunityonlinemarket.com.ph/'));
});

test('reviewed retailer product identity and pack basis are enforced', () => {
  const config = { names: ['Carrot, boiled'], title: 'Carrot 500g', basis: '500 g', raw: true, partial: true };
  const [record] = productRecords(config, 'Carrot 500g', 40, 'Official retailer', 'https://shopmetro.ph/carrot');
  assert.equal(record.price, 80);
  assert.equal(record.estimateType, 'raw');
  assert.equal(record.partial, true);
  assert.equal(record.verified, true);
  assert.throws(() => productRecords(config, 'Carrot 250g', 40, 'Official retailer', 'https://shopmetro.ph/carrot'));
  assert.throws(() => productRecords(config, 'Carrot 500g', NaN, 'Official retailer', 'https://shopmetro.ph/carrot'));
});
test('does not import an unrelated product, pack size, currency, or invalid price', () => {
  for (const [name, currency, price] of [['Pork Tocino 500g', 'PHP', 100], ['Beef Tocino 250g', 'PHP', 100],
    ['Beef Tocino 500g', 'USD', 10], ['Beef Tocino 500g', 'PHP', 0]]) {
    assert.throws(() => parseRetailPrice(html({ '@type': 'Product', name, offers: { priceCurrency: currency, price } })));
  }
});
