-- tracker v2.7: project departments + members (plan .omc/plans/tracker-v2.7-members.md §3.1)
-- A member of a project is a staff with >= 1 row in tracker_member_departments.
-- New task writes (insert, staff change) require the staff to be a member (trigger tracker_task_member).

-- 1. tables
create table public.tracker_departments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#868e96' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (project_id, id)                                   -- target of the composite FK below
);
create unique index tracker_departments_name_key on public.tracker_departments (project_id, lower(btrim(name)));

create table public.tracker_member_departments (
  id bigint generated always as identity primary key,      -- surrogate for keyset paging (selectAll)
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  staff_id uuid not null references public.tracker_staff(id) on delete cascade,
  department_id uuid not null,
  created_at timestamptz not null default now(),
  unique (project_id, staff_id, department_id),
  -- NO ACTION: deleting a department that still has members fails with 23503 (D11)
  foreign key (project_id, department_id) references public.tracker_departments(project_id, id)
);
create index on public.tracker_member_departments (project_id, department_id);   -- covers the composite FK
create index on public.tracker_member_departments (staff_id);

-- 2. RLS + grants (Supabase default privileges grant ALL to anon/authenticated; strip them first)
alter table public.tracker_departments enable row level security;
alter table public.tracker_member_departments enable row level security;

revoke all on public.tracker_departments, public.tracker_member_departments from public, anon, authenticated;
revoke all on sequence public.tracker_member_departments_id_seq from public, anon, authenticated;

create policy departments_rw on public.tracker_departments for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy member_departments_rw on public.tracker_member_departments for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));

grant select, insert, delete on public.tracker_departments to authenticated;
grant update (name, color, sort_order) on public.tracker_departments to authenticated;   -- project_id immutable
grant select, insert, delete on public.tracker_member_departments to authenticated;     -- no update: insert/delete only
grant usage on sequence public.tracker_member_departments_id_seq to authenticated;     -- identity nextval on insert

-- 3. realtime
alter publication supabase_realtime add table public.tracker_departments, public.tracker_member_departments;

-- 4. backfill (D6): per project with tasks, department 'Chung' holding every task owner.
--    Lock task writes until commit so no owner can appear between this read and the trigger install.
lock table public.tracker_tasks in share row exclusive mode;

insert into public.tracker_departments (project_id, name, color, sort_order)
select distinct t.project_id, 'Chung', '#868e96', 10
from public.tracker_tasks t;

insert into public.tracker_member_departments (project_id, staff_id, department_id)
select distinct t.project_id, t.staff_id, d.id
from public.tracker_tasks t
join public.tracker_departments d on d.project_id = t.project_id and d.name = 'Chung';

-- 5. membership trigger: a new task, or a staff change, needs a member (D4); other edits never check
create function private.tracker_task_member() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.staff_id is distinct from old.staff_id then
    perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));
    if not exists (select 1 from public.tracker_member_departments m
                   where m.project_id = new.project_id and m.staff_id = new.staff_id) then
      raise exception using errcode = 'P0001', message = 'staff_not_member';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.tracker_task_member() from public, anon, authenticated;

create trigger tracker_task_member before insert or update of staff_id on public.tracker_tasks
for each row execute function private.tracker_task_member();

-- 6. RPCs
-- set the department set of one or many staff (add members / edit member); removal is tracker_remove_member
create function public.tracker_set_member_departments(p_project uuid, p_staff uuid[], p_departments uuid[])
returns setof public.tracker_member_departments
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  if coalesce(cardinality(p_staff), 0) = 0 or coalesce(cardinality(p_departments), 0) = 0
     or array_position(p_staff, null) is not null or array_position(p_departments, null) is not null then
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
  delete from public.tracker_member_departments m
  where m.project_id = p_project and m.staff_id = any(p_staff) and m.department_id <> all(p_departments);
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

-- remove a staff from a project (all their department rows); their tasks stay (D5)
create function public.tracker_remove_member(p_project uuid, p_staff uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project::text, 0));
  delete from public.tracker_member_departments where project_id = p_project and staff_id = p_staff;
  get diagnostics v_n = row_count;
  return jsonb_build_object('removed', v_n);
end $$;

-- copy members (additive): departments matched by name or created, non-archived staff only
create function public.tracker_copy_members(p_from uuid, p_to uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_src record;
  v_dept uuid;
  v_n int;
  v_added int := 0;
begin
  if p_from is null or p_to is null or p_from = p_to then
    raise exception using errcode = 'P0001', message = 'invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_to::text, 0));
  for v_src in
    select d.id, d.name, d.color
    from public.tracker_departments d
    where d.project_id = p_from
      and exists (select 1 from public.tracker_member_departments m
                  join public.tracker_staff st on st.id = m.staff_id
                  where m.department_id = d.id and st.archived_at is null)   -- no empty departments
    order by d.sort_order, d.name
  loop
    select d.id into v_dept
    from public.tracker_departments d
    where d.project_id = p_to and lower(btrim(d.name)) = lower(btrim(v_src.name));
    if not found then
      insert into public.tracker_departments (project_id, name, color, sort_order)
      values (p_to, v_src.name, v_src.color,
              (select coalesce(max(d.sort_order), 0) + 10 from public.tracker_departments d where d.project_id = p_to))
      returning id into v_dept;
    end if;
    insert into public.tracker_member_departments (project_id, staff_id, department_id)
    select p_to, m.staff_id, v_dept
    from public.tracker_member_departments m
    join public.tracker_staff st on st.id = m.staff_id
    where m.department_id = v_src.id and st.archived_at is null
    on conflict (project_id, staff_id, department_id) do nothing;
    get diagnostics v_n = row_count;
    v_added := v_added + v_n;
  end loop;
  return jsonb_build_object('added', v_added);
end $$;

revoke execute on function public.tracker_set_member_departments(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.tracker_set_member_departments(uuid, uuid[], uuid[]) to authenticated;
revoke execute on function public.tracker_remove_member(uuid, uuid) from public, anon;
grant execute on function public.tracker_remove_member(uuid, uuid) to authenticated;
revoke execute on function public.tracker_copy_members(uuid, uuid) from public, anon;
grant execute on function public.tracker_copy_members(uuid, uuid) to authenticated;
