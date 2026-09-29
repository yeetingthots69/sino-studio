# Plan: `/tracker` — internal animator schedule board (v1)

Status: **revision 4 — APPROVED 2026-09-27 (execution via orchestrate-with-subagents, max 3 executors)** (Architect APPROVE · Critic fold-in APPROVE · Codex AGREE WITH CHANGES applied)
Date: 2026-09-27 · Target: working v1 by ~2026-10-04 · Solo dev
Reference: `.omc/drafts/tracker-prototype.png` (Lovable: https://task-trekker-45.lovable.app)

## 1. Requirements summary

Build an internal, auth-gated Gantt-style schedule board at `/[locale]/tracker` that reproduces the Lovable prototype as closely as practical, on Supabase, inside this Next 16 app.

Decided with the user (2026-09-27):
- Per-project boards with a project switcher. Tracked projects are created inside the tracker (NOT the public `PROJECTS` map).
- Staff roster is global, CRUD in the tracker UI, seeded with the 13 animators from the prototype.
- Auth: Google login (Supabase Auth), restricted to `@sinostudio.vn`, plus an allow-list table (`tracker_users`, email + role). Everyone on the list has full edit rights; role stored, not enforced in v1.
- Work types: one global configurable list (table), seeded with `LO`, `GE`, `DO + SH` in prototype colors. "Hoàn thành" is NOT a type: a task is complete when `progress = 100` and renders red.
- Weekends highlighted; tasks may span them.
- Supabase Realtime: changes propagate to other open sessions.
- Dark theme (site theme). Tracker has its own shell: header with logo, project switcher, language toggle, user name + avatar, logout. Public Navbar/Footer/MusicPlayer hidden; ProgressBar kept.
- Bilingual (en/vi) via existing dictionaries.
- Keep `src/utils/supabase/__tests__/proxy.test.ts`: add `vitest`, rewrite for the new rules.
- Deferred: shareable export for members, file attachments (Storage/Drive), role enforcement.

## 2. RALPLAN-DR summary

**Principles**
1. Ship the prototype's UX, not a generic PM tool — one board view, one side panel, plus project/staff management.
2. The database is the security boundary: RLS + CHECK constraints are authoritative; server actions are the convenience layer.
3. Reuse existing app plumbing (locale routing, dictionaries, Mantine theme, copied Supabase clients) — no parallel systems. Copied code that targets the other app (`updateSession`, its test) is rewritten, not patched.
4. No new heavy deps: Gantt is a CSS grid + pointer events; realtime is Supabase's own client.
5. Every mutation is a typed server action validated with zod (supazod-generated schemas) — but drag commits must feel instant (`useOptimistic`).

**Decision drivers (top 3)**
1. One-week delivery by a solo developer.
2. Security correctness of the auth gate (internal data on a public domain).
3. Fidelity to the agreed prototype (managers already signed off on it).

**Options**

A. **Custom CSS-grid Gantt + server actions + Realtime → `router.refresh()`** (chosen)
- Pros: zero new UI deps; drag math ≈100 lines; one data path (server-rendered props); realtime reaction is one line; zod + RLS double validation.
- Cons: each remote event = full RSC refresh (~200–500 ms; fine at 5 users); own writes echo back (debounced); drag vs refresh race needs a `dragging` ref guard.

B. **Gantt / resource-timeline library** (vis-timeline with groups, FullCalendar resource-timeline [paid tier], `@svar/gantt`, `frappe-gantt`, dhtmlx [commercial])
- Pros: drag/resize/zoom for free; vis-timeline's groups model is the closest fit (staff = group).
- Cons: none render the prototype's per-staff-row/month-grid look without heavy CSS override; +100–400 KB; FullCalendar resource views and dhtmlx need licenses; the side panel still has to be written. Rejected on drivers 1 and 3.

C. **Client-only Supabase queries; Realtime payloads merged into a client store**
- Pros: snappiest remote updates; no `actions.ts` for tasks; fewer round-trips.
- Cons: two data paths (initial load + incremental) to keep consistent; DELETE payloads carry only the PK (needs `replica identity full`); validation only in DB. Viable; A is simpler for v1. **Synthesis:** keep A, make drag instant with `useOptimistic` in a transition, debounce the realtime refresh; move to C's payload merge only if measured refresh latency > 1 s.

## 3. Architecture

### 3.1 Routes

```
src/app/[locale]/tracker/
  login/page.tsx              public (proxy lets it through; redirects if already signed in)
  (app)/layout.tsx            GATED: getUser() + tracker_users lookup → NotAuthorized or TrackerShell
  (app)/page.tsx              redirect → newest non-archived project or /tracker/projects
  (app)/projects/page.tsx     projects CRUD
  (app)/staff/page.tsx        staff CRUD
  (app)/work-types/page.tsx   work types CRUD
  (app)/[projectId]/page.tsx  board (?m=YYYY-MM)
  actions.ts                  'use server' mutations
src/app/auth/callback/route.ts   OAuth code exchange (outside [locale])
```

- `login/page.tsx` and `(app)/layout.tsx` both export `metadata.robots = {index:false, follow:false}`.
- `(app)/layout.tsx`: `export const dynamic = 'force-dynamic'`. Loads `getUser()`; queries `tracker_users` by `lower(email)`; if no row → `<NotAuthorized/>` (message + sign-out) and no children rendered. Note: this check runs on server render only; RLS is the real gate (principle 2).
- `[projectId]`: do NOT set `dynamicParams = false`.
- `/auth/callback`: `code` → `exchangeCodeForSession`. If `user.email` does not end with `@sinostudio.vn`: `await supabase.auth.signOut()` first, then redirect to `/${locale}/tracker/login?error=domain`. `next` (decoded) accepted only if it matches `^/(en|vi)/tracker(/|\?|$)`; otherwise default `/${locale}/tracker`. `locale` = locale of validated `next`, else `NEXT_LOCALE` cookie, else `en`.
- `[projectId]/page.tsx`: `z.uuid().safeParse(projectId)` fails, or row missing/archived → `notFound()`.
- Page segments render in parallel with the layout gate; on client navigation a non-allow-listed user can hit a page RSC request — RLS returns 0 rows, pages must handle empty data.
- `signOut` action → `supabase.auth.signOut()` → `redirect('/${locale}/tracker/login')`.

### 3.2 Proxy (`src/proxy.ts` — correct location for Next 16 with `src/`)

1. Non-locale path → locale redirect (existing behaviour).
2. Locale path → `return updateSession(request, locale)`.
3. Matcher: existing exclusions + `auth/` (with slash, so `/authors` is still handled).

`src/utils/supabase/proxy.ts` — full rewrite (`updateSession(request, locale)`):
- `isProtected = /^\/(en|vi)\/tracker(\/|$)/.test(pathname) && !pathname.endsWith('/tracker/login')`.
- Calls `getUser()` only when `isProtected || isLoginPage`. Public site never touches Supabase.
- Unauthenticated + protected → 307 `/${locale}/tracker/login?next=${pathname}${search}`.
- Authenticated + login page → 307 `/${locale}/tracker`.
- Login redirect built with `url.searchParams.set('next', pathname + search)` (never string interpolation).
- Every returned response (next or redirect) sets `NEXT_LOCALE`, copies Supabase cookies, AND applies the `headers` second argument of `setAll(cookiesToSet, headers)` (`@supabase/ssr` 0.12 passes cache-control headers there; the copied file ignores it). Same in `/auth/callback`.

Test (`src/utils/supabase/__tests__/proxy.test.ts`, full rewrite) + `vitest.config.ts` (`resolve.alias '@' → ./src`, `environment: node`) + `"test": "vitest run"`:
1. `/en/about` → no `getUser` call, 200.
2. `/en/tracker` unauthenticated → 307 to `/en/tracker/login?next=/en/tracker`.
3. `/vi/tracker/abc?m=2026-10` unauthenticated → `next` keeps the query string.
4. `/en/tracker/login` authenticated → 307 `/en/tracker`.
5. `/en/tracker` authenticated → 200 with refreshed cookie copied.
6. `NEXT_LOCALE` set on every branch.
Plus one pure-helper test file for the Gantt date math (§3.5).

`vitest` is installed in **step 1** (tsconfig includes the test; `tsc` is red until then).

### 3.3 Database — `supabase/migrations/20260927090805_tracker.sql` + `20260927090827_tracker_users_self_initplan.sql` (applied via MCP `apply_migration`; local files identical to applied)

```sql
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

-- Supabase default privileges grant ALL on new public tables; revoke first so the grants below are exact.
revoke all on public.tracker_users, public.tracker_projects, public.tracker_staff,
  public.tracker_work_types, public.tracker_tasks from anon, authenticated;

-- self-row only; MUST NOT call the helper (recursion). Nobody can write this table through the API.
create policy users_self on public.tracker_users for select to authenticated
  using (email = lower((select auth.jwt())->>'email'));   -- this form avoids the auth_rls_initplan lint
grant select on public.tracker_users to authenticated;

create policy projects_rw   on public.tracker_projects   for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy staff_rw      on public.tracker_staff      for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy work_types_rw on public.tracker_work_types for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
create policy tasks_rw      on public.tracker_tasks      for all to authenticated using ((select public.is_tracker_user())) with check ((select public.is_tracker_user()));
grant select, insert, update, delete on public.tracker_projects, public.tracker_staff,
  public.tracker_work_types, public.tracker_tasks to authenticated;

alter publication supabase_realtime add table public.tracker_tasks;
```

Seed (same migration):
- Work types: `LO` / Layout / `#3b82f6`; `GE` / Genga / `#22c55e`; `DO + SH` / Douga + Shiage / `#eab308`.
- Staff (sort_order 1–13): Hưng Nomi — Toàn năng; Văn Phú — LO, Genga, Douga + Shiage; Minh Tuấn — LO, Genga, Douga + Shiage; Trương Huy — Toàn năng; Banana — Toàn năng; Pha Màu — Toàn năng; Anh Khang — LO, Genga, Douga + Shiage; Thanh Vân — LO; Tôm — LO, Genga, Douga + Shiage; Vũ Thư — Genga, Douga + Shiage, Sakkan; Quân Sliat — LO, Genga, Douga + Shiage; Phước Hưng — Toàn năng; Thiêm — Genga, Douga + Shiage.
- Project: "Demo" (`#e8192c`).
- `tracker_users`: the user's email (lowercase), role `admin` — value supplied at execution.

Overlap query for a month: `.lte('start_date', monthEnd).gte('end_date', monthStart)`.

After migration: MCP `generate_typescript_types` → write `src/types/database.types.ts`; then `npx supazod -i src/types/database.types.ts -o src/schemas/generated/index.ts -s public` (the `gen:types` script needs `supabase login`; not required). Run MCP `get_advisors` (security + performance) and fix any finding.

Archived semantics: archived projects are excluded from the switcher and the `/tracker` redirect; archived staff are shown in a month only if they have tasks in it, and are not offered in the "assignee" select or the "+" button.

### 3.4 Server actions (`src/app/[locale]/tracker/actions.ts`)

All except `signInWithGoogle`: `createClient()` (cookie-bound → RLS applies); `getUser()` guard returning `{ok:false, error:'unauthenticated'}`; zod validation (supazod Insert/Update schemas narrowed: dates `^\d{4}-\d{2}-\d{2}$`, name trimmed); every write uses `.select().single()` so an RLS-filtered 0-row update/delete surfaces as `{ok:false, error:'not_found'}` instead of silent success; `revalidatePath('/[locale]/tracker', 'layout')` on success; return `{ok:true, data?: Row}|{ok:false, error}` (`createTask`/`createProject`/`createStaff`/`createWorkType` return the inserted row so the UI can select it). Concurrency: last write wins (5 users; acceptable).

`createTask`, `updateTask` (partial), `deleteTask`, `createProject`, `updateProject`, `archiveProject`, `createStaff`, `updateStaff`, `archiveStaff`, `createWorkType`, `updateWorkType`, `archiveWorkType`, `signInWithGoogle` (`origin` = `(await headers()).get('origin')` checked against `{'https://sinostudio.vn','http://localhost:3000'}`; `signInWithOAuth({provider:'google', options:{redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams:{hd:'sinostudio.vn', prompt:'select_account'}}})` → `redirect(data.url)`), `signOut`.

All `*_id` inputs validated as `z.uuid()`.

`SUPABASE_SECRET_KEY` / `admin.ts` are not used by v1; the secret is NOT added to Vercel.

### 3.5 UI components (`src/components/tracker/`)

| Component | Notes |
|---|---|
| `TrackerShell` (`'use client'`) | Header: logo → `/tracker`, `ProjectSwitcher` (Mantine `Select`, non-archived), links Projects / Staff, `LanguageSwitcher`, `Avatar` (`user_metadata.avatar_url`) + name, sign-out button. Wraps children in `<DatesProvider settings={{locale}}>` with `import 'dayjs/locale/vi'`. |
| `GanttBoard` | Props: project, month, staff, workTypes, tasks. State: `useOptimistic(tasks, reducer)` for commits (`startTransition(async () => { addOptimistic(patch); await updateTask(patch) })`); `useState` for in-flight drag preview only; `useRef` `dragging` flag. Month nav (`?m=`; invalid → default). Legend (work types + "Hoàn thành" red). CSS grid: sticky left columns STT / NHÂN SỰ / ĐIỂM MẠNH, one column per day (`T2…CN` + day number), weekend columns tinted. **Lanes:** per staff row, greedy lane assignment for overlapping tasks (sort by start; first lane whose last end < start); row height = lanes × bar height. Realtime: one module-level `createClientClient()`; channel on `postgres_changes` for `public.tracker_tasks` with **no filter** (DELETE is not filterable); subscription created in `useEffect` with cleanup (`removeChannel`); on `SUBSCRIBED` after a reconnect → refresh once. Refresh scheduling: `requestRefresh()` sets a 300 ms timer; the timer callback re-checks `dragging.current || panelDirty.current` — if busy it sets `pending = true` and exits; `settle()` (called on pointer-up and after each commit transition resolves) runs the refresh if `pending`. Only tasks are published in v1: project/staff/work-type edits by another user appear on next navigation (documented limitation). |
| `TaskBar` | `grid-column: displayStart / displayEnd+1` where display range = stored range clamped to the month. Drag body = move; drag edge = resize; edges that are clipped by the month bound are NOT handles. Pointer capture; snap to day width; min duration 1 day; `pointercancel` / `lostpointercapture` = abort (drop preview, no commit). Drag baseline = the task's stored dates captured at `pointerdown` (immune to refreshes mid-drag). Commit = day **delta** applied to that baseline (never the clamped values). Progress fill overlay; red when `progress === 100`. Click = select. |
| `TaskPanel` | "CHI TIẾT CÔNG VIỆC". Mounted with `key={task.id}`. **No debounced autosave.** Discrete controls commit immediately on change through the `useOptimistic` transition: work-type chip group, staff `Select`, start/end `DateInput` (`@mantine/dates`, string `YYYY-MM-DD`, `@mantine/dates/styles.css`, `valueFormat="DD/MM/YYYY"`), progress `Slider` via `onChangeEnd`. Name `TextInput` is the only local draft (`useState`, uncontrolled from props): commits on blur / Enter; `panelDirty.current = true` while focused-and-changed, cleared on commit. Action `{ok:false}` → optimistic state reverts automatically; the name draft is kept and the error is shown inline so the user can retry. "Xoá công việc" button. Empty state when nothing selected. Archived work types are not offered in the chip group; tasks that still reference one render with that type's color. |
| `AddTaskButton` | "+" per staff row → creates a 1-day task on the first day of the viewed month with the first work type, selects it. |
| `ProjectsTable`, `StaffTable`, `WorkTypesTable` | Mantine `Table` + modal form (`@mantine/form`); create / edit / archive. Work types page at `(app)/work-types/page.tsx` (code, label, color via `ColorInput`, order). |
| `NotAuthorized` | Message + sign-out. |

Date rules (`src/components/tracker/dates.ts`, pure, unit-tested): all dates are `YYYY-MM-DD` strings; arithmetic via `Date.UTC`/`getUTCDay`; `addDays`, `daysBetween`, `monthRange(m)`, `clampToMonth`, `weekdayLabel` (T2…CN); default month computed server-side with `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'})`.

Styling: CSS Modules, existing dark tokens, Montserrat headings, red accent. Bar colors from `tracker_work_types.color`.

### 3.6 App-level changes

- `MusicPlayer.tsx`: add `const pathname = usePathname()` with the other hooks; `if (/^\/(en|vi)\/tracker(\/|$)/.test(pathname)) return null;` placed **after the last hook**, before the JSX.
- `LanguageSwitcher.tsx`: in `switchLocale` push `newPath + window.location.search` (click-time read; no hook, no Suspense, no SSR change on public pages).
- `robots.ts`: `disallow: ['/en/tracker', '/vi/tracker']`.
- Dictionaries: `tracker` namespace in `en.json` + `vi.json` (vi labels verbatim from prototype: "Lịch sản xuất", "Lịch phân công Animator", the hint sentence, "Tháng trước/sau", "STT", "NHÂN SỰ", "ĐIỂM MẠNH", "CHI TIẾT CÔNG VIỆC", "Tên cắt / công việc", "Loại công việc", "Tiến độ", "Ngày bắt đầu", "Ngày kết thúc", "Nhân sự phụ trách", "Xoá công việc", "Hoàn thành", "Thêm công việc"; plus shell/auth strings incl. `error.domain`, `notAuthorized`, projects/staff forms).
- `package.json`: add `@supabase/supabase-js`, `zod`, `dayjs` (explicit deps); devDeps `vitest`; script `test`.
- Rewritten proxy reuses `LOCALES`/`isValidLocale` from `src/i18n/config.ts`.
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
- `CLAUDE.md`: Tracker section (routes, tables, types regen, proxy, test).

### 3.7 Manual setup (user, outside the repo)

1. Google Cloud Console → OAuth client (Web): authorized redirect URI `https://wsgtdbdtuxlfoueviuup.supabase.co/auth/v1/callback`.
2. Supabase → Auth → Providers: enable **Google** (client ID + secret); **disable Email and Anonymous** providers (otherwise anyone can mint a `@sinostudio.vn` email claim by password sign-up and pass RLS).
3. Supabase → Auth → URL configuration: Site URL `https://sinostudio.vn`; redirect allow-list `http://localhost:3000/auth/callback**` (glob — the callback carries `?next=`; an exact entry silently falls back to the Site URL) and `https://sinostudio.vn/auth/callback**`. **No `*.vercel.app` wildcard** (session-hijack vector); previews are not used for the tracker.
5. Adding tracker users is SQL-only in v1 (`insert into tracker_users (email, role) values ('x@sinostudio.vn','manager')` in Studio) — documented in `CLAUDE.md`.
4. Vercel env vars (above).

## 4. Implementation steps

1. **Schema** — migration via MCP; seed; types + supazod (generated `Database` type is needed by the layout gate in step 2); `get_advisors` clean; `tsc` clean. *Check:* `list_tables` shows 5 tables RLS on; `execute_sql` as `anon` returns 0 rows; as the seeded user returns seed; as a `@sinostudio.vn` email NOT in `tracker_users`: select → 0 rows, insert into `tracker_tasks` → denied, insert into `tracker_users` → denied.
2. **Foundation** — `vitest` + config + test script; proxy merge + `updateSession` rewrite + tests; `auth/callback`; `signInWithGoogle`/`signOut`; `login` page; `(app)/layout.tsx` gate + `NotAuthorized`; `MusicPlayer` + `LanguageSwitcher` changes; robots. *Check:* `npm test` green; `next build` output lists `ƒ Proxy`; `/en/tracker` → 307 login; local Google sign-in round-trip lands back on `http://localhost:3000/en/tracker`; `/en/tracker/login` renders the button when signed out.
3. **Shell + projects + staff + work types** — `TrackerShell`, `ProjectSwitcher`, `/projects`, `/staff`, `/work-types` + actions + dictionaries. *Check:* create/rename/archive project; create/edit/archive staff and work type; language toggle keeps path + query.
4. **Board** — loader, `dates.ts` + tests, `GanttBoard` grid + lanes, month nav, `TaskBar` static render, `AddTaskButton`, `TaskPanel` wired. *Check vs prototype at 1600 px:* 3 sticky columns with same headers; 30 day columns with `T2…CN` + number; weekend tint; bars colored by type with progress fill; red completed bar; side panel field order.
5. **Drag/resize + Realtime** — pointer handlers, delta commits, clipped-edge rule, `useOptimistic`, realtime subscription with guard/debounce. *Check:* two tabs; move/resize/delete in A appears in B ≤ 2 s; drag a task spanning into next month and confirm stored dates shift by the delta only.
6. **Polish + docs** — empty states, inline error text, `CLAUDE.md`, lint/tsc/build/test green, commit.

Execution: `/orchestrate-with-subagents`, max 3 concurrent executors. Steps 1 → 2 sequential (2 needs generated types); step 3's three CRUD pages can run as 3 parallel executors; then 4 → 5 → 6.

## 5. Acceptance criteria

1. `GET /en/tracker` without session → 307 `/en/tracker/login?next=/en/tracker`. With session but email not in `tracker_users` → 200 `NotAuthorized`, no board data in HTML.
2. `npm test` proves `/en/about` never calls `getUser` (test #1) and covers the 5 other proxy branches.
3. Google sign-in with a non-`sinostudio.vn` account lands on `/en/tracker/login?error=domain`; response has no `sb-*` cookie with a non-empty value; a following `GET /en/tracker` → 307 login.
4. `?next=//evil.com` (and `https://…`) on `/auth/callback` redirects to `/en/tracker`, never off-site.
5. `execute_sql`: `set role anon; select count(*) from tracker_tasks` → permission denied (no grant) or 0; with `request.jwt.claims` email of the seeded user → seed rows; with a `@sinostudio.vn` email not in `tracker_users` → 0 rows, `insert into tracker_tasks` denied, `insert into tracker_users` denied (no write grant for anyone).
6. Board at `/en/tracker/<id>?m=2026-09` renders 13 seeded staff rows in seed order, day columns 1–30 with `T3` on the 1st, weekend columns tinted.
7. Create, move, resize (either edge), edit every panel field, delete → persist after hard reload. Typing continuously for 3 s in the name field while tab B edits another task loses no characters.
8. Task with `progress = 100` renders red with legend "Hoàn thành".
9. A change in tab A (including delete) appears in tab B within 2 s.
10. Task spanning 2026-09-28 → 2026-10-03 viewed in September: bar clipped at day 30, right edge not resizable; dragging it +2 days stores 09-30 → 10-05.
11. Two overlapping tasks on one staff row render in separate lanes; both clickable.
12. Language toggle on `/vi/tracker/<id>?m=2026-08` → `/en/tracker/<id>?m=2026-08`, all tracker labels switch.
13. Invalid `?m=abc` → default month (Asia/Ho_Chi_Minh).
14. `npm run lint` has no new errors (pre-existing `LanguageSwitcher` `document.cookie` error excluded), `npx.cmd tsc --noEmit`, `npm test`, `npm run build` pass.
15. `robots.txt` disallows `/en/tracker` and `/vi/tracker`; tracker HTML contains `noindex`.
16. `get_advisors` (security + performance) reports no findings on the 5 tables / functions.
17. `/en/tracker/abc` and `/en/tracker/<archived uuid>` → 404, not 500.
18. Local dev: sign-in started on `http://localhost:3000` returns to localhost with a session (not to production).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Proxy not picked up by Next | Step 1 check: build output lists `ƒ Proxy`. |
| OAuth redirect misconfig (localhost vs prod) | Callback uses `origin` from request; allow-list has exactly the two URLs. |
| `hd` param is only a hint; other providers could mint the email claim | Server-side domain check in callback + allow-list table + Email/Anonymous providers disabled (§3.7.2). |
| Open redirect via `next` | Regex allow-list `^/(en|vi)/tracker(/|$)` (AC4). |
| Drag on clipped tasks corrupts stored dates | Delta-based commits; clipped edges not draggable (AC10); pure `dates.ts` unit-tested. |
| Realtime DELETE not delivered on filtered channel | Unfiltered subscription (AC9). |
| `router.refresh()` clobbers in-progress drag / echoes own writes | `dragging` ref defers refresh; 300 ms debounce. |
| Props-to-state copy anti-pattern under React Compiler | `useOptimistic` for commits, `useState` only for drag preview. |
| UTC vs Vietnam time shifts default month / weekdays | `Asia/Ho_Chi_Minh` for default month; UTC-only date math on strings (AC13). |
| `tsc` red from copied test until vitest installed | vitest in step 1. |
| Supabase advisor flags helper (`search_path`), missing grants | `set search_path=''`, schema-qualified, explicit grants; `get_advisors` in step 2 (AC16). |
| Overlapping tasks unclickable | Lane stacking (AC11). |
| Redirect allow-list rejects callback URL with query string in dev | Glob entries `…/auth/callback**` (AC18). |
| Definer helper / trigger flagged by advisor | Invoker helper + self-row policy; `set search_path=''` on trigger fn; FK indexes (AC16). |
| Panel inputs clobbered by `router.refresh()` | `key={task.id}` + local draft, `panelDirty` defers refresh (AC7). |
| Non-uuid `[projectId]` → Postgres 22P02 → 500 | `z.uuid()` + `notFound()` (AC17). |
| Migration version drift (MCP vs local filename) | After `apply_migration`, `list_migrations` and rename the local file to the returned version. |
| Realtime DELETE events bypass row RLS: a signed-in `@sinostudio.vn` user NOT on the allow-list could subscribe and see deleted task uuids | Accepted residual risk (uuids only, domain-restricted audience). Upgrade path: soft-delete via `archived_at` UPDATE. |
| Cache headers from `setAll(_, headers)` dropped on redirects | Explicitly applied in proxy + callback (§3.2). |

## 7a. ADR

- **Decision:** Build the tracker inside this repo as `/[locale]/tracker` using Option A — server-rendered pages + zod-validated server actions + Supabase RLS, custom CSS-grid Gantt with pointer drag and `useOptimistic`, Supabase Realtime (tasks only) triggering a guarded `router.refresh()`. Google OAuth (Workspace domain) + `tracker_users` allow-list; Email/Anonymous providers disabled.
- **Drivers:** 1-week solo delivery; auth-gate correctness on a public domain; fidelity to the signed-off Lovable prototype.
- **Alternatives considered:** B — Gantt/resource-timeline libraries (vis-timeline, FullCalendar resource, svar, frappe, dhtmlx): rejected for look mismatch, bundle size, licenses. C — client-only queries with realtime payload merging: viable, deferred; adopt only if measured refresh latency > 1 s.
- **Why chosen:** one data path, zero new UI deps, DB as the single security boundary, smallest diff that still meets prototype behaviour.
- **Consequences:** every remote change costs one RSC refresh (fine at 5 users); own writes echo (debounced); project/staff/type changes by others appear on next navigation; `tracker_users` is SQL-managed; no previews on `*.vercel.app`.
- **Follow-ups (post-v1):** shareable member export; Supabase Storage/Drive attachments; role enforcement; admin UI for `tracker_users` (needs a definer helper in a private schema); soft-delete if DELETE-event exposure matters; realtime for other tables.

## 7. Resolved at draft gate (2026-09-27)

1. Keep `proxy.test.ts`: add `vitest` + `test` script; full rewrite.
2. Work types: one global list.
3. First admin email: supplied at execution (step 2 seed).

## 8. Verification

- Each step ends with its *Check*.
- Final: AC 1–16 walked manually in Chrome (devtools MCP) + `execute_sql` for RLS; screenshot board next to `.omc/drafts/tracker-prototype.png`.

## 9. Changelog

- E2E + perf pass (2026-09-27): full E2E 21/22 then fixes (slider focus, single scrollbar, 375px header, 404 titles/pages, ColorSchemeScript removed → static `data-mantine-color-scheme="dark"` + `forceColorScheme`, footer "Staff portal" link, global-not-found behind `experimental.globalNotFound`). Perf: task actions no longer re-render (`writeRow` `{revalidate:'none'}`, others use `refresh()`); proxy skips `getUser` on server-action POSTs (action authenticates itself); `NEXT_LOCALE` only set when changed (was invalidating router cache after every action); parallel loaders; **realtime switched to Option C** (apply payloads to client state; refresh only on reconnect / unusable payload) — measured page-2 latency ≈ POST time + 50–300 ms, 0 requests on observer; realtime socket now `setAuth(session.access_token)` before join (was anonymous → 401 payloads). Cache Components evaluated and rejected (per-user RLS data; would need admin client). `getClaims` rejected by user. Open: Vercel function region should be `sin1` (Supabase ap-southeast-1); `notFound()` 404s inside `[locale]` are client-rendered (SEO-only).

- exec steps 2–6 (2026-09-27): all built and reviewed (fresh-context reviewers PASS after fixes). Extra migration `20260927093702_revoke_helper_execute`. Deviations accepted: vitest@4 (v5 needs @types/node ≥22); `panelDirtyRef` naming (React Compiler lint); no "Hoàn thành" chip (derived from progress); realtime channel topic per mount; burger nav below 1024px; `LanguageSwitcher` cookie write moved to module helper (pre-existing lint error). Backlog: `ProjectSwitcher` width breakpoint `lg` (1200px) ≠ 1024px; explicit `grant execute … to authenticated` on helper; `tmp-` id uses timestamp; default task name `'C?'` hardcoded. **E2E pending** — brief at `.omc/drafts/e2e-brief.md`; requires Google provider setup (§3.7).

- exec step 1 (2026-09-27): applied migrations `20260927090805_tracker` + `20260927090827_tracker_users_self_initplan`; advisors clean; RLS proven (AC5). §3.3 amended (revoke defaults, initplan form).

- r4 (Codex second opinion, AGREE WITH CHANGES — accepted): executable RLS/policy SQL, `tracker_users` SELECT-only grant; `signInWithGoogle` exempt from auth guard; `searchParams.set('next')`; `setAll` headers preserved; `.select().single()` on writes + create actions return rows; write-denial checks in AC5; refresh scheduler re-checks busy flags and flushes on settle; drag baseline at pointerdown, pointercancel abort, 1-day min; panel autosave replaced by commit-on-change/blur; work-types CRUD page + archive rules; schema before foundation. Declined: realtime for non-task tables (next-navigation is enough at 5 users); soft-delete (residual risk documented). ADR added.
- r3 (iteration 2: Architect APPROVE with amendments; Critic REVISE → fold-in, no further round): invoker helper + self-row policy, trigger fn with `search_path`, FK indexes, explicit table grants; callback glob allow-list + `encodeURIComponent(next)` + origin allow-set; uuid validation + 404; TaskPanel local draft + `panelDirty`; LanguageSwitcher via `window.location.search`; dayjs vi locale + DatesProvider; 302→307; AC3 reworded; AC17–18; new risk rows.
- r2 (after Architect + Critic): login moved out of gated layout via `(app)` route group; unfiltered realtime (DELETE); delta-based drag with clipped-edge rule + lanes; `next` validation + callback locale source; Email/Anonymous providers disabled, no `*.vercel.app` redirect, lowercase emails, hardened `is_tracker_user()`, explicit grants, advisors check; `useOptimistic` state model; `revalidatePath(...,'layout')`; `LanguageSwitcher` keeps query; MusicPlayer hook-order fix; vitest config + cases specified and moved to step 1; date/timezone rules; archived semantics; seed data inline; secret key dropped from Vercel; B alternatives named; AC list expanded to 16.
