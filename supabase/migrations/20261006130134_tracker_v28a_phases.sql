-- tracker v2.8a EXPAND: project phases, per-phase budgets, phase-aware order rule
-- (plan .omc/plans/tracker-v2.8-phases.md §4.0-4.4). Additive only: tracker_cuts.budget, tracker_users.role and
-- the old RPC params stay until the contract migration (tracker_v28b_contract).
-- Order (§4.4): (1) preflight → (2) table + columns → (3) backfill (audit UPDATE triggers off)
-- → (4) set constraints all immediate + asserts → (5) NOT NULL/FK, triggers, RPCs, ACLs → notify pgrst.

-- (1) preflight (§4.4 1a/1b, report: .omc/e2e/v2.8/preflight.sql). Owner decision 2026-10-06: "1b" cuts (stale keys
--     AND live keys not summing to 100, e.g. LINH_TẬP 0 C36/C40 at 95%) are KEPT exactly as they are (stale key
--     included, pay unchanged); only "1a" cuts (live keys sum to 100) are stripped in (3). A later per-phase
--     tracker_set_cut_splits on a 1b cut replaces its phase keys and drops the stale key.

-- (2) table + nullable / defaulted columns (no guard triggers yet) ------------------------------------------
create table public.tracker_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order int not null,
  after uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, sort_order),
  unique (id, project_id)                                  -- target of the work-type composite FK
);
create unique index tracker_phases_name_key
  on public.tracker_phases (project_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- Supabase default privileges grant ALL to anon/authenticated; strip them. Immutable: no update/delete grant.
alter table public.tracker_phases enable row level security;
revoke all on public.tracker_phases from public, anon, authenticated;
create policy phases_select on public.tracker_phases for select to authenticated using ((select public.is_tracker_user()));
create policy phases_insert on public.tracker_phases for insert to authenticated with check ((select public.is_tracker_user()));
grant select, insert on public.tracker_phases to authenticated;
-- ponytail: not in supabase_realtime; phases only appear with a new project (tracker_projects fires). Add it if phases become editable.

alter table public.tracker_work_types add column phase_id uuid;
alter table public.tracker_cuts add column budgets jsonb not null default '{}' check (jsonb_typeof(budgets) = 'object');

-- (3) backfill: one phase "Animation" per project; budgets from budget; stale split keys stripped -------------
alter table public.tracker_cuts disable trigger tracker_audit_upd;
alter table public.tracker_work_types disable trigger tracker_audit_upd;

create temp table tracker_v28a_pct on commit drop as
select c.id as cut_id, w.id as type_id,
       case when c.pay_split is null then w.pay_pct else coalesce((c.pay_split ->> w.id::text)::numeric, 0) end as pct
from public.tracker_cuts c
join public.tracker_work_types w on w.project_id = c.project_id;

insert into public.tracker_phases (project_id, name, sort_order)
select id, 'Animation', 10 from public.tracker_projects;

update public.tracker_work_types w set phase_id = p.id
from public.tracker_phases p where p.project_id = w.project_id;

update public.tracker_cuts c set
  budgets = case when c.budget > 0 then jsonb_build_object(p.id::text, c.budget) else '{}'::jsonb end
from public.tracker_phases p where p.project_id = c.project_id;

-- strip stale split keys from 1a cuts only (live keys sum to 100); 1b cuts are not written at all, because the
-- old tracker_cut_split trigger would refuse their stale key on any UPDATE OF pay_split
update public.tracker_cuts c set
  pay_split = (select jsonb_object_agg(e.key, e.value) from jsonb_each(c.pay_split) e
               where exists (select 1 from public.tracker_work_types w
                             where w.project_id = c.project_id and w.id::text = e.key))
where c.pay_split is not null
  and exists (select 1 from jsonb_each(c.pay_split) e
              where not exists (select 1 from public.tracker_work_types w
                                where w.project_id = c.project_id and w.id::text = e.key))
  and (select sum(e.value::numeric) from jsonb_each(c.pay_split) e
       join public.tracker_work_types w on w.project_id = c.project_id and w.id::text = e.key) = 100;

-- (4) flush deferred checks (also required before ALTER TABLE: no pending trigger events allowed), then asserts
set constraints all immediate;

alter table public.tracker_cuts enable trigger tracker_audit_upd;
alter table public.tracker_work_types enable trigger tracker_audit_upd;

do $$
begin
  if exists (select 1 from public.tracker_work_types where phase_id is null) then
    raise exception 'tracker_v28a assert: work type without phase';
  end if;
  if exists (select 1 from public.tracker_projects pr
             where (select count(*) from public.tracker_phases p where p.project_id = pr.id and p.name = 'Animation') <> 1
                or (select count(*) from public.tracker_phases p where p.project_id = pr.id) <> 1) then
    raise exception 'tracker_v28a assert: project without exactly one phase "Animation"';
  end if;
  if exists (select 1 from public.tracker_phases p
             left join public.tracker_work_types w on w.phase_id = p.id
             group by p.id
             having count(w.id) < 1 or coalesce(sum(w.pay_pct), 0) <> 100) then
    raise exception 'tracker_v28a assert: phase without types or pay_pct total <> 100';
  end if;
  if exists (select 1 from public.tracker_cuts c
             where c.budget <> coalesce((select sum(e.value::numeric) from jsonb_each(c.budgets) e), 0)) then
    raise exception 'tracker_v28a assert: cut budget <> sum(budgets)';
  end if;
  if exists (select 1 from tracker_v28a_pct s
             join public.tracker_cuts c on c.id = s.cut_id
             join public.tracker_work_types w on w.id = s.type_id
             where s.pct <> case when c.pay_split is null then w.pay_pct
                                 else coalesce((c.pay_split ->> w.id::text)::numeric, 0) end) then
    raise exception 'tracker_v28a assert: effective pay pct changed for a cut x type';
  end if;
end $$;

-- (5) NOT NULL + FK ---------------------------------------------------------------------------------------
alter table public.tracker_work_types
  alter column phase_id set not null,
  add constraint tracker_work_types_phase_fk foreign key (phase_id, project_id)
    references public.tracker_phases(id, project_id);
create index on public.tracker_work_types (phase_id, project_id);   -- covers tracker_work_types_phase_fk

-- triggers ----------------------------------------------------------------------------------------------
-- Every rule trigger takes the per-project lock:
--   perform pg_advisory_xact_lock(hashtextextended(<project_id>::text, 0));
-- No calls into private helpers from invoker bodies (no schema usage): recursive CTEs are inlined.
-- "Locked after creation" = the project row was inserted in this transaction (created_at = now()).

-- 1. projects.created_at is immutable (the lock boundary)
create function private.tracker_project_created_lock() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.created_at is distinct from old.created_at then
    raise exception using errcode = 'P0001', message = 'phase_locked';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_project_created_lock() from public, anon, authenticated;
create trigger tracker_project_created_lock before update on public.tracker_projects
  for each row execute function private.tracker_project_created_lock();

-- 2. phases: only in the project's creation transaction; "after" = distinct, earlier phases of the project
create function private.tracker_phase_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  if not exists (select 1 from public.tracker_projects where id = new.project_id and created_at = now()) then
    raise exception using errcode = 'P0001', message = 'phase_locked';
  end if;
  if array_position(new.after, null) is not null
     or cardinality(new.after) <> (select count(distinct a.x) from unnest(new.after) a(x))
     or exists (select 1 from unnest(new.after) a(id)
                where not exists (select 1 from public.tracker_phases p
                                  where p.id = a.id and p.project_id = new.project_id
                                    and p.sort_order < new.sort_order)) then
    raise exception using errcode = 'P0001', message = 'phase_invalid';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_phase_guard() from public, anon, authenticated;
create trigger tracker_phase_guard before insert on public.tracker_phases
  for each row execute function private.tracker_phase_guard();

-- 3. work-type guard (V2 #3 extended): insert only at creation; id/code/phase/order locked; delete locked
create or replace function private.tracker_type_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
    if not exists (select 1 from public.tracker_projects where id = new.project_id and created_at = now()) then
      raise exception using errcode = 'P0001', message = 'phase_locked';
    end if;
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(old.project_id::text, 0));
  if tg_op = 'UPDATE' then
    if new.project_id is distinct from old.project_id then
      raise exception using errcode = 'P0001', message = 'project_immutable';
    end if;
    if (new.id, new.code, new.phase_id, new.sort_order) is distinct from (old.id, old.code, old.phase_id, old.sort_order) then
      raise exception using errcode = 'P0001', message = 'phase_locked';
    end if;
    if old.sort_order is distinct from new.sort_order
       and exists (select 1 from public.tracker_tasks where work_type_id = old.id) then
      raise exception using errcode = 'P0001', message = 'type_in_use';
    end if;
    return new;
  end if;
  -- known limit: a hard project delete may still hit type_in_use below (projects are archived, never deleted)
  if exists (select 1 from public.tracker_projects where id = old.project_id) then   -- not a project cascade
    raise exception using errcode = 'P0001', message = 'phase_locked';
  end if;
  if exists (select 1 from public.tracker_tasks where work_type_id = old.id) then
    raise exception using errcode = 'P0001', message = 'type_in_use';
  end if;
  return old;
end $$;

-- 4. pay % per phase = 100, >= 1 phase, >= 1 type per phase; checked at commit
create or replace function private.tracker_pct_total() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_project uuid;
begin
  if tg_table_name = 'tracker_projects' then
    v_project := new.id;
  elsif tg_op = 'DELETE' then
    v_project := old.project_id;
  else
    v_project := new.project_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_project::text, 0));
  if not exists (select 1 from public.tracker_projects where id = v_project) then
    return null;
  end if;
  if not exists (select 1 from public.tracker_phases where project_id = v_project)
     or exists (select 1 from public.tracker_phases p
                left join public.tracker_work_types w on w.phase_id = p.id
                where p.project_id = v_project
                group by p.id
                having count(w.id) < 1 or coalesce(sum(w.pay_pct), 0) <> 100) then
    raise exception using errcode = 'P0001', message = 'pct_total';
  end if;
  return null;
