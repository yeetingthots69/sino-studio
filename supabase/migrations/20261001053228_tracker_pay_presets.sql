-- Studio-wide pay split presets. pcts are stored by work-type position (sort order), not by type id,
-- so a preset fits any project; codes are the work-type codes at save time (display only).
create table public.tracker_pay_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 60),
  pcts numeric(5,2)[] not null check (
    array_ndims(pcts) = 1 and cardinality(pcts) between 1 and 50
    and array_position(pcts, null) is null and 0 <= all(pcts) and 100 >= all(pcts)),
  codes text[] not null check (array_ndims(codes) = 1 and cardinality(codes) = cardinality(pcts)),
  created_at timestamptz not null default now()
);

create function private.tracker_preset_total() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (select sum(p) from unnest(new.pcts) p) <> 100 then
    raise exception using errcode = 'P0001', message = 'pct_total';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_preset_total() from public, anon, authenticated;
create trigger tracker_preset_total before insert or update on public.tracker_pay_presets
  for each row execute function private.tracker_preset_total();

alter table public.tracker_pay_presets enable row level security;
revoke all on public.tracker_pay_presets from anon, authenticated;
grant select, insert, delete on public.tracker_pay_presets to authenticated;
create policy pay_presets_rw on public.tracker_pay_presets for all to authenticated
  using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));

-- One split (or null = project default) for many cuts of a project, atomically (ids go in the body, not the URL).
-- The tracker_cut_split trigger validates every row.
create function public.tracker_set_cut_splits(p_project uuid, p_cuts uuid[], p_split jsonb)
returns setof public.tracker_cuts
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  return query
  with upd as (
    update public.tracker_cuts set pay_split = nullif(p_split, 'null'::jsonb)  -- a JSON null arrives as jsonb 'null'
    where project_id = p_project and id = any(p_cuts)
    returning *
  )
  select * from upd;
end $$;
revoke execute on function public.tracker_set_cut_splits(uuid, uuid[], jsonb) from anon, public;
grant execute on function public.tracker_set_cut_splits(uuid, uuid[], jsonb) to authenticated;
