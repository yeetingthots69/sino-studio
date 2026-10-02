-- tracker v2.5: overlappable stages (plan .omc/plans/tracker-v2.5-overlap.md §4.1)
-- A type flagged overlaps_prev may start on or after the start of its direct predecessor (by sort_order).
-- Every other pair stays strict: the earlier stage ends before the later one starts.

alter table public.tracker_work_types add column overlaps_prev boolean not null default false;

-- 1. pipeline order rule: same shape as V2, the pair predicate now honours the flag
create or replace function private.tracker_task_order() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_order int;
  v_prev uuid;
  v_next uuid;
  v_flag boolean;
  v_conflict uuid;
begin
  if tg_op = 'UPDATE' and new.project_id is distinct from old.project_id then
    raise exception using errcode = 'P0001', message = 'project_immutable';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  select x.sort_order, x.prev, x.next, x.overlaps_prev into v_order, v_prev, v_next, v_flag
  from (select w.id, w.sort_order, w.overlaps_prev,
               lag(w.id)  over (order by w.sort_order) prev,
               lead(w.id) over (order by w.sort_order) next
        from public.tracker_work_types w where w.project_id = new.project_id) x
  where x.id = new.work_type_id;
  if v_order is null then
    return new;  -- unknown type: the FK reports it
  end if;
  select t.id into v_conflict
  from public.tracker_tasks t
  join public.tracker_work_types w on w.id = t.work_type_id
  where t.cut_id = new.cut_id and t.id <> new.id and (
    (w.sort_order < v_order and case when w.id = v_prev and v_flag
                                     then t.start_date > new.start_date
                                     else t.end_date >= new.start_date end)
    or (w.sort_order > v_order and case when w.id = v_next and w.overlaps_prev
                                        then t.start_date < new.start_date
                                        else t.start_date <= new.end_date end))
  order by w.sort_order
  limit 1;
  if v_conflict is not null then
    raise exception using errcode = 'P0001', message = 'order_conflict', detail = v_conflict::text;
  end if;
  return new;
end $$;

-- 2. type changes (flag, order, insert between) must not leave tasks breaking the rule; checked at commit
create function private.tracker_type_order_check() returns trigger
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
    select id, sort_order, overlaps_prev, lag(id) over (order by sort_order) prev
    from public.tracker_work_types where project_id = v_project
  )
  select c.code into v_cut
  from public.tracker_tasks a
  join types ta on ta.id = a.work_type_id
  join public.tracker_tasks b on b.cut_id = a.cut_id and b.id <> a.id
  join types tb on tb.id = b.work_type_id
  join public.tracker_cuts c on c.id = a.cut_id
  where a.project_id = v_project and ta.sort_order < tb.sort_order
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
revoke execute on function private.tracker_type_order_check() from public, anon, authenticated;
create constraint trigger tracker_type_order after insert or update or delete on public.tracker_work_types
  deferrable initially deferred for each row execute function private.tracker_type_order_check();

-- 3. RPCs carry the flag
create or replace function public.tracker_create_project(p_name text, p_color text, p_types jsonb)
returns public.tracker_projects
language plpgsql security invoker set search_path = '' as $$
declare
  v_project public.tracker_projects;
begin
  insert into public.tracker_projects (name, color) values (p_name, p_color) returning * into v_project;
  perform pg_advisory_xact_lock(hashtextextended(v_project.id::text, 0));
  insert into public.tracker_work_types (project_id, code, label, color, pay_pct, sort_order, overlaps_prev)
  select v_project.id, e.code, e.label, e.color, e.pay_pct, e.sort_order, coalesce(e.overlaps_prev, false)
  from jsonb_to_recordset(p_types) as e(code text, label text, color text, pay_pct numeric, sort_order int, overlaps_prev boolean);
  return v_project;
end $$;

create or replace function public.tracker_save_work_types(p_project uuid, p_types jsonb)
returns setof public.tracker_work_types
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  delete from public.tracker_work_types w
  where w.project_id = p_project
    and not exists (select 1 from jsonb_array_elements(p_types) e where (e ->> 'id')::uuid = w.id);
  update public.tracker_work_types w set
    code = e.code, label = e.label, color = e.color, pay_pct = e.pay_pct, sort_order = e.sort_order,
    overlaps_prev = coalesce(e.overlaps_prev, false)
  from jsonb_to_recordset(p_types) as e(id uuid, code text, label text, color text, pay_pct numeric, sort_order int, overlaps_prev boolean)
  where e.id is not null and w.id = e.id and w.project_id = p_project;
  insert into public.tracker_work_types (project_id, code, label, color, pay_pct, sort_order, overlaps_prev)
  select p_project, e.code, e.label, e.color, e.pay_pct, e.sort_order, coalesce(e.overlaps_prev, false)
  from jsonb_to_recordset(p_types) as e(id uuid, code text, label text, color text, pay_pct numeric, sort_order int, overlaps_prev boolean)
  where e.id is null;
  return query select * from public.tracker_work_types where project_id = p_project order by sort_order;
end $$;
