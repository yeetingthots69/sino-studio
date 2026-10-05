# Tracker v2.7: project departments, members, board filters, task list

Status: **DONE 2026-10-05.** Built, reviewed and E2E-verified (`.omc/e2e/v2.7/e2e-v2.7-results.md`); migrations `20261005070024_tracker_v27_members` + `20261005072447_tracker_v27b_member_mode` (review fix: p_mode set|add) applied live with owner OK; uncommitted. r3 approved by the owner; Architect + fable-critic + Codex rounds 1–2 merged (review log `.omc/drafts/tracker-v2.7-review-r1.md`); pending approval.** Consensus planning (`/plan --consensus --interactive`). Owner answers: `.omc/drafts/tracker-v2.7-decisions.md` (decision page https://claude.ai/artifact/VnMib6viVKgs6cD9EZFHje). Execution after approval runs through `/orchestrate-with-subagents`, at most 3 subagents at a time. No git writes: the owner commits. One migration; applied live only with the owner's OK (Gate A), by the main session (subagents get `apply_migration` denied).

Paths: `TR/` = `src/components/tracker/`, `GB/` = `TR/GanttBoard/`, `CV/` = `TR/CutsView/`, `PID/` = `src/app/[locale]/tracker/(app)/[projectId]/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `V1` = `supabase/migrations/20260927090805_tracker.sql`, `V23` = `…/20261002034325_tracker_v23_move_task.sql`, `V26` = `…/20261004081552_tracker_v26_fix.sql`, `DICT` = `src/i18n/dictionaries/{en,vi}.json`.

---

## 1. Requirements summary

**Owner request (2026-10-05).**
1. Admins/managers add **departments** per project and **assign staff** to a project; every assigned staff is in at least one department. A place to view and edit all members of a project.
2. Board (timetable) filters by **staff name** and **department**, combinable with the existing **strengths** filter.
3. (S1) A new in-project **task list** view, laid out like the Cut page: filters staff, work type (default all), cut (default all); a table below with cut code, work type, staff name, date range (start – deadline), progress.
4. Rename the "Nhân sự" tab (earnings) to "Thu nhập" / English "Earnings".

**Owner decisions** (D1–D14):

| # | Answer |
|---|--------|
| D1 | A staff can be in **one or more** departments of a project. |
| D2 | Departments are a **free list per project** (name + colour), not tied to work types. |
| D3 | Board rows: **members only, plus non-members who own a task in the loaded month** (greyed, not drop targets). |
| D4 | **DB enforces membership for new writes**: creating a task, or changing a task's staff (move / reassign / undo), to a non-member is refused. Existing tasks stay valid. |
| D5 | Removing a member who owns tasks is **allowed**; tasks stay. |
| D6 | Migration backfill: per project with tasks, department **"Chung"** holding every staff who owns a task there. |
| D7 | New in-project tab **"Thành viên"** (departments + member table; add several at once, edit, remove). Rename "Nhân sự" → "Thu nhập" (en "People" → "Earnings"). |
| D8 | No row grouping; **department tags beside the staff name**. |
| D9 | Filters combine **name AND department AND strength** (any-of inside department and strength); department + strength filters **saved per project**; name search **not saved**; name match **ignores diacritics** ("tuan" finds "Tuấn"). |
| D10 | Task pickers: members only. Share modal: members first, others below. Bonus/penalty pickers: anyone. |
| D11 | A department can be deleted **only when it has no members**. |
| D12 | Admins and managers have the same rights (role stays unused). |
| D13 | New projects start with no members; a **"Copy members from project…"** action exists. |
| D14 | Share page / PNG / ICS / emails unchanged. |

**Orchestrator decisions for S1** (owner may override at the draft gate):
- S1-a Route `PID/tasks`, tab key `tasks`, labels en "Tasks" / vi "Công việc". Tab order: Lịch | Cut | Công việc | Thành viên | Thu nhập.
- S1-b All three filters are multi-selects; empty = all. Staff options = every staff who owns a task in the project (members or not, archived marked). Filter state is in-component only (no URL, no storage).
- S1-c Includes fix tasks, labelled "LO · Fix" (same label rule as the board). Sort: cut code natural (`compareCutCodes`), then work type `sort_order`, stage before fix, then `start_date`, then id.
- S1-d Date range shown as `dd/mm/yyyy – dd/mm/yyyy` (tasks can span years); progress as a thin bar + "NN%". A count line "N tasks" above the table. Read-only; no row actions.

**Current state (evidence, from fact passes):**
- RLS: mutable configuration tables (staff, tasks, strengths, …) have one `FOR ALL to authenticated using/with check ((select public.is_tracker_user()))` policy (V1:55, :77, :79); specialised policies exist for `tracker_users` (self-select, V1:71-74), append-only adjustments (V2:630-634), email log (hardening:54-57) and the notice queue — all preserved. No per-project scoping. Supabase default ACL grants ALL/EXECUTE to `anon`; every migration revokes first (V1:66-69, V26:136-137). `tracker_users.role` is never read except in `(app)/layout.tsx:23`.
- No helper for the advisory lock: rule triggers/RPCs call `pg_advisory_xact_lock(hashtextextended(<project_id>::text, 0))` inline.
- `tracker_create_task` (V26:115-135) has **no staff check**; `tracker_move_task` checks `staff_archived` (V23:56-59).
- Realtime publication: 9 tables listed in CLAUDE.md (live-verified).
- Audit triggers only on cuts, tasks, work types, pay adjustments.
- Board page `PID/page.tsx:31-62` loads all staff, strengths, staff_strengths, cuts, month tasks, shares; staff passed = non-archived ∪ archived owning a task in the month (`:49-52`). Rows: `GB/GanttBoard.tsx:296` `rows = viewStaff(...)`; drop target `data-drop="1"` only on non-archived rows (`:822,853`). Board refresh tables `BOARD_TABLES` (`:107`). A realtime task whose staff is not loaded triggers `requestRefresh()` (`:229-234`).
- Strengths filter: Mantine MultiSelect in the staff column header (`GB/GanttBoard.tsx:783-791`), logic `TR/staffView.ts:8-21` (any-of; `all_rounder` strengths always match), prefs `{sort, filter, hideStrengths}` (`GB/boardHelpers.ts:10-28`) stored globally in `localStorage['tracker.board.v1']` (`GB/useBoardPrefs.ts:6`).
- Pickers: TaskPanel assignees `GB/TaskPanel.tsx:86` (non-archived + current owner); cut-mode create `GB/CreateTaskPopover.tsx:128-131` fed by `CV/CutsView.tsx:79` `activeStaff`; ShareModal `TR/ShareModal/ShareModal.tsx:110-118` (non-archived); BulkModal `CV/BulkModal.tsx:63,170` (pay, stays open).
- Tabs: `TR/ProjectViewTabs/ProjectViewTabs.tsx` — `SUFFIX` map (`:14`), labels `tracker.views.*` (en.json:500-505, vi.json:553-558: board/cuts/people = Schedule/Cuts/People, Lịch/Cut/Nhân sự); `active` passed as a prop.
- Cuts page: `PID/cuts/page.tsx` loads with `must()` + `selectAll` (`TR/Earnings/keyset.ts`); `CutsView` = header (title, hint, tabs) + toolbar + plain `<table>` in `styles.scroll` with a sticky first column. No filters.
- Helpers: `compareCutCodes` (`TR/cuts.ts:18`), `ddmm` (`GB/boardHelpers.ts:33`), no diacritics helper (Mantine `searchable` is accent-sensitive). Fix label is built inline as `` `${code} · ${t.fix}` `` (`GB/GanttBoard.tsx:387`, `GB/TaskBar.tsx:48`).
- Errors: `TR/errors.ts` maps SQL keys (`P0001` map `:22-33`, `BY_CODE` `:34-38`); consumers localize (e.g. `GB/GanttBoard.tsx:304-320`).
- Live data: 4 non-archived projects, 23 non-archived staff; one project has 155 tasks over 20 staff, one has 1 task, two have none.

---

## 2. RALPLAN-DR summary

**Principles**
1. The DB is the authority: membership and department rules live in SQL; the client mirrors them for UX only (same as order and pay rules).
2. Encode invariants structurally where possible (a member *is* a staff with ≥1 department row) instead of with extra triggers.
3. Reuse existing patterns: `writeRow`, `selectAll`, `RealtimeRefresh`/`useRealtimeTables`, `ProjectViewTabs`, `staffView`, `boardHelpers`, `compareCutCodes`.
4. Do not touch pay, share, ICS, email or cron paths (D14).
5. Pure logic in tested modules (`staffView`, new `members.ts`, new `taskList.ts`).

**Decision drivers**
1. Correctness of "≥1 department per member" and "new task writes need a member" under concurrent edits.
2. Board behaviour must not regress (drag, undo, realtime, presence) for 155 existing tasks on day one (D6).
3. Smallest schema and UI that covers D1–D14 and S1.

**Option A — one link table (chosen).** `tracker_member_departments(project_id, staff_id, department_id)`; a member is any staff with ≥1 row. Plus `tracker_departments`.
- Pros: "≥1 department" holds by construction; remove member = delete their rows; D11 is a plain FK (no action) on department delete; one table to publish and query.
- Cons: no place for per-member fields (e.g. join date, project role) — none are requested; "membership" queries need `distinct staff_id`.

**Option B — members table + link table.** `tracker_project_members(project_id, staff_id)` + `tracker_member_departments`.
- Pros: explicit membership row; room for future per-member fields.
- Cons: "≥1 department" needs a deferred constraint trigger on both tables; two writes per add; removal must cascade; more RLS/realtime surface. Nothing requested needs the extra row.

**Option C — UI-only membership (rejected by D4).** Pickers filter, DB accepts anything. Invalidated: owner chose DB enforcement.

**Filter storage options.** (i) per-project localStorage key for department + strength ids, global key keeps sort/hideStrengths (chosen; D9). (ii) URL params — rejected: D9 wants per-project persistence without links; URLs would also fight the `?m=` month param and the router cache rule in CLAUDE.md.

---

## 3. Design

### 3.1 Data model (migration `<ts>_tracker_v27_members.sql`)

Contract (executor writes the SQL; names fixed):

- `public.tracker_departments`
  - `id uuid pk default gen_random_uuid()`, `project_id uuid not null references tracker_projects(id) on delete cascade`, `name text not null check (char_length(btrim(name)) between 1 and 40)`, `color text not null default '#868e96' check (color ~ '^#[0-9a-fA-F]{6}$')`, `sort_order int not null default 0`, `created_at timestamptz not null default now()`.
  - `unique (project_id, id)` (target of the composite FK); unique index `(project_id, lower(btrim(name)))` → 23505 = name taken.
  - `project_id` immutable via column grants: authenticated gets `update (name, color, sort_order)` only (no trigger).
- `public.tracker_member_departments`
  - `id bigint generated always as identity primary key` (surrogate, so `selectAll` keyset paging works), `project_id uuid not null references tracker_projects(id) on delete cascade`, `staff_id uuid not null references tracker_staff(id) on delete cascade`, `department_id uuid not null`, `created_at timestamptz not null default now()`.
  - `unique (project_id, staff_id, department_id)`; `foreign key (project_id, department_id) references tracker_departments(project_id, id)` **no action** (D11: deleting a department with members fails with 23503); index on `(department_id)`; `(project_id, staff_id)` is covered by the unique index prefix.
  - No UPDATE: rows are inserted/deleted only (revoke `update` from authenticated).
- RLS on both: enable; one `FOR ALL to authenticated` policy `using/with check ((select public.is_tracker_user()))`, same shape as V1:77.
- Grants (explicit, like V1:66-69): `revoke all on both tables from public, anon, authenticated`; then departments `grant select, insert, delete` + `grant update (name, color, sort_order)` to authenticated; member_departments `grant select, insert, delete` to authenticated. All three RPCs: `revoke execute … from public, anon; grant execute … to authenticated` (as V26:136-137).
- The archived-staff rule on adding a member lives in the RPC only; a direct PostgREST insert could add an archived staff. Accepted: harmless (archived rows are greyed and never assignable) and the client only uses the RPC.
- Realtime: `alter publication supabase_realtime add table tracker_departments, tracker_member_departments`.
- **Membership trigger** `private.tracker_task_member()` BEFORE INSERT OR UPDATE OF `staff_id` ON `tracker_tasks`:
  - fires the check only when `TG_OP = 'INSERT'` or `new.staff_id is distinct from old.staff_id`;
  - takes the per-project advisory lock (inline, as elsewhere);
  - `if not exists (select 1 from tracker_member_departments where project_id = new.project_id and staff_id = new.staff_id) then raise exception 'staff_not_member'` (P0001).
  - Covers `tracker_create_task` (incl. fixes), `tracker_move_task`, plain updates and undo re-creates. Archived check in `tracker_move_task` stays first.
- **RPC `tracker_set_member_departments(p_project uuid, p_staff uuid[], p_departments uuid[]) returns setof tracker_member_departments`** (SECURITY INVOKER, authenticated, `set search_path = ''`):
  - advisory lock on `p_project`;
  - empty `p_staff` or empty `p_departments` raises `invalid` (removal is a separate action, see §3.3, so an accidental empty edit can never drop a member);
  - for each staff in `p_staff`: delete rows not in `p_departments`, insert missing ones (`on conflict do nothing`);
  - adding a staff who is not yet a member and is archived raises `staff_archived`; a department not in `p_project` fails the composite FK (23503 → `invalid`);
  - returns the project's rows for those staff.
  - Used by: add members (many staff, one set), edit member (one staff, new set). Removal = **RPC `tracker_remove_member(p_project uuid, p_staff uuid) returns jsonb`** (`{"removed": n}`): same advisory lock, then `delete … where project_id = p_project and staff_id = p_staff` (D5: tasks untouched). Sharing the lock with set-departments serialises edit vs remove (Codex r2: an unlocked delete racing an edit could leave a partial set).
- **RPC `tracker_copy_members(p_from uuid, p_to uuid) returns jsonb`** (`{"added": n}`; an integer 0 would hit `writeRow`'s `!data` → `not_found`, ACT:118) (SECURITY INVOKER, `set search_path = ''`): advisory lock on `p_to` (then `p_from` reads need no lock); for each department of `p_from` that has members: find the `p_to` department by `lower(btrim(name))` or create it (copy colour, `sort_order` appended); insert links for **non-archived** staff `on conflict do nothing`. Additive; `added` = number of new (staff, department) rows. `p_from = p_to` raises `invalid`.
- **Backfill (D6)**, in the migration (one transaction): first `lock table public.tracker_tasks in share row exclusive mode` (blocks task writes until commit, so no owner can appear between the backfill read and the trigger install), then for every project (archived included) with ≥1 task, insert department `Chung` (colour `#868e96`, sort_order 10) and one link per distinct `staff_id` of its tasks (archived staff included — harmless, they are greyed anyway).
- Error keys added: `staff_not_member`: `TR/errors.ts` constants, `P0001` map **and** the `TrackerError` union (`:13-15`). FK 23503 uses the existing `FkError` per action: `deleteDepartment` `{fk: 'in_use'}` (precedent `deleteStrength`, ACT:298-301), `setMemberDepartments` `{fk: 'invalid'}`.
- After apply: regen types (`database.types.ts` + supazod), `get_advisors` security must stay empty.

### 3.2 Pure modules (+ Vitest)

- `TR/staffView.ts`
  - `foldName(s: string): string` — `normalize('NFD')`, strip `\p{M}`, `đ/Đ → d`, lowercase, collapse whitespace, trim.
  - `viewStaff(staff, strengthsByStaff, prefs, f: {name: string; departments: string[]; deptsByStaff: Map<string, string[]>})` — keeps today's strength rule (any-of, `all_rounder` matches) and adds: name = `foldName(staff.name).includes(foldName(f.name))` when the query is non-empty; departments = any-of against `deptsByStaff`. All three ANDed. Unknown ids are dropped before use (as today `:295`).
- `TR/members.ts` (new)
  - `memberSet(rows): Map<staffId, departmentId[]>` (departments ordered by department `sort_order`, name).
  - `boardStaff(allStaff, members, ownerIds): {rows: Staff[]; assignable: Set<string>}`: rows = (members ∩ non-archived) ∪ `ownerIds`; `assignable` = non-archived members. Order unchanged (staff `sort_order`, name). Computed **on the client** in GanttBoard from the synced store's current-month tasks (`ownerIds` = staff ids of `shown`), so deleting/moving/reassigning a former member's last task (own write, undo/redo, or remote event) drops their row without a refresh (D3).
  - `pickerStaff(allStaff, members, currentOwner?)` — non-archived members + the current owner (TaskPanel, cut-mode create).
  - `shareGroups(allStaff, members, labels)` → Mantine grouped data `[{group: members, items}, {group: others, items}]`, non-archived only, empty groups omitted.
- `GB/boardHelpers.ts`
  - `BoardPrefs` loses `filter` (moved). New `ProjectFilter = {strengths: string[]; departments: string[]}`, `parseProjectFilter(raw)` (strings only, safe JSON). Key `tracker.board.filter.<projectId>`. The old global `filter` field is ignored on read (no migration of browser state).
- `TR/taskList.ts` (new, S1)
  - `filterTasks(tasks, f: {staff: string[]; types: string[]; cuts: string[]})` — empty array = all; AND across the three.
  - `sortTasks(tasks, cutCode: (id) => string, typeOrder: (id) => number)` — rule S1-c.
  - `fmtRange(start, end): string` — `dd/mm/yyyy – dd/mm/yyyy`.
- Tests: `staffView` (fold "Tuấn"/"Đức", AND of 3 filters, empty filters show all), `members` (boardStaff with non-member month owner, archived member, assignable), `boardHelpers` (parseProjectFilter junk), `taskList` (filter combos, sort with fixes, range), `errors` (`staff_not_member`).

### 3.3 Members tab "Thành viên" (`PID/members/page.tsx` + `TR/MembersView/`)

- Server page (pattern of `PID/cuts/page.tsx`, `must()` + `selectAll`): project (non-archived, else `notFound`), departments of the project (`sort_order`, name), member rows, all staff (id, name, archived_at, sort_order), strengths + staff_strengths, tasks of the project (`selectAll`, columns `id, staff_id`, for counts); member rows via `selectAll` (surrogate `id`), other non-archived projects (id, name) for copy.
- Layout like CutsView: header (title, hint, `ProjectViewTabs active="members"`), toolbar (Add members, Copy from project…), then two blocks:
  1. **Departments**: one row per department — colour swatch, name, member count; inline rename + colour (Mantine `ColorInput` with swatches), Add department (name + colour), Delete enabled only when count = 0 (tooltip otherwise). New `sort_order` = max + 10. No reordering UI.
  2. **Members** table (plain `<table>`, CutsView styles): name (+ "archived" badge), department chips (colour), strengths text, task count in this project, actions Edit / Remove.
- Modals: **Add members** — staff MultiSelect (non-archived non-members, accent-insensitive `filter` using `foldName`), departments MultiSelect (required ≥1) → `setMemberDepartments`. **Edit** — departments MultiSelect (≥1; save disabled when empty) → same action, one staff. **Remove** — confirm; when the staff owns tasks here the text says the N tasks stay (D5) → `removeMember`. **Copy from project** — project Select → `copyMembers`; notice "Added N".
- Server actions in ACT (all via `writeRow` pattern, zod, `getUser()` guard, `refresh()`): `createDepartment`, `updateDepartment` (name/colour only), `deleteDepartment` (`{fk: 'in_use'}` → `in_use`; 23505 → `duplicate` on create/rename), `setMemberDepartments(projectId, staffIds[], departmentIds[])` (zod: both arrays ≥1), `removeMember(projectId, staffId)` (calls `tracker_remove_member`; jsonb result, so 0 removed is still ok), `copyMembers(fromId, toId)` (returns `{added}`). The Members view localizes `in_use` as "department still has members" and `duplicate` as "name taken".
- Realtime: `RealtimeRefresh` on `tracker_departments`, `tracker_member_departments`, `tracker_staff`, `tracker_staff_strengths`, `tracker_tasks`; `useRealtimeBusy` while a modal is open.

### 3.4 Board (`PID/page.tsx`, `GB/GanttBoard.tsx`, `GB/TaskPanel.tsx`)

- Page also loads the project's departments + member rows (`selectAll`) and passes **all** staff (archived included; the list is small) instead of today's non-archived ∪ month-owners filter (`PID/page.tsx:49-52`). The full list stays the source for name lookups (TaskPanel, MoveDialog, presence, ShareModal "Others"). GanttBoard computes `boardStaff` (§3.2) for the rows only; `viewStaff` (single caller `GB/GanttBoard.tsx:296`) filters those rows. The realtime "unknown staff" refresh (`:229-234`) stays for staff created after load.
- Rows: non-assignable rows (archived or non-member) render greyed like archived rows today: no `data-drop`, no "+" button, no drag-create. Assignable = `data-drop` as today (when the project has work types).
- Staff cell: department chips (colour dot + name, truncated). Chips always show; `hideStrengths` keeps hiding strengths only.
- Staff column header filter row: name `TextInput` (clear button, not persisted), department MultiSelect, strength MultiSelect (moved to per-project storage via `useProjectFilter(projectId)`; the `useBoardPrefs` store (useSyncExternalStore + memory fallback + `storage` event) is generalised to a keyed store, not copied), and a "Clear filters" action when any filter is active; a "x / y" shown count.
- S2 (owner, mid-execution): the board heading shows the project name instead of `tracker.board.title` ("Lịch phân công Animator"); the key stays only if still used elsewhere (e.g. metadata), else is removed from both dictionaries.
- `BOARD_TABLES` adds `tracker_departments`, `tracker_member_departments`.
- Empty state (D13): when the project has no members and no current-month owners, the grid area shows a message with a link to the Thành viên tab.
- TaskPanel assignee Select uses `pickerStaff` (members + current owner). Error switch (`:304-320`) adds `staff_not_member` → dictionary message. Undo of a delete/move to a removed member fails with that message through the existing undo error path (no undo-specific code).

### 3.5 Cut page, Share modal

- `PID/cuts/page.tsx` loads member rows (`selectAll`) and adds `tracker_staff`, `tracker_member_departments` to its `RealtimeRefresh` tables (`PAY_TABLES`, `:9`). `CV/CutsView.tsx` passes `pickerStaff` (no current owner) to cut-mode create instead of `activeStaff`; its `errorText` (`:100-120`) adds `staff_not_member` (create uses it, `:134`). BulkModal/CutDrawer keep `activeStaff` (D10).
- `TR/ShareModal/ShareModal.tsx` takes member ids and uses `shareGroups` (members first, "Others" below). Its callers (board) pass members.

### 3.6 Task list "Công việc" (S1: `PID/tasks/page.tsx` + `TR/TaskListView/`)

- Server page like `PID/cuts/page.tsx`: project, work types (`sort_order`), cuts (`selectAll`), tasks (`selectAll`, columns id, cut_id, work_type_id, staff_id, start_date, end_date, progress, is_fix), staff (id, name, archived_at).
- Layout like CutsView: header + tabs `active="tasks"`, a toolbar with three MultiSelects (Staff, Work type, Cut; placeholder "All"; searchable; staff uses `foldName` filter), a count line, then a plain `<table>` with columns Cut | Work type | Staff | Dates | Progress. Fix rows: type cell `LO · Fix`. Archived staff: name + muted "(archived)". Empty result: one row "No tasks match".
- Uses `filterTasks`, `sortTasks`, `fmtRange`. Realtime: `RealtimeRefresh` on `tracker_tasks`, `tracker_cuts`, `tracker_work_types`, `tracker_staff`. Task query = `selectAll` (has `id`).

### 3.7 Tabs + dictionaries (`DICT`, same keys in both)

- `TR/ProjectViewTabs/ProjectViewTabs.tsx`: `SUFFIX` adds `tasks: '/tasks'`, `members: '/members'`; order board, cuts, tasks, members, people.
- `tracker.views`: `tasks` (Tasks / Công việc), `members` (Members / Thành viên), `people` → "Earnings" / "Thu nhập" (only this key; `tracker.people.title` is already "Thu nhập"/"Earnings", and `tracker.people.name` "Nhân sự" is a column header that stays).
- New blocks `tracker.members.*` (titles, hints, buttons, modal labels, confirm texts, notices, errors `departmentInUse` (for `in_use`), `nameTaken` (for `duplicate`)), `tracker.taskList.*`, `tracker.board.filters.*` (name placeholder, departments, clear, shown count, empty-state text + link), error `staffNotMember`.
- `CLAUDE.md` Tracker section updated (tables, RPCs, error keys, migration name, routes, tests).

---

## 4. Acceptance criteria

Data / SQL (checked with `execute_sql` as an authenticated tracker user where RLS matters):
- AC1 After the migration, each project with tasks has exactly one department "Chung" whose members = distinct task owners; projects without tasks have no departments. (SQL count compare.)
- AC2 Inserting a task (via `tracker_create_task`, fix or stage) for a non-member raises `staff_not_member`; for a member it succeeds.
- AC3 `tracker_move_task` to a non-member raises `staff_not_member`; to an archived staff still raises `staff_archived`.
- AC4 Updating dates/progress of an existing task whose staff is no longer a member succeeds.
- AC5 Deleting a department with members fails (23503); without members succeeds. Duplicate name (case/space-insensitive) in one project fails (23505); same name in another project succeeds.
- AC6 `tracker_set_member_departments` with an empty staff or department array raises `invalid`; it replaces a member's set exactly; adding an archived non-member raises `staff_archived`; a department from another project fails (23503). `tracker_remove_member` deletes the staff's rows, leaves their tasks, returns `{"removed":0}` for a non-member. Code review checks that set/remove/copy all take the same per-project advisory lock before reading or writing links.
- AC7 `tracker_copy_members` creates missing departments by name, adds non-archived staff only, is idempotent (second run returns `{"added":0}`); `p_from = p_to` raises. The `copyMembers` action returns ok with `added: 0` on a repeat and on an empty source project.
- AC8 Privileges: `information_schema.role_table_grants` / `has_table_privilege` show no grants to `anon`/`public` on both tables, no TRUNCATE/UPDATE for authenticated on member_departments, column UPDATE only on (name, color, sort_order) for departments; `has_function_privilege('anon', …)` is false for both RPCs. As `authenticated` with the JWT email of a non-allow-listed user: select returns 0 rows, insert fails RLS. `get_advisors` (security) empty; both tables in `supabase_realtime`.
- AC8b RLS checks run inside `begin … rollback` with `set local role authenticated|anon` and `select set_config('request.jwt.claims', '{"email":"…"}', true)` (execute_sql runs as `postgres` and bypasses RLS otherwise).

Unit:
- AC9 `npm test` passes, including the new cases listed in 3.2; `npx.cmd tsc --noEmit` and `npm run lint` are clean.

UI (E2E in the debug Chrome on :9222):
- AC10 Tabs show Lịch | Cut | Công việc | Thành viên | Thu nhập (vi) and Schedule | Cuts | Tasks | Members | Earnings (en); each opens its page with the right active tab.
- AC11 Members tab: add a department, rename it, change colour; add two staff into two departments at once; edit one to a single department; Save disabled with zero departments; Delete department disabled while it has members, works when empty; remove a member who owns tasks — tasks still on the board in that month, row greyed.
- AC12 Copy members from another project adds the expected people and departments; notice shows the count.
- AC13 Board shows members + greyed month owners only; a non-member cannot be a vertical drop target and has no "+"; TaskPanel assignee list shows members (+ current owner) only. Deleting (own, undo, or from another tab) or moving out of the month the last task of a former member removes their row without a page reload.
- AC14 Board filters: "tuan" matches "Tuấn"; department + strength + name combine with AND; department/strength survive reload per project (another project keeps its own); name search is empty after reload; "Clear filters" resets all three.
- AC15 Undo of a reassign back to a staff who was removed from the project shows the "not a member" message and leaves the task as is.
- AC16 Cut page cut-mode create lists members only and updates when another tab adds/removes a member; creating for a member removed meanwhile shows the "not a member" message; Share modal shows members first, others under "Others"; Bulk bonus/penalty lists all non-archived staff.
- AC17 Task list: default shows all project tasks (count equals SQL count); each filter and their combination narrows correctly; fix rows labelled "· Fix"; sort per S1-c; dates `dd/mm/yyyy – dd/mm/yyyy`; a realtime task edit on the board appears after refresh.
- AC18a Project with no members and no tasks in the month: board shows the empty state with a link to Thành viên.
- AC18b Project whose members were all removed but who still own tasks this month: greyed owner rows with their tasks, no empty state.

---

## 5. Execution plan (after approval; max 3 subagents at once)

| ID | Deps | Task | Agent | Acceptance |
|----|------|------|-------|-----------|
| W1.1 | — | Migration file (3.1) + SQL test script (AC1–AC8b as `begin … rollback` blocks, role/JWT setup per AC8b) | opus-executor | File reviewed; script ready |
| W1.2 | — | Pure modules + tests (3.2) on local minimal types | opus-executor | AC9 for these modules |
| W1.3 | — | Tabs + dictionary keys + tab rename (3.7, no CLAUDE.md yet) | sonnet-executor | AC10 labels in both files; tsc clean |
| Gate A | W1.1 | Owner OK → main session applies migration, runs SQL test script, regen types + supazod, advisors | orchestrator | AC1–AC8 |
| W2.1 | Gate A, W1.2 | Members tab + actions (3.3) | opus-executor | AC11–AC12 |
| W2.2 | Gate A, W1.2 | Board + TaskPanel + filters + empty state (3.4) | opus-executor | AC13–AC15, AC18 |
| W2.3 | Gate A, W1.2, W1.3 | Task list (3.6) + Cut page + Share modal (3.5) | opus-executor | AC16–AC17 |
| W3 | W2.* | Separate reviewer passes (one per W2 row, fresh context) | opus-executor ×3 | PASS or fixes routed back |
| W4 | W3 | E2E brief run (AC10–AC18), CLAUDE.md update | sonnet-executor | Pass table + evidence `.omc/e2e/v2.7/` |

---

## 6. Risks and mitigations

- R1 Trigger order on `tracker_tasks`: the membership trigger and the order trigger both take the same advisory lock (re-entrant in one transaction). Mitigation: AC2/AC3 run through the real RPCs.
- R2 Day-one regression on the 155-task project. Mitigation: backfill before the trigger; AC1 compares counts; E2E opens that board first.
- R3 Undo of earlier actions now refused for removed members. Accepted (D4); AC15 checks the message is clear.
- R4 23503 is generic. Mitigation: mapped per action, not globally in `errors.ts`.
- R5 Board filter moved to per-project storage: users lose their current global strength filter once. Accepted; noted in the changelog.
- R6 Copy members into a project concurrently with a manual edit. Mitigation: advisory lock on the target project; `on conflict do nothing`.
- R7 Subagent `apply_migration` denied. Mitigation: Gate A runs in the main session.
- R8 The migration's `share row exclusive` lock on `tracker_tasks` blocks task writes for the migration's duration (sub-second on 156 rows). Accepted; a blocked client write just waits.
- R9 Trigger order: BEFORE triggers fire alphabetically (`tracker_bump_version`, `tracker_task_member`, `tracker_task_order`), so an insert with an unknown `staff_id` reports `staff_not_member` before 23503. Harmless; no client path does this.

## 7. Verification steps

1. SQL test script (AC1–AC8) output, inside rollbacks except the real apply.
2. `npm test`, `npx.cmd tsc --noEmit`, `npm run lint`.
3. Reviewer passes per W2 row.
4. E2E AC10–AC18 with screenshots (light only; no themed-style changes beyond chips) and SQL checks.

## ADR

- **Decision:** Membership = a staff with ≥1 row in `tracker_member_departments(project, staff, department)`; departments in `tracker_departments` per project. A BEFORE trigger on `tracker_tasks` refuses new owners who are not members (`staff_not_member`). Set/copy go through two SECURITY INVOKER RPCs; department CRUD is plain RLS-guarded writes; set, remove and copy are three locked RPCs. Board rows are derived on the client from membership plus the synced month tasks. Filters are combined with AND, stored per project (name search not stored). There is a new read-only task list tab.
- **Drivers:** owner decisions D1–D14 + S1; correctness under concurrent edits; no regression on the live 155-task board; smallest schema.
- **Alternatives considered:**
  - (B) A members table plus a link table: rejected, because it needs a deferred "≥1 department" trigger and a second write path for no requested benefit.
  - (C) UI-only membership: rejected by D4.
  - URL-stored filters: rejected by D9 and by the router-cache rule.
  - Server-computed board rows: rejected (Codex 5), because they go stale after task changes.
- **Why chosen:** the "≥1 department" rule holds by construction, and D11 is a plain FK. The trigger covers every write path (create, fix, move, undo) without touching the existing RPCs.
- **Consequences:**
  - Undo onto a removed member is refused, with a clear message.
  - Users lose their current global strength filter once, because it moves to per-project storage.
  - The backfill locks task writes briefly.
  - The archived-staff check on adding a member is enforced by the RPC only.
- **Follow-ups:**
  - Accent-insensitive search in the other staff pickers (ShareModal, BulkModal).
  - Clicking a task-list row to jump to the board month.
  - URL-shareable task-list filters.
  - Department reordering UI.
  - Optional audit of membership changes.

## Changelog

- r1 (2026-10-05): first draft from owner answers D1–D14 + S1.
- r3 (2026-10-05): Critic r2 stale `department_in_use` sentence fixed; Codex r2 major: removal is now the locked RPC `tracker_remove_member` (edit/remove race left partial sets).
- r2 (2026-10-05): merged Architect A1–A5, Critic 1–7, Codex 1–8 (verdicts in the review log): explicit revoke/grant contract; copy RPC returns jsonb; empty-set guard + separate `removeMember`; surrogate `id` on the link table for keyset paging, task counts select `id`; board rows computed client-side from the synced store; Cuts page realtime + error case; table lock during backfill; `in_use` reused instead of a new key; rename scoped to `views.people`; RLS test setup; AC18 split; policy claim corrected; column grants replace the immutability trigger.
- Execution (2026-10-05): W1 (migration, pure modules, dictionaries/tabs) → Gate A (applied live, SQL AC1–AC8b pass) → W2 (Members tab, board, task list + Cut page) → reviewers ×3. Review fixes: RPC `p_mode` ('add' for Add members, 'set' for Edit; migration v27b, Gate A2), department/dialog pending guards, departmentGone message, board filters moved to the toolbar, create-draft cleanup when a row disappears, vi wording "công việc", en "Members: N"/"Tasks: N". S2: board heading = project name, `tracker.board.title` removed. E2E: all AC pass (AC13 step 4 verified via DOM `data-drop`). Follow-ups: drag-create in progress when its row disappears (rare); accent-insensitive search in other pickers; task list row → board link; URL-shareable task-list filters; department reordering UI; leftover archived E2E-v27 projects/staff and one notice-queue row for E2E-v27 Tuấn (no email).