end $$;
create constraint trigger tracker_pct_total after insert on public.tracker_phases
  deferrable initially deferred for each row execute function private.tracker_pct_total();

-- 5. pipeline order rule (V26 M3 restated by phase relation). Same phase: V26 rule with prev/next by phase.
--    Ancestor phase task: must end before the candidate starts. Descendant phase task: must start after the
--    candidate ends. Unrelated phases: no rule. Fixes exempt on both sides. Pick = lowest global sort_order (O6).
create or replace function private.tracker_task_order() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_order int;
  v_phase uuid;
  v_prev uuid;
  v_next uuid;
  v_flag boolean;
  v_anc uuid[];
  v_desc uuid[];
  v_conflict uuid;
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception using errcode = 'P0001', message = 'project_immutable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  if tg_op = 'UPDATE' and new.is_fix is distinct from old.is_fix then
    raise exception using errcode = 'P0001', message = 'fix_immutable';
  end if;
  if new.is_fix then
    if (tg_op = 'INSERT'
        or new.cut_id is distinct from old.cut_id
        or new.work_type_id is distinct from old.work_type_id)
       and not exists (select 1 from public.tracker_tasks t
                       where t.cut_id = new.cut_id and t.work_type_id = new.work_type_id and not t.is_fix) then
      raise exception using errcode = 'P0001', message = 'fix_no_stage';
    end if;
    return new;
  end if;
  select x.sort_order, x.phase_id, x.prev, x.next, x.overlaps_prev into v_order, v_phase, v_prev, v_next, v_flag
  from (select w.id, w.sort_order, w.phase_id, w.overlaps_prev,
               lag(w.id)  over (partition by w.phase_id order by w.sort_order) prev,
               lead(w.id) over (partition by w.phase_id order by w.sort_order) next
        from public.tracker_work_types w where w.project_id = new.project_id) x
  where x.id = new.work_type_id;
  if v_order is null then
    return new;  -- unknown type: the FK reports it
  end if;
  with recursive anc(id) as (
    select a.id from public.tracker_phases p cross join unnest(p.after) a(id) where p.id = v_phase
    union
    select a.id from public.tracker_phases p join anc on p.id = anc.id cross join unnest(p.after) a(id)
  )
  select coalesce(array_agg(id), '{}') into v_anc from anc;
  with recursive des(id) as (
    select p.id from public.tracker_phases p where v_phase = any(p.after)
    union
    select p.id from public.tracker_phases p join des on des.id = any(p.after)
  )
  select coalesce(array_agg(id), '{}') into v_desc from des;
  select t.id into v_conflict
  from public.tracker_tasks t
  join public.tracker_work_types w on w.id = t.work_type_id
  where t.cut_id = new.cut_id and t.id <> new.id and not t.is_fix and (
    (w.phase_id = v_phase and (
         (w.sort_order < v_order and case when w.id = v_prev and v_flag
                                          then t.start_date > new.start_date
                                          else t.end_date >= new.start_date end)
      or (w.sort_order > v_order and case when w.id = v_next and w.overlaps_prev
                                          then t.start_date < new.start_date
                                          else t.start_date <= new.end_date end)))
    or (w.phase_id = any(v_anc) and t.end_date >= new.start_date)
    or (w.phase_id = any(v_desc) and t.start_date <= new.end_date))
  order by w.sort_order
  limit 1;
  if v_conflict is not null then
    raise exception using errcode = 'P0001', message = 'order_conflict', detail = v_conflict::text;
  end if;
  return new;
