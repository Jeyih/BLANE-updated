# Price reference data setup

Run these migrations in order in Supabase (or apply them with the Supabase CLI):

1. `migrations/202610250001_price_reference_data.sql` creates the database table and restricted replacement function.
2. `migrations/202610250002_seed_price_reference_data.sql` imports the reviewed price snapshots, food matching rules, retailer product catalogue, DA product catalogue, and FNRI portion references.
3. `migrations/202610250003_classify_dessert_recipes.sql` adds a database dessert flag to existing recipe records without changing their meal-type values.

For Netlify Functions, configure `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`). These values must be available to the **Functions runtime**, not only the frontend build. The existing migration already permits public catalogue reads; no new RLS policy is required.

The price function can fetch newer source quotes using public read access. In that mode, fresh quotes are served from the function instance's memory, no database writes are attempted, and the response/UI explicitly states that new quotes are not saved. A function cold start begins from the last database snapshot and checks sources again.

To also persist successful source checks across function instances, configure the following server-side variables. Local price-update scripts require these writer credentials:

- `SUPABASE_URL`: project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role key. Keep it server-side; never use a `VITE_` prefix or expose it to browser code.

The browser reads the catalogue with the Supabase anon key. With the writer key configured, the Netlify price function saves successful updates to `price_reference_data`. Run `npm run prices:update` or `npm run prices:update-retail` to refresh a source manually. Never add the service-role key to a `VITE_` variable, source file, commit, or chat.

## Deployment verification

1. Deploy the updated frontend and `ingredient-prices` function together from the intended Git revision.
2. Open `/.netlify/functions/ingredient-prices`. Expect HTTP 200, dated source records and `persistence: database` (writer configured) or `memory` (public read mode). A 200 alone does not mean all suppliers refreshed: inspect `warning`, report date and individual quote dates.
3. If 503 persists, check the owning project's function logs and runtime variable scope. Verify that the catalogue migrations were applied and reads return records. Error responses deliberately omit credentials and internal diagnostics.
4. In Markets, check the displayed report/source dates and use **Check prices now**. Two supplier checks on 27 October 2026 failed; those quotes correctly retained their previous dates.
5. GeoMarket polls stored markets/inventory every 15 seconds while visible, and on focus/reconnection. **Refresh markets** requests a snapshot immediately. Changes to market names, closures, quantities and availability must appear after an authorized administrator saves them. Search, map markers and distances use the refreshed Tarlac City list. Refreshing records does not independently verify store stock.

Recipes, recipe ingredients, stores/markets, and market inventory already use their existing Supabase tables; this migration does not duplicate those records.
