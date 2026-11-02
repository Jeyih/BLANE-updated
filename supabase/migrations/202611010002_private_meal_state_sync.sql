begin;

create table if not exists public.private_meal_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null check (state_key in ('blane_meal_plan_weeks_v1', 'blane_completed_meals_v2', 'blane_slot_optimizations_v1', 'blane_grocery_v2')),
  value jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, state_key),
  check (octet_length(value::text) <= 2097152),
  check ((state_key = 'blane_grocery_v2' and jsonb_typeof(value) = 'array')
    or (state_key <> 'blane_grocery_v2' and jsonb_typeof(value) = 'object'))
);

alter table public.private_meal_state enable row level security;
drop policy if exists private_meal_state_read_own on public.private_meal_state;
create policy private_meal_state_read_own on public.private_meal_state for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.private_meal_state from anon, authenticated;
grant select on public.private_meal_state to authenticated;

-- Writes derive identity from the verified session. Revision comparison prevents
-- an older browser from silently overwriting a newer device's changes.
create or replace function public.save_private_meal_state(p_account uuid, p_key text, p_value jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved public.private_meal_state;
begin
  if owner_id is null or owner_id is distinct from p_account then raise exception 'Account does not match the signed-in user'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Invalid revision'; end if;
  insert into public.private_meal_state as existing (user_id, state_key, value, revision)
    values (owner_id, p_key, p_value, 1)
    on conflict (user_id, state_key) do update
      set value = excluded.value, revision = existing.revision + 1, updated_at = now()
      where existing.revision = p_expected_revision
    returning * into saved;
  -- An absent row can be inserted only when the client expected no row.
  if saved.revision = 1 and p_expected_revision <> 0 then
    raise exception 'State removed; reload before saving';
  end if;
  if saved.user_id is null then return jsonb_build_object('saved', false); end if;
  return jsonb_build_object('saved', true, 'revision', saved.revision);
end;
$$;
revoke all on function public.save_private_meal_state(uuid, text, jsonb, bigint) from public, anon;
grant execute on function public.save_private_meal_state(uuid, text, jsonb, bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
