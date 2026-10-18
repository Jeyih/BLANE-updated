# Apply catalogue administrator protection

Status: migration prepared locally, not applied to the hosted database. The workspace has a public Supabase client key but no database management credentials. Existing hosted policies have not been inspected or certified.

## Apply

1. Open the BLANE Supabase project as its database administrator.
2. Confirm the existing project administrator in `src/lib/admin-auth.js` has a verified account. The migration seeds that existing real account, and deliberately excludes the sample account. If additional administrators are required, have the project owner review their verified user IDs before adding them to the private registry.
3. Run `migrations/202610180001_admin_catalogue_access.sql` in the SQL editor, or deploy it through the project's authenticated migration workflow. It runs in a transaction and stops if no administrator is found or a catalogue table is missing. Review any error before changing the SQL.
4. Run the read-only verification below as the database administrator. Expect all ten catalogue tables to have RLS enabled and three restrictive guards each. This checks policy presence; the direct-request checks in the next section are also necessary.

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       count(p.policyname) filter (
         where p.permissive = 'RESTRICTIVE'
           and p.policyname in ('blane_insert_guard', 'blane_update_guard', 'blane_delete_guard')
       ) as write_guards
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public' and c.relname in (
  'markets', 'market_ingredients', 'recipes', 'recipe_ingredients', 'recipe_steps',
  'fnri_food_composition', 'option_lists', 'goal_ideals', 'constraint_definitions', 'ingredient_seasons'
)
group by c.relname, c.relrowsecurity
order by c.relname;
```

## Verify with test accounts

Use controlled records in a staging database and ordinary authenticated API requests. Do not use the SQL editor's owner role or a service-role key to test end-user permissions; those can bypass RLS.

- Sign in as an ordinary user. Reading the catalogue should work. Direct insert, update and delete requests must not change the controlled catalogue records, even when bypassing the frontend. Inspect affected rows and read back the record: RLS may return zero affected rows instead of an explicit error.
- Sign in as the configured administrator. `rpc('blane_is_admin')` should return true; the ordinary user's call should return false. Confirm the administrator can create, update and remove a disposable market and ingredient through Admin.
- Attempt the same writes without authentication; they must not change records.
- Confirm normal profile, health-log and feedback operations still work. This migration does not change policies for those tables; their existing user-data isolation requires a separate live audit.
- Leave GeoMarket open in a second browser, edit a controlled market's price, quantity, availability or open status in Admin, and verify the page updates within the next polling interval plus request time. Confirm the refresh timestamp advances without resetting the selected hub, filter or market.
- Disconnect the network after a successful refresh. Confirm old records remain visible with the refresh warning, then reconnect and confirm recovery.

## Permission model

The email list in the frontend controls navigation only. Server authorization comes from a private registry keyed by authenticated user ID. Users cannot modify that registry through the public API. Restrictive insert, update and delete policies prevent legacy permissive policies from allowing ordinary users to edit shared catalogue records. The usual trusted database-owner and service-role privileges remain outside end-user RLS enforcement.

This migration covers the shared catalogue tables only. It does not claim a complete database security audit, live stock integration, or a nutrition-validation result.
