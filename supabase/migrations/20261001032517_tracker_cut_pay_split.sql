-- Pay split per cut: null = the project's default work-type pay_pct; otherwise {work_type_id: pct}.
-- Types the split omits get 0. Checked on write only: a type deleted later leaves a harmless stale key
-- (a deleted type has no tasks, so nothing is paid from it).
alter table public.tracker_cuts
  add column pay_split jsonb check (pay_split is null or jsonb_typeof(pay_split) = 'object');

create function private.tracker_cut_split() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_bad int;
  v_sum numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
  select count(*) filter (where s.pct is null or s.pct not between 0 and 100 or s.pct <> round(s.pct, 2)
                            or not exists (select 1 from public.tracker_work_types w
                                           where w.project_id = new.project_id and w.id::text = s.key)),
         coalesce(sum(s.pct), 0)
  into v_bad, v_sum
  from (select e.key, case when jsonb_typeof(e.value) = 'number' then e.value::numeric end as pct
        from jsonb_each(new.pay_split) e) s;
  if v_bad > 0 or v_sum <> 100 then
    raise exception using errcode = 'P0001', message = 'pct_total';
  end if;
  return new;
end $$;
revoke execute on function private.tracker_cut_split() from public, anon, authenticated;
create trigger tracker_cut_split before insert or update of pay_split on public.tracker_cuts
  for each row when (new.pay_split is not null) execute function private.tracker_cut_split();
