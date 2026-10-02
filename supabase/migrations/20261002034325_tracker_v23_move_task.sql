-- tracker v2.3: move a task to another person (+ optional adjustment transfer) and tell the old assignee.

-- 1. queue: snapshots of tasks moved away from this staff in the current cycle
alter table public.tracker_notice_queue add column removed jsonb not null default '[]';

-- 2. enqueue: unchanged for the new assignee; on a reassignment the old assignee is queued too, with a snapshot
create or replace function private.tracker_enqueue_notice() returns trigger
language plpgsql security definer set search_path = '' as $$
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
      'end_date', old.end_date);
    insert into public.tracker_notice_queue (staff_id, task_ids, removed, due_at)
    values (old.staff_id, '{}', jsonb_build_array(v_snap), now() + interval '10 minutes')
    on conflict (staff_id) do update set
      due_at = excluded.due_at,
      generation = public.tracker_notice_queue.generation + 1,
      removed = public.tracker_notice_queue.removed || excluded.removed,
      claimed_until = null;
  end if;
  return null;
end $$;
revoke execute on function private.tracker_enqueue_notice() from public, anon, authenticated;

-- 3. move RPC: versioned reassignment + date change; optionally moves the old person's open adjustments
--    for this stage (reversal for the old staff + copy for the new staff, one batch = p_op).
--    Empty result = version conflict or task gone (nothing written).
create function public.tracker_move_task(p_task uuid, p_expected_version int, p_staff uuid, p_start date, p_end date,
                                         p_move_adjustments boolean, p_op uuid, p_reason text)
returns setof public.tracker_tasks
language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.tracker_tasks;
  v_task public.tracker_tasks;
  v_count int;
  v_inserted int;
begin
  select * into v_old from public.tracker_tasks where id = p_task;   -- no row lock (lock order: advisory first)
  if not found then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_old.project_id::text, 0));
  if not exists (select 1 from public.tracker_staff where id = p_staff and archived_at is null) then
    raise exception using errcode = 'P0001', message = 'staff_archived';
  end if;
  update public.tracker_tasks set staff_id = p_staff, start_date = p_start, end_date = p_end
  where id = p_task and version = p_expected_version
  returning * into v_task;
  if not found then
    return;
  end if;
  -- staff/cut/type from the updated row's predecessor; v_old is current because the version matched
  if p_move_adjustments and v_old.staff_id is distinct from p_staff then
    select count(*) into v_count
    from public.tracker_pay_adjustments a
    where a.project_id = v_old.project_id and a.cut_id = v_old.cut_id and a.work_type_id = v_old.work_type_id
      and a.staff_id = v_old.staff_id and a.reverses_id is null
      and not exists (select 1 from public.tracker_pay_adjustments r where r.reverses_id = a.id);
    if v_count > 0 then
      insert into public.tracker_adjustment_batches (id, project_id, reason)
      values (p_op, v_old.project_id, p_reason)
      on conflict (id) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 0 then
        raise exception using errcode = 'P0001', message = 'adjustment_invalid';
      end if;
      insert into public.tracker_pay_adjustments
        (batch_id, project_id, cut_id, work_type_id, staff_id, amount, reason, reverses_id)
      select p_op, a.project_id, a.cut_id, a.work_type_id, m.staff_id, m.amount, m.reason, m.reverses_id
      from public.tracker_pay_adjustments a
      cross join lateral (values
        (a.staff_id, -a.amount, p_reason, a.id),        -- reversal for the old staff
        (p_staff, a.amount, a.reason, null::uuid)       -- copy for the new staff
      ) as m(staff_id, amount, reason, reverses_id)
      where a.project_id = v_old.project_id and a.cut_id = v_old.cut_id and a.work_type_id = v_old.work_type_id
        and a.staff_id = v_old.staff_id and a.reverses_id is null
        and not exists (select 1 from public.tracker_pay_adjustments r where r.reverses_id = a.id);
    end if;
  end if;
  return next v_task;
end $$;

revoke execute on function public.tracker_move_task(uuid, int, uuid, date, date, boolean, uuid, text) from anon, public;
grant execute on function public.tracker_move_task(uuid, int, uuid, date, date, boolean, uuid, text) to authenticated;
