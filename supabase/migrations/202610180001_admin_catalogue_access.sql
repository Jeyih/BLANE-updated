-- Apply with the Supabase SQL editor or an authenticated migration deployment.
-- No client may add itself to this private administrator registry.
begin;
create schema if not exists blane_private;
revoke all on schema blane_private from public, anon, authenticated;
create table if not exists blane_private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on blane_private.admin_users from public, anon, authenticated;
alter table blane_private.admin_users enable row level security;

create or replace function public.blane_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from blane_private.admin_users a
    join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid() and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.blane_is_admin() from public, anon;
grant execute on function public.blane_is_admin() to authenticated;

-- Replace the former email-based allowlist function if it was installed earlier.
create or replace function public.is_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select public.blane_is_admin();
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

do $$
declare target text;
begin
  foreach target in array array[
    'markets', 'market_ingredients', 'recipes', 'recipe_ingredients',
    'recipe_steps', 'fnri_food_composition', 'option_lists', 'goal_ideals',
    'constraint_definitions', 'ingredient_seasons'
  ] loop
    -- Missing tables abort the transaction instead of claiming partial protection.
    execute format('alter table public.%I enable row level security', target);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
    execute format('drop policy if exists blane_catalogue_read on public.%I', target);
    execute format('create policy blane_catalogue_read on public.%I for select to authenticated using (true)', target);
    execute format('drop policy if exists blane_catalogue_admin on public.%I', target);
    execute format('create policy blane_catalogue_admin on public.%I for all to authenticated using (public.blane_is_admin()) with check (public.blane_is_admin())', target);
    -- Restrictive guards also constrain any older permissive write policies.
    execute format('drop policy if exists blane_insert_guard on public.%I', target);
    execute format('create policy blane_insert_guard on public.%I as restrictive for insert to public with check (coalesce((select public.blane_is_admin()), false))', target);
    execute format('drop policy if exists blane_update_guard on public.%I', target);
    execute format('create policy blane_update_guard on public.%I as restrictive for update to public using (coalesce((select public.blane_is_admin()), false)) with check (coalesce((select public.blane_is_admin()), false))', target);
    execute format('drop policy if exists blane_delete_guard on public.%I', target);
    execute format('create policy blane_delete_guard on public.%I as restrictive for delete to public using (coalesce((select public.blane_is_admin()), false))', target);
  end loop;
end;
$$;

commit;