end $$;

-- 6. type order re-check (V26 M4): pairs only inside one phase, predecessor by phase
create or replace function private.tracker_type_order_check() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_project uuid;
  v_cut text;
begin
  if tg_op = 'DELETE' then
    v_project := old.project_id;
  else
    v_project := new.project_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_project::text, 0));
  if not exists (select 1 from public.tracker_projects where id = v_project) then
    return null;
  end if;
  with types as (
    select id, phase_id, sort_order, overlaps_prev, lag(id) over (partition by phase_id order by sort_order) prev
    from public.tracker_work_types where project_id = v_project
  )
  select c.code into v_cut
  from public.tracker_tasks a
  join types ta on ta.id = a.work_type_id
  join public.tracker_tasks b on b.cut_id = a.cut_id and b.id <> a.id
  join types tb on tb.id = b.work_type_id and tb.phase_id = ta.phase_id
  join public.tracker_cuts c on c.id = a.cut_id
  where a.project_id = v_project and ta.sort_order < tb.sort_order
    and not a.is_fix and not b.is_fix
    and case when tb.overlaps_prev and tb.prev = ta.id
             then b.start_date < a.start_date
             else a.end_date >= b.start_date end
  order by c.code
  limit 1;
  if v_cut is not null then
    raise exception using errcode = 'P0001', message = 'overlap_in_use', detail = v_cut;
  end if;
  return null;
