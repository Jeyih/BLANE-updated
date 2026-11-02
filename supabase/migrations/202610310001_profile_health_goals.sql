-- Keep profiles.goal as the primary goal so existing clients and calorie calculations work.
begin;

do $$ begin
if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_health_goals_limit') then
alter table public.profiles
  add column if not exists health_goals text[] not null default '{}';

alter table public.profiles
  add constraint profiles_health_goals_limit check (
    cardinality(health_goals) <= 3
    and array_position(health_goals, null) is null
    and (cardinality(health_goals) = 0 or (goal is not null and goal = any(health_goals)))
  );
end if;
end $$;

comment on column public.profiles.health_goals is
  'Up to three selected health goals, including the primary profiles.goal. Empty on legacy profiles.';

notify pgrst, 'reload schema';
commit;
