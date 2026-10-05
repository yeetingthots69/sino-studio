-- tracker v2.7b: tracker_set_member_departments gains p_mode (review fix).
--   'add' = union: staff gain the departments, nothing is removed (add members dialog);
--   'set' = exact replace, and every staff must already be a member, so an edit saved after the person was
--           removed in another tab fails with staff_not_member instead of silently re-adding them.
-- The archived rule is unchanged and checked first in both modes (an archived non-member → staff_archived).

drop function public.tracker_set_member_departments(uuid, uuid[], uuid[]);

create function public.tracker_set_member_departments(
  p_project uuid, p_staff uuid[], p_departments uuid[], p_mode text default 'set'
)
returns setof public.tracker_member_departments
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  if coalesce(cardinality(p_staff), 0) = 0 or coalesce(cardinality(p_departments), 0) = 0
     or array_position(p_staff, null) is not null or array_position(p_departments, null) is not null
     or p_mode is null or p_mode not in ('set', 'add') then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  -- an archived staff cannot become a member; an archived existing member can still be edited
  if exists (select 1 from unnest(p_staff) s(id)
             join public.tracker_staff st on st.id = s.id
             where st.archived_at is not null
               and not exists (select 1 from public.tracker_member_departments m
                               where m.project_id = p_project and m.staff_id = s.id)) then
    raise exception using errcode = 'P0001', message = 'staff_archived';
  end if;
  if p_mode = 'set' then
    if exists (select 1 from unnest(p_staff) s(id)
               where not exists (select 1 from public.tracker_member_departments m
                                 where m.project_id = p_project and m.staff_id = s.id)) then
      raise exception using errcode = 'P0001', message = 'staff_not_member';
    end if;
    delete from public.tracker_member_departments m
    where m.project_id = p_project and m.staff_id = any(p_staff) and m.department_id <> all(p_departments);
  end if;
  -- a department of another project fails the composite FK (23503)
  insert into public.tracker_member_departments (project_id, staff_id, department_id)
  select p_project, s.id, d.id
  from unnest(p_staff) s(id) cross join unnest(p_departments) d(id)
  on conflict (project_id, staff_id, department_id) do nothing;
  return query
    select * from public.tracker_member_departments m
    where m.project_id = p_project and m.staff_id = any(p_staff)
    order by m.id;
end $$;

revoke execute on function public.tracker_set_member_departments(uuid, uuid[], uuid[], text) from public, anon;
grant execute on function public.tracker_set_member_departments(uuid, uuid[], uuid[], text) to authenticated;