end $$;

-- 7. cut split (SPLIT rewrite): keys = project types, values 0..100 (2 decimals), each phase with a key sums to 100
create or replace function private.tracker_cut_split() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_bad int;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  select count(*) filter (where s.pct is null or s.pct not between 0 and 100 or s.pct <> round(s.pct, 2)
                            or w.id is null)
  into v_bad
  from (select e.key, case when jsonb_typeof(e.value) = 'number' then e.value::numeric end as pct
        from jsonb_each(new.pay_split) e) s
  left join public.tracker_work_types w on w.project_id = new.project_id and w.id::text = s.key;
  if v_bad > 0 or exists (
    select 1 from jsonb_each(new.pay_split) e
    join public.tracker_work_types w on w.project_id = new.project_id and w.id::text = e.key
    group by w.phase_id
    having sum(case when jsonb_typeof(e.value) = 'number' then e.value::numeric end) is distinct from 100) then
    raise exception using errcode = 'P0001', message = 'pct_total';
  end if;
  return new;
end $$;

-- 8. cut budgets: validation + (EXPAND ONLY) sync with the legacy scalar budget
create function private.tracker_cut_budgets() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_phases uuid[];
  v_bad int;
  v_sum numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  -- expand sync (removed by the contract migration): an old-code write of budget lands in the single phase
  if (tg_op = 'INSERT' and new.budgets = '{}'::jsonb and new.budget > 0)
     or (tg_op = 'UPDATE' and new.budgets is not distinct from old.budgets and new.budget is distinct from old.budget) then
    select array_agg(id) into v_phases from public.tracker_phases where project_id = new.project_id;
    if cardinality(v_phases) is distinct from 1 then
      raise exception using errcode = 'P0001', message = 'invalid';
    end if;
    new.budgets := jsonb_build_object(v_phases[1]::text, new.budget);
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
  new.budget := v_sum;   -- expand only: legacy column = sum(budgets)
  return new;
