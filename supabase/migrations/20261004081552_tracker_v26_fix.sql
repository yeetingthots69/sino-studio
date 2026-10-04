-- tracker v2.6: fix tasks (plan .omc/plans/tracker-v2.6-fix.md §3.1)
-- A fix task (is_fix) aids/fixes an existing stage of a cut: same cut + type as a non-fix task,
-- exempt from the one-task-per-cut-and-type rule and from the pipeline order rule.

-- M1
alter table public.tracker_tasks add column is_fix boolean not null default false;

-- M2. one task per cut + type now counts only non-fix tasks (same name, 23505 mapping unchanged)
alter table public.tracker_tasks drop constraint tracker_tasks_cut_type_key;
create unique index tracker_tasks_cut_type_key on public.tracker_tasks (cut_id, work_type_id) where not is_fix;

-- M3. pipeline order rule: is_fix is immutable, a fix needs its stage and skips the order check,
-- stage tasks ignore fixes in the conflict search
CREATE OR REPLACE FUNCTION private.tracker_task_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  where t.cut_id = new.cut_id and t.id <> new.id and not t.is_fix and (
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
end $function$;

-- M4. type order re-check ignores fixes on both sides
CREATE OR REPLACE FUNCTION private.tracker_type_order_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
end $function$;

-- M5. create task: optional trailing p_is_fix (old 7-arg overload dropped)
drop function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint);

CREATE OR REPLACE FUNCTION public.tracker_create_task(p_project uuid, p_staff uuid, p_type uuid, p_cut_code text, p_start date, p_end date, p_budget bigint DEFAULT NULL::bigint, p_is_fix boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_code text := public.tracker_normalize_cut(p_cut_code);
  v_cut public.tracker_cuts;
  v_task public.tracker_tasks;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  insert into public.tracker_cuts (project_id, code, budget)
  values (p_project, v_code, coalesce(p_budget, 0))
  on conflict (project_id, code) do nothing;
  select * into v_cut from public.tracker_cuts where project_id = p_project and code = v_code;
  insert into public.tracker_tasks (project_id, staff_id, work_type_id, cut_id, start_date, end_date, is_fix)
  values (p_project, p_staff, p_type, v_cut.id, p_start, p_end, p_is_fix)
  returning * into v_task;
  return jsonb_build_object('task', to_jsonb(v_task), 'cut', to_jsonb(v_cut));
end $function$;

revoke execute on function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean) from anon, public;
grant execute on function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint, boolean) to authenticated;

-- M6. removed-task snapshot carries is_fix
CREATE OR REPLACE FUNCTION private.tracker_enqueue_notice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_snap jsonb;
begin
  insert into public.tracker_notice_queue (staff_id, task_ids, due_at)
  values (new.staff_id, array[new.id], now() + interval '10 minutes')
  on conflict (staff_id) do update set
    due_at = excluded.due_at,
    generation = public.tracker_notice_queue.generation + 1,
    task_ids = (select array_agg(distinct x) from unnest(public.tracker_notice_queue.task_ids || new.id) x),
    claimed_until = null;
  if tg_op = 'UPDATE' and old.staff_id is distinct from new.staff_id then
    v_snap := jsonb_build_object(
      'task_id', old.id,
      'project_name', (select name from public.tracker_projects where id = old.project_id),
      'cut_code', (select code from public.tracker_cuts where id = old.cut_id),
      'type_code', (select code from public.tracker_work_types where id = old.work_type_id),
      'type_label', (select label from public.tracker_work_types where id = old.work_type_id),
      'start_date', old.start_date,
      'end_date', old.end_date,
      'is_fix', old.is_fix);
    insert into public.tracker_notice_queue (staff_id, task_ids, removed, due_at)
    values (old.staff_id, '{}', jsonb_build_array(v_snap), now() + interval '10 minutes')
    on conflict (staff_id) do update set
      due_at = excluded.due_at,
      generation = public.tracker_notice_queue.generation + 1,
      removed = public.tracker_notice_queue.removed || excluded.removed,
      claimed_until = null;
  end if;
  return null;
end $function$;
