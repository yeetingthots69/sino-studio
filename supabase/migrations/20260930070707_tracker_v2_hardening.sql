-- tracker_v2 review follow-ups (row 1.1)

-- 1. tracker_cuts.project_id is immutable (same rule as tasks / work types)
create function private.tracker_cut_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.project_id is distinct from old.project_id then
    raise exception using errcode = 'P0001', message = 'project_immutable';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_cut_guard() from public, anon, authenticated;
create trigger tracker_cut_guard before update on public.tracker_cuts
  for each row execute function private.tracker_cut_guard();

-- 2. code swaps inside tracker_save_work_types: unique (project_id, code) checked at commit
--    (no ON CONFLICT uses it as an arbiter)
alter table public.tracker_work_types
  drop constraint tracker_work_types_project_code_key,
  add constraint tracker_work_types_project_code_key unique (project_id, code) deferrable initially deferred;

-- 3. a retried op_id must belong to the same project
create or replace function public.tracker_add_adjustments(p_batch uuid, p_project uuid, p_reason text, p_entries jsonb)
returns setof public.tracker_pay_adjustments
language plpgsql security invoker set search_path = '' as $$
declare
  v_inserted int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  insert into public.tracker_adjustment_batches (id, project_id, reason)
  values (p_batch, p_project, p_reason)
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    if (select project_id from public.tracker_adjustment_batches where id = p_batch) is distinct from p_project then
      raise exception using errcode = 'P0001', message = 'adjustment_invalid';
    end if;
    return query select * from public.tracker_pay_adjustments where batch_id = p_batch order by created_at, id;
    return;
  end if;
  return query
  with ins as (
    insert into public.tracker_pay_adjustments
      (batch_id, project_id, cut_id, work_type_id, staff_id, amount, reason, reverses_id)
    select p_batch, p_project, e.cut_id, e.work_type_id, e.staff_id, e.amount,
           coalesce(e.reason, p_reason), e.reverses_id
    from jsonb_to_recordset(p_entries)
      as e(cut_id uuid, work_type_id uuid, staff_id uuid, amount bigint, reason text, reverses_id uuid)
    returning *
  )
  select * from ins;
end $$;

-- 4. users finalise only their own manual sends (the worker uses the service role, which bypasses RLS)
alter policy email_log_update on public.tracker_email_log
  using ((select public.is_tracker_user()) and created_by = lower((select auth.jwt()) ->> 'email'))
  with check ((select public.is_tracker_user()) and created_by = lower((select auth.jwt()) ->> 'email'));