end $$;
revoke execute on function private.tracker_cut_budgets() from public, anon, authenticated;
create trigger tracker_cut_budgets before insert or update of budget, budgets on public.tracker_cuts
  for each row execute function private.tracker_cut_budgets();

-- RPCs (SECURITY INVOKER; RLS applies) --------------------------------------------------------------------
-- create project: p_phases = [{name, after: [index], types: [{code,label,color,pay_pct,overlaps_prev}]}];
-- p_phases null → p_types wrapped as one phase "Animation" (old callers). Contract drops p_types.
drop function public.tracker_create_project(text, text, jsonb);
create function public.tracker_create_project(p_name text, p_color text, p_types jsonb default null, p_phases jsonb default null)
returns public.tracker_projects
language plpgsql security invoker set search_path = '' as $$
declare
  v_project public.tracker_projects;
  v_phases jsonb := p_phases;
  v_ph record;
  v_ids uuid[] := '{}';
  v_id uuid;
  v_after uuid[];
  v_after_j jsonb;
  v_types_j jsonb;
  v_n int := 0;
begin
  if v_phases is null then
    v_phases := jsonb_build_array(jsonb_build_object(
      'name', 'Animation',
      'after', '[]'::jsonb,
      'types', (select coalesce(jsonb_agg(e.value order by (e.value ->> 'sort_order')::int nulls last, e.ord), '[]'::jsonb)
                from jsonb_array_elements(p_types) with ordinality e(value, ord))));
  end if;
  insert into public.tracker_projects (name, color) values (p_name, p_color) returning * into v_project;
  perform pg_advisory_xact_lock(hashtextextended(v_project.id::text, 0));
  if jsonb_typeof(v_phases) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'phase_invalid';
  end if;
  for v_ph in select e.value, e.ord from jsonb_array_elements(v_phases) with ordinality e(value, ord) order by e.ord loop
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

-- save work types: only label / colour / pay % / overlaps of the existing set (D2, O9)
create or replace function public.tracker_save_work_types(p_project uuid, p_types jsonb)
returns setof public.tracker_work_types
language plpgsql security invoker set search_path = '' as $$
declare
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  select count(*) into v_n from public.tracker_work_types where project_id = p_project;
  if (select count(*) from jsonb_array_elements(p_types)) <> v_n
     or (select count(distinct e ->> 'id') from jsonb_array_elements(p_types) e) <> v_n
     or exists (select 1 from jsonb_array_elements(p_types) e where e ->> 'id' is null)
     or exists (select 1
                from jsonb_to_recordset(p_types) as e(id uuid, code text, sort_order int)
                left join public.tracker_work_types w on w.id = e.id and w.project_id = p_project
                where w.id is null
                   or (e.code is not null and e.code <> w.code)
                   or (e.sort_order is not null and e.sort_order <> w.sort_order)) then
    raise exception using errcode = 'P0001', message = 'phase_locked';
  end if;
  update public.tracker_work_types w set
    label = e.label, color = e.color, pay_pct = e.pay_pct, overlaps_prev = coalesce(e.overlaps_prev, false)
  from jsonb_to_recordset(p_types) as e(id uuid, label text, color text, pay_pct numeric, overlaps_prev boolean)
  where w.id = e.id and w.project_id = p_project;
  return query select * from public.tracker_work_types where project_id = p_project order by sort_order;
