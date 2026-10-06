-- tracker v2.8b CONTRACT (Gate B; plan .omc/plans/tracker-v2.8-phases.md §4.0, §4.4 contract; notes
-- .omc/e2e/v2.8/contract-notes.md). Run only after the new code is live. Drops the legacy scalar cut budget,
-- tracker_users.role and the old RPC params (p_types, p_budget, optional p_phase).
-- Checked read-only on live before writing: role / budget have no dependent view, policy or function besides
-- the tracker_cut_budgets trigger (column list) and the bodies recreated below; the remaining `p_types` /
-- `p_budget` names are the own params of tracker_save_work_types / tracker_set_cut_budget (unchanged).

-- (1) budgets trigger: validation only (its old column list "update of budget, budgets" depends on budget)
drop trigger tracker_cut_budgets on public.tracker_cuts;

create or replace function private.tracker_cut_budgets() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_bad int;
  v_sum numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  if jsonb_typeof(new.budgets) is distinct from 'object' then   -- array/scalar: invalid, not a raw 22023
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  select count(*) filter (where s.amt is null or s.amt not between 0 and 10000000000 or s.amt <> trunc(s.amt)
                            or not exists (select 1 from public.tracker_phases p
                                           where p.project_id = new.project_id and p.id::text = s.key)),
         coalesce(sum(s.amt), 0)
  into v_bad, v_sum
  from (select e.key, case when jsonb_typeof(e.value) = 'number' then e.value::numeric end as amt
        from jsonb_each(new.budgets) e) s;
  if v_bad > 0 or v_sum > 10000000000 then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_cut_budgets() from public, anon, authenticated;
create trigger tracker_cut_budgets before insert or update of budgets on public.tracker_cuts
  for each row execute function private.tracker_cut_budgets();

-- (2)/(3) legacy columns
alter table public.tracker_cuts drop column budget;
alter table public.tracker_users drop column role;

-- (4) RPCs without the old params ------------------------------------------------------------------------
-- create project: p_phases = [{name, after: [index], types: [{code,label,color,pay_pct,overlaps_prev}]}], all required
drop function public.tracker_create_project(text, text, jsonb, jsonb);
create function public.tracker_create_project(p_name text, p_color text, p_phases jsonb)
returns public.tracker_projects
language plpgsql security invoker set search_path = '' as $$
declare
  v_project public.tracker_projects;
  v_ph record;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_after uuid[];
  v_after_j jsonb;
  v_types_j jsonb;
  v_n int := 0;
begin
  insert into public.tracker_projects (name, color) values (p_name, p_color) returning * into v_project;
  perform pg_advisory_xact_lock(hashtextextended(v_project.id::text, 0));
  if jsonb_typeof(p_phases) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'phase_invalid';
  end if;
  for v_ph in select e.value, e.ord from jsonb_array_elements(p_phases) with ordinality e(value, ord) order by e.ord loop
    -- a missing key = []; a JSON null / non-array / non-index entry is phase_invalid (not a raw 22023 / 22P02)
    v_after_j := coalesce(v_ph.value -> 'after', '[]'::jsonb);
    v_types_j := coalesce(v_ph.value -> 'types', '[]'::jsonb);
    if jsonb_typeof(v_after_j) <> 'array' or jsonb_typeof(v_types_j) <> 'array' then
      raise exception using errcode = 'P0001', message = 'phase_invalid';
    end if;
    if exists (select 1 from jsonb_array_elements_text(v_after_j) a(idx)
               where a.idx is null or a.idx !~ '^[0-9]{1,9}$') then
      raise exception using errcode = 'P0001', message = 'phase_invalid';
    end if;
    -- index → id of an already inserted phase; self / later index → null → phase_invalid (guard)
    select coalesce(array_agg(v_ids[a.idx::int + 1] order by a.ord), '{}') into v_after
    from jsonb_array_elements_text(v_after_j) with ordinality a(idx, ord);
    insert into public.tracker_phases (project_id, name, sort_order, after)
    values (v_project.id, v_ph.value ->> 'name', v_ph.ord * 10, v_after)
    returning id into v_id;
    v_ids := v_ids || v_id;
    insert into public.tracker_work_types (project_id, phase_id, code, label, color, pay_pct, sort_order, overlaps_prev)
    select v_project.id, v_id, e.code, e.label, e.color, e.pay_pct, (v_n + t.ord) * 10, coalesce(e.overlaps_prev, false)
    from jsonb_array_elements(v_types_j) with ordinality t(value, ord)
    cross join lateral jsonb_to_record(t.value) as e(code text, label text, color text, pay_pct numeric, overlaps_prev boolean);
    v_n := v_n + jsonb_array_length(v_types_j);
  end loop;
  return v_project;
