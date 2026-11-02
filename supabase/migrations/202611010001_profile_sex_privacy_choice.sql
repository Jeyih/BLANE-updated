-- Preserve existing values and constraints while allowing an explicit privacy choice.
begin;

do $$
declare
  sex_column smallint;
  sex_type oid;
  rule record;
begin
  select attnum, atttypid into sex_column, sex_type
  from pg_attribute
  where attrelid = 'public.profiles'::regclass and attname = 'sex' and not attisdropped;

  if sex_column is null or sex_type not in ('text'::regtype::oid, 'varchar'::regtype::oid, 'bpchar'::regtype::oid) then
    raise exception 'The profiles.sex column needs administrator review before adding the privacy choice.';
  end if;

  -- Avoid a short varchar limit rejecting the new choice.
  alter table public.profiles alter column sex type text using sex::text;

  -- Extend only checks that concern sex alone; retain every existing expression.
  for rule in
    select conname, pg_get_expr(conbin, conrelid) as expression
    from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and conkey = array[sex_column]::smallint[]
  loop
    execute format('alter table public.profiles drop constraint %I', rule.conname);
    execute format('alter table public.profiles add constraint %I check (sex = %L or (%s))',
      rule.conname, 'prefer_not_to_say', rule.expression);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