end $$;

-- set one phase's budget on a cut (atomic merge under the row lock)
create function public.tracker_set_cut_budget(p_cut uuid, p_phase uuid, p_budget bigint)
returns public.tracker_cuts
language plpgsql security invoker set search_path = '' as $$
declare
  v_project uuid;
  v_cut public.tracker_cuts;
begin
  select project_id into v_project from public.tracker_cuts where id = p_cut;
  if v_project is null then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_project::text, 0));
  if not exists (select 1 from public.tracker_phases where id = p_phase and project_id = v_project) then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  update public.tracker_cuts set budgets = budgets || jsonb_build_object(p_phase::text, p_budget)
  where id = p_cut
  returning * into v_cut;
  if not found then   -- deleted between the lookup and the lock
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  return v_cut;
end $$;

-- split for many cuts: p_phase null = whole replace (old callers); else replace that phase's keys only
-- (also drops keys of types no longer in the project). Contract: p_phase required.
drop function public.tracker_set_cut_splits(uuid, uuid[], jsonb);
create function public.tracker_set_cut_splits(p_project uuid, p_cuts uuid[], p_split jsonb, p_phase uuid default null)
returns setof public.tracker_cuts
language plpgsql security invoker set search_path = '' as $$
declare
  v_split jsonb := nullif(p_split, 'null'::jsonb);   -- a JSON null arrives as jsonb 'null'
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  if p_phase is null then
    return query
    with upd as (
      update public.tracker_cuts set pay_split = v_split
      where project_id = p_project and id = any(p_cuts)
      returning *
    )
    select * from upd;
    return;
  end if;
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

-- create task: optional trailing p_budgets (used only when the cut is created). Contract drops p_budget.
drop function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean);
create function public.tracker_create_task(p_project uuid, p_staff uuid, p_type uuid, p_cut_code text,
                                           p_start date, p_end date, p_budget bigint default null,
                                           p_is_fix boolean default false, p_budgets jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_code text := public.tracker_normalize_cut(p_cut_code);
  v_phase uuid;
  v_cut public.tracker_cuts;
  v_task public.tracker_tasks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  select * into v_cut from public.tracker_cuts where project_id = p_project and code = v_code;
  if not found then   -- budgets apply only when the cut is created; an existing cut is never written
    select phase_id into v_phase from public.tracker_work_types where id = p_type and project_id = p_project;
    -- never a JSON null value: p_budgets, else {phase: p_budget} when p_budget is given, else {}
    insert into public.tracker_cuts (project_id, code, budgets)
    values (p_project, v_code,
            coalesce(nullif(p_budgets, 'null'::jsonb),
                     case when p_budget is not null and v_phase is not null
                          then jsonb_build_object(v_phase::text, p_budget) end,
                     '{}'::jsonb))
    on conflict (project_id, code) do nothing;
    select * into v_cut from public.tracker_cuts where project_id = p_project and code = v_code;
  end if;
  insert into public.tracker_tasks (project_id, staff_id, work_type_id, cut_id, start_date, end_date, is_fix)
  values (p_project, p_staff, p_type, v_cut.id, p_start, p_end, p_is_fix)
  returning * into v_task;
  return jsonb_build_object('task', to_jsonb(v_task), 'cut', to_jsonb(v_cut));
end $$;

-- ACLs (pattern V2:584-597) ------------------------------------------------------------------------------
revoke execute on function
  public.tracker_create_project(text, text, jsonb, jsonb),
  public.tracker_save_work_types(uuid, jsonb),
  public.tracker_set_cut_budget(uuid, uuid, bigint),
  public.tracker_set_cut_splits(uuid, uuid[], jsonb, uuid),
  public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean, jsonb)
  from anon, public;
grant execute on function
  public.tracker_create_project(text, text, jsonb, jsonb),
  public.tracker_save_work_types(uuid, jsonb),
  public.tracker_set_cut_budget(uuid, uuid, bigint),
  public.tracker_set_cut_splits(uuid, uuid[], jsonb, uuid),
  public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
