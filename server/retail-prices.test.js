import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRetailPrice,
  productRecords,
  parseWholeDuckPrice,
  parseDuckBreastPrice,
} from './retail-prices.js';
const html = (product) =>
  `<script type="application/ld+json">${JSON.stringify({ '@graph': [product] })}<\/script>`;
test('exact Philippine duck-breast quote requires matching product, seller, currency and kg basis', () => {
  const product = {
    '@type': 'Product',
    name: 'Duck Breast (Dalee)',
    offers: {
      price: 900,
      priceCurrency: 'PHP',
      seller: { name: 'The Sausage Guy Panglao' },
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        price: 900,
        priceCurrency: 'PHP',
        referenceQuantity: { value: 1, unitCode: 'KGM' },
      },
    },
  };
  const record = parseDuckBreastPrice(html(product));
  assert.equal(record.price, 900);
  assert.equal(record.estimateType, 'product');
  assert.equal(record.availability, 'Listed in stock');
  for (const mutate of [
    (p) => {
      p.name = 'Whole Duck';
    },
    (p) => {
      p.offers.priceCurrency = 'USD';
    },
    (p) => {
      p.offers.priceSpecification.referenceQuantity.unitCode = 'C62';
    },
    (p) => {
      p.offers.priceSpecification.referenceQuantity.value = 2;
    },
    (p) => {
      p.offers.seller.name = 'Different seller';
    },
    (p) => {
      p.offers.price = 950;
    },
  ]) {
    const changed = structuredClone(product);
    mutate(changed);
    assert.throws(() => parseDuckBreastPrice(html(changed)));
  }
});
test('whole-duck benchmark uses the displayed PHP/kg rate, not the bag total', () => {
  const page =
    '<h1>Whole Duck Headless</h1><div class=product-price><span class=priceUnit>2.4 kg per bag<br> \u20B1 598 /kg</span><span itemprop=price content=1435>1435</span><meta itemprop=priceCurrency content=PHP>';
  assert.equal(parseWholeDuckPrice(page).price, 598);
  assert.throws(() => parseWholeDuckPrice(page.replace('PHP', 'USD')));
  assert.throws(() => parseWholeDuckPrice(page.replace('/kg', '/pc')));
  assert.throws(() => parseWholeDuckPrice(page.replace('598', '0')));
});
test('retail pack price converts to PHP/kg and keeps traceable source information', () => {
  const row = parseRetailPrice(
    html({
      '@type': 'Product',
      name: 'Beef Tocino 500g',
      offers: [
        {
          '@type': 'Offer',
          priceSpecification: [
            { '@type': 'UnitPriceSpecification', priceCurrency: 'PHP', price: '402.50' },
          ],
        },
      ],
    }),
  );
  assert.equal(row.price, 805);
  assert.equal(row.packPrice, 402.5);
  assert.equal(row.sourceType, 'retailer');
  assert.equal(row.kind, 'reference');
  assert.ok(row.sourceUrl.startsWith('https://montereycommunityonlinemarket.com.ph/'));
});
test('reviewed retailer product identity and pack basis are enforced', () => {
  const config = {
    names: ['Carrot, boiled'],
    title: 'Carrot 500g',
    basis: '500 g',
    raw: true,
    partial: true,
  };
  const [record] = productRecords(
    config,
    'Carrot 500g',
    40,
    'Official retailer',
    'https://shopmetro.ph/carrot',
  );
  assert.equal(record.price, 80);
  assert.equal(record.estimateType, 'raw');
  assert.equal(record.partial, true);
  assert.equal(record.verified, true);
  assert.throws(() =>
    productRecords(config, 'Carrot 250g', 40, 'Official retailer', 'https://shopmetro.ph/carrot'),
  );
  assert.throws(() =>
    productRecords(config, 'Carrot 500g', NaN, 'Official retailer', 'https://shopmetro.ph/carrot'),
  );
});
test('fresh commodity quotes verify the labelled kg basis as well as product identity', () => {
  const config = {
    names: ['Garlic bulb'],
    title: 'Q Garlic Native',
    basis: '1 kg',
    requireNetWeight: true,
  };
  const description = '<td>Net Weight:</td><td>1KG</td>';
  assert.equal(
    productRecords(
      config,
      config.title,
      227,
      'Metro',
      'https://shopmetro.ph/product/native-garlic-1kg/',
      description,
    )[0].price,
    227,
  );
  assert.throws(() =>
    productRecords(
      config,
      config.title,
      227,
      'Metro',
      'https://shopmetro.ph/product/native-garlic-1kg/',
      description.replace('1KG', '500g'),
    ),
  );
  assert.throws(() =>
    productRecords(
      config,
      config.title,
      227,
      'Metro',
      'https://shopmetro.ph/product/native-garlic-1kg/',
    ),
  );
});
test('does not import an unrelated product, pack size, currency, or invalid price', () => {
  for (const [name, currency, price] of [
    ['Pork Tocino 500g', 'PHP', 100],
    ['Beef Tocino 250g', 'PHP', 100],
    ['Beef Tocino 500g', 'USD', 10],
    ['Beef Tocino 500g', 'PHP', 0],
  ]) {
    assert.throws(() =>
      parseRetailPrice(
        html({ '@type': 'Product', name, offers: { priceCurrency: currency, price } }),
      ),
    );
  }
});