end $$;

-- split for many cuts: replace p_phase's keys only (also drops keys of types no longer in the project)
drop function public.tracker_set_cut_splits(uuid, uuid[], jsonb, uuid);
create function public.tracker_set_cut_splits(p_project uuid, p_cuts uuid[], p_split jsonb, p_phase uuid)
returns setof public.tracker_cuts
language plpgsql security invoker set search_path = '' as $$
declare
  v_split jsonb := nullif(p_split, 'null'::jsonb);   -- a JSON null arrives as jsonb 'null'
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  if not exists (select 1 from public.tracker_phases where id = p_phase and project_id = p_project) then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  if v_split is not null and (jsonb_typeof(v_split) <> 'object' or exists (
       select 1 from jsonb_object_keys(v_split) k
       where not exists (select 1 from public.tracker_work_types w
                         where w.project_id = p_project and w.phase_id = p_phase and w.id::text = k))) then
    raise exception using errcode = 'P0001', message = 'pct_total';
  end if;
  return query
  with upd as (
    update public.tracker_cuts c set pay_split = nullif(
      coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(c.pay_split) e
                where exists (select 1 from public.tracker_work_types w
                              where w.project_id = p_project and w.phase_id <> p_phase and w.id::text = e.key)),
               '{}'::jsonb) || coalesce(v_split, '{}'::jsonb),
      '{}'::jsonb)
    where c.project_id = p_project and c.id = any(p_cuts)
    returning *
  )
  select * from upd;
end $$;

-- create task: optional p_budgets, used only when the cut is created
drop function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean, jsonb);
create function public.tracker_create_task(p_project uuid, p_staff uuid, p_type uuid, p_cut_code text,
                                           p_start date, p_end date,
                                           p_is_fix boolean default false, p_budgets jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_code text := public.tracker_normalize_cut(p_cut_code);
  v_cut public.tracker_cuts;
  v_task public.tracker_tasks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  select * into v_cut from public.tracker_cuts where project_id = p_project and code = v_code;
  if not found then   -- budgets apply only when the cut is created; an existing cut is never written
    insert into public.tracker_cuts (project_id, code, budgets)
    values (p_project, v_code, coalesce(nullif(p_budgets, 'null'::jsonb), '{}'::jsonb))   -- never a JSON null value
    on conflict (project_id, code) do nothing;
    select * into v_cut from public.tracker_cuts where project_id = p_project and code = v_code;
  end if;
  insert into public.tracker_tasks (project_id, staff_id, work_type_id, cut_id, start_date, end_date, is_fix)
  values (p_project, p_staff, p_type, v_cut.id, p_start, p_end, p_is_fix)
  returning * into v_task;
  return jsonb_build_object('task', to_jsonb(v_task), 'cut', to_jsonb(v_cut));
end $$;

-- (5) ACLs (pattern V2:584-597) ---------------------------------------------------------------------------
revoke execute on function
  public.tracker_create_project(text, text, jsonb),
  public.tracker_set_cut_splits(uuid, uuid[], jsonb, uuid),
  public.tracker_create_task(uuid, uuid, uuid, text, date, date, boolean, jsonb)
  from anon, public;
grant execute on function
  public.tracker_create_project(text, text, jsonb),
  public.tracker_set_cut_splits(uuid, uuid[], jsonb, uuid),
  public.tracker_create_task(uuid, uuid, uuid, text, date, date, boolean, jsonb)
  to authenticated;

-- (6) assert: no live function body still uses the dropped column / params, one function per changed RPC
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname in ('public', 'private')
               and p.proname not in ('tracker_save_work_types', 'tracker_set_cut_budget')   -- own params of the same name
               and (p.prosrc ~ '\mp_types\M' or p.prosrc ~ '\mp_budget\M' or p.prosrc ~ '\mbudget\M')) then
    raise exception 'tracker_v28b assert: a function body still references budget / p_types / p_budget';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('tracker_create_project', 'tracker_set_cut_splits', 'tracker_create_task')) <> 3 then
    raise exception 'tracker_v28b assert: expected exactly one function per changed RPC';
  end if;
end $$;

notify pgrst, 'reload schema';
