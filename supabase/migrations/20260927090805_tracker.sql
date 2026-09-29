create table public.tracker_users (
  email text primary key check (email = lower(email)),
  role text not null default 'manager' check (role in ('admin','manager')),
  display_name text,
  created_at timestamptz not null default now()
);
create table public.tracker_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#e8192c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.tracker_staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  strengths text not null default '',
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.tracker_work_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  archived_at timestamptz
);
create table public.tracker_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  staff_id uuid not null references public.tracker_staff(id) on delete restrict,
  work_type_id uuid not null references public.tracker_work_types(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  progress int not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.tracker_tasks (project_id, start_date, end_date);
create index on public.tracker_tasks (staff_id);
create index on public.tracker_tasks (work_type_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_upd before update on public.tracker_projects for each row execute function public.set_updated_at();
create trigger t_upd before update on public.tracker_tasks    for each row execute function public.set_updated_at();

-- RLS helper: SECURITY INVOKER (a definer in the exposed schema trips the advisor);
-- it only reads the caller's own tracker_users row, allowed by the self-row policy below.
create function public.is_tracker_user() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.tracker_users
                 where email = lower(auth.jwt()->>'email'));
$$;
alter table public.tracker_users      enable row level security;
alter table public.tracker_projects   enable row level security;
alter table public.tracker_staff      enable row level security;
alter table public.tracker_work_types enable row level security;
alter table public.tracker_tasks      enable row level security;

-- Supabase default privileges grant ALL on new public tables to anon/authenticated;
-- strip them so the grants below are the only ones.
revoke all on public.tracker_users, public.tracker_projects, public.tracker_staff,
  public.tracker_work_types, public.tracker_tasks from anon, authenticated;

-- self-row only; MUST NOT call the helper (recursion). Nobody can write this table through the API.
create policy users_self on public.tracker_users for select to authenticated
  using (email = lower((select auth.jwt()->>'email')));
grant select on public.tracker_users to authenticated;

create policy projects_rw   on public.tracker_projects   for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy staff_rw      on public.tracker_staff      for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy work_types_rw on public.tracker_work_types for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy tasks_rw      on public.tracker_tasks      for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
grant select, insert, update, delete on public.tracker_projects, public.tracker_staff,
  public.tracker_work_types, public.tracker_tasks to authenticated;

alter publication supabase_realtime add table public.tracker_tasks;

-- Seed
insert into public.tracker_work_types (code, label, color, sort_order) values
  ('LO', 'Layout', '#3b82f6', 1),
  ('GE', 'Genga', '#22c55e', 2),
  ('DO + SH', 'Douga + Shiage', '#eab308', 3);

insert into public.tracker_staff (name, strengths, sort_order) values
  ('Hưng Nomi', 'Toàn năng', 1),
  ('Văn Phú', 'LO, Genga, Douga + Shiage', 2),
  ('Minh Tuấn', 'LO, Genga, Douga + Shiage', 3),
  ('Trương Huy', 'Toàn năng', 4),
  ('Banana', 'Toàn năng', 5),
  ('Pha Màu', 'Toàn năng', 6),
  ('Anh Khang', 'LO, Genga, Douga + Shiage', 7),
  ('Thanh Vân', 'LO', 8),
  ('Tôm', 'LO, Genga, Douga + Shiage', 9),
  ('Vũ Thư', 'Genga, Douga + Shiage, Sakkan', 10),
  ('Quân Sliat', 'LO, Genga, Douga + Shiage', 11),
  ('Phước Hưng', 'Toàn năng', 12),
  ('Thiêm', 'Genga, Douga + Shiage', 13);

insert into public.tracker_projects (name, color) values ('Demo', '#e8192c');

insert into public.tracker_users (email, role, display_name) values
  ('contact@sinostudio.vn', 'admin', 'Sino Studio');
