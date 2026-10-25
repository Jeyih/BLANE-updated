# Price reference data setup

Run these migrations in order in Supabase (or apply them with the Supabase CLI):

1. `migrations/202610250001_price_reference_data.sql` creates the database table and restricted replacement function.
2. `migrations/202610250002_seed_price_reference_data.sql` imports the reviewed price snapshots, food matching rules, retailer product catalogue, DA product catalogue, and FNRI portion references.
3. `migrations/202610250003_classify_dessert_recipes.sql` adds a database dessert flag to existing recipe records without changing their meal-type values.

Configure the following server-side environment variables for Netlify Functions and local price-update scripts:

- `SUPABASE_URL`: project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service-role key. Keep it server-side; never use a `VITE_` prefix or expose it to browser code.

The browser reads the catalogue with the Supabase anon key. The Netlify price function refreshes records from source websites and saves successful updates to `price_reference_data`. Run `npm run prices:update` or `npm run prices:update-retail` to refresh a source manually.

Recipes, recipe ingredients, stores/markets, and market inventory already use their existing Supabase tables; this migration does not duplicate those records.
