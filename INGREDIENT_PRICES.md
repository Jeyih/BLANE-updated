# Philippine ingredient pricing

Only Philippine Department of Agriculture reports and Philippine store listings in PHP supply prices. Source URLs are restricted to reviewed Philippine providers; records declared as foreign-country or non-PHP prices are rejected. Imported goods sold by a Philippine store still use that store's Philippine selling price, not an overseas price.

The 36 DA NCR weekly entries are retained without changing their prices. Retail references come from Metro, Farm2Metro, Jelexie, Monterey and GERALD.ph. Each quote records its actual product, source URL, observed date, unit and pack basis where available. Source records now carry `sourceCountry: PH` and `currency: PHP`.

## Assumptions and accuracy

The [full evidence audit](PRICE_EVIDENCE_AUDIT.md) and [CSV](PRICE_EVIDENCE_AUDIT.csv) include all 74 distinct names across recipes and market inventory. Source prices and recipe calculations are assessed separately. A genuine source-product price does not establish an exact price for a different cut/species or cooked food.

Foreign cooking-yield data has been removed. Rice and oats remain clearly labeled raw-product benchmarks using the approved equal-weight assumption. This is not a verified cooked-food cost. Documented Philippine preparation yields or actual recipe measurements are needed to replace these assumptions.

Other disclosed assumptions include raw-to-cooked weight, shell/drained edible weight, varieties, household measures and base-only prepared food costs. Liquid household measures use the stated budgeting convention of 240 ml/cup, 15 ml/tablespoon and 5 ml/teaspoon; scant amounts use the full measure as an upper estimate. These are calculator assumptions, not measured recipe quantities. Nutrition grams never become invented liquid densities or whole-piece counts.

Rare foods use explicitly labeled Philippine comparable-product benchmarks:

| Recipe food | Price benchmark |
| --- | --- |
| Suckling-pig leg | DA regular pork shoulder |
| Duck liver | Metro ordinary chicken liver |
| Lima-bean pods | DA Baguio beans |
| Quail meat | DA whole chicken |
| Duck breast | GERALD.ph whole duck |

These comparisons preserve the recipe's food identity and nutrition. Exact affordable quotations for the requested rare foods remain unverified. Assumption-based costs are excluded from affordability and cheapest-day results; their labeled estimates remain visible for review. Prepared-food base-only amounts remain partial subtotals.

## Website and refresh

Markets → All ingredient prices and coverage includes the evidence column, Has assumptions / needs review filter, source links and audit CSV export. The 1,507-food nutrition catalogue includes unused foods without prices; it is not the recipe ingredient count. Old unsourced market prices and saved recipe totals are excluded. Market stock remains administrator data; reference prices are not confirmed quotes from each listed market.

All 54 current recipes retain an estimate or labeled subtotal. All 73 recipe ingredient names and all 195 ingredient quantities can be costed under the disclosed assumptions. A market typo, Malunngay, resolves to fresh malunggay leaves from Metro; it never matches dried leaf powder.

Vite and Netlify expose `/.netlify/functions/ingredient-prices`. The frontend checks every 15 seconds while visible and on focus/reconnection. Retailer checks use a shared 30-second cache. DA reports retain a separate six-hour cache. Check prices now requests a fresh source check, subject to a 10-second cooldown. There is no browser/CDN response cache. Failed updates retain original observation dates with a warning. There is no daily cron job.

Update snapshots with `npm run prices:update` and `npm run prices:update-retail`. Regenerate the audit with `node scripts/export-price-evidence.mjs`. Deploy frontend and Netlify function together for hosted dynamic updates. Other static hosts use bundled fallbacks. No database schema migration or private retailer credentials are required.

The reviewed source manifest is `server/retail-source-config.js`; food comparisons are in `src/lib/price-mappings.js`. Checks: `node --test src/lib/pricing.test.js server/da-prices.test.js server/retail-prices.test.js` and `npm run build`.


## Fast automatic price updates

Displayed recipe estimates recalculate immediately when the provider receives updated source records. Retailer changes are normally detected within about 30–45 seconds plus fetch time while a page is active. Genuine instantaneous external updates require supplier push notifications/webhooks, which these integrations do not provide; this is polling, not a live supplier subscription.

Concurrent checks share one in-flight source request. Background checks are silent, skip hidden/offline pages, resume on focus/connectivity, and reuse the ingredient catalogue rather than downloading it every 15 seconds. Failed frontend/source requests preserve the latest successful quote and original observation dates. DA and retailer caches are independent. Manual checks use a 10-second minimum interval to avoid repeated supplier requests. Old unsourced administrator price entries remain excluded from verified recipe pricing.

Automatic fetches happen only when the website is accessed; there is no always-running scheduler. Deploy the changed frontend and Netlify function together for hosted updates. The localhost Vite endpoint supports the same refresh query. All 27 tests and the build passed, including cache timing, concurrent refreshes, forced checks and retention of the latest successful quote after a failure.
# Exact product quote follow-up

Duck breast now uses The Sausage Guy Panglao's matching Duck Breast (Dalee) listing, observed at PHP 900/kg. The parser verifies product identity, the Philippine seller, PHP currency, and a one-kilogram reference quantity before accepting a refresh. This is a Bohol retailer quote, not a confirmed Tarlac price. The current retailer feed contains 57 records, including matching native garlic and red onion listings; the 36 DA records remain unchanged.

Exact ingredient listings take precedence over different-product benchmarks. If a store page changes or is unavailable, the last successful quote keeps its original observation date. Meal costs remain estimates based on the ingredient amount used, not checkout totals for full packs, transport or preparation costs.

Admin → Markets & Prices → Ingredient catalogue includes How to verify instructions for each unresolved ingredient. The evidence CSV exports these tasks: obtain an exact species/cut quote, measure recipe quantities, document raw/cooked yield, include preparation ingredients, or confirm drained/edible weight. The refreshed 74-name audit has 24 matching source references, four FNRI-supported portion estimates, and 46 names with unresolved preparation, product or quantity assumptions. These 46 remain excluded from verified affordability checks. The original 52-name review is documented in REMAINING_INGREDIENT_REVIEW.md.

DOST-FNRI MARFEL, using the FEL 4th edition (2019), provides AP/EP reference grams for carrot (51/45), cabbage (64/45), squash (52/45) and sitaw (42/45). Costing applies AP/EP to each recipe's edible grams and then uses the unchanged supplier price. Portion source links and calculation details appear in ingredient breakdowns and Admin. Missing AP values are never fabricated, and portions for unrelated foods are not reused. These are Philippine reference estimates, not actual measured yields for each recipe. Product notes, partial foods and other unresolved evidence still block affordability.
