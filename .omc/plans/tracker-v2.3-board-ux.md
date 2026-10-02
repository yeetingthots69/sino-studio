# Tracker v2.3 — board UX round (8 user-feedback items)

Status: **DONE 2026-10-02** — built, reviewed, E2E-verified (`.omc/e2e/v2.3/e2e-v2.3-results.md`); migration `20261002034325_tracker_v23_move_task` applied live with owner OK; uncommitted. (consensus planning, interactive). Owner decisions: `.omc/drafts/tracker-v2.3-decisions.md`. Review log (Architect, Critic, Codex + verdicts): `.omc/drafts/tracker-v2.3-review-r1.md`. Repro evidence: `.omc/e2e/v2.2-repro/`.
Execution: `/orchestrate-with-subagents`, max 4 subagents at a time. No git writes (owner commits). Every brief says "do not commit".

Paths: `GB/` = `src/components/tracker/GanttBoard/`, `TR/` = `src/components/tracker/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `V2` = `supabase/migrations/20260930065620_tracker_v2.sql`, `HARD` = `supabase/migrations/20260930070707_tracker_v2_hardening.sql`.

---

## 1. Requirements summary

| # | Feedback | Owner decision | Root cause / current state (evidence) |
|---|----------|----------------|----------------------------------------|
| F1 | Clicking the highlighted task again closes the right panel | D1 A: panel collapses, board full width; Esc closes; drag/resize never counts as a click. D1b A: "Discard changes?" prompt when the panel has an open draft | `selectedId` is local state (GanttBoard.tsx:81); bar click only sets it (GanttBoard.tsx:465, TaskBar.tsx:41). Panel always rendered with an empty state (TaskPanel.tsx:68-75), no close button, no Esc. Drag handlers sit on the same `<button>` (TaskBar.tsx:42, useBarDrag.ts:42-82), no click suppression. Drafts: the Cut field saves on blur (TaskPanel.tsx:83-94,148-151) so it is never left unsaved by a click elsewhere; the links editor keeps an explicit draft until Save/Cancel (TaskPanel.tsx:96-105) |
| F2 | Type a month/year to jump | D2 A: click month label → popover with typed field + month grid + "This month"; arrows stay | One month per view, URL `?m=YYYY-MM` (`[projectId]/page.tsx:22-27`); MonthNav (GB/MonthNav.tsx) does `router.push(pathname?m=)`. `@mantine/dates ^9.6.3`, `dayjs/locale/vi`, dates CSS and `DatesProvider({locale})` already set up in TrackerShell.tsx:3-4,9,75. `isValidMonth` accepts 2000-2099 (TR/dates.ts:30) |
| F3 | Skeletons while a new month loads | D3 A: header switches at once, staff names stay, bar area shows skeleton bars | No loading.tsx / Suspense / transition; old grid stays with no indicator while 9 queries run (page.tsx:31-46). Board keyed by `${projectId}-${month}` (page.tsx:68) → remount on arrival |
| F4 | Cut autocomplete shows on every New Task open; shorten it | D4 A: keep focus on Cut; list opens only on typing / click / ArrowDown; cap ~5 rows | NOT stale state: popover remounts per draft (`key={draft.id}`, GanttBoard.tsx:476-491; useDragCreate.ts:27,57). `data-autofocus` (CreateTaskPopover.tsx:148-160) + Mantine Autocomplete `openOnFocus = true` default (Autocomplete.mjs:21,100). Browser: 20 cuts → 229 px list over the work-type buttons on every open |
| F5 | Scrolling past the page end should scroll the table | D5 A: any wheel input nothing else can consume scrolls the grid | Browser: desktop ≥1024 page is height-locked (GanttBoard.module.css:367-399), `.scroll` (:79-82) the only scroller; title, toolbar, panel column, gaps, strip below the grid are dead zones. Tablet: page scrolls, then the same dead zones at its end. No wheel handlers / `overscroll-behavior` anywhere |
| F6 | Same cut's tasks on one row, work-type order kept | D6 A: compact — a cut keeps one row in a staff group; cuts share a row when they don't overlap | `assignLanes` (TR/dates.ts:68-80) packs by date only. Callers: GanttBoard.tsx:420 and ScheduleGrid.tsx:54 (share DTO already has `cut_id`, shareShape.ts:7-10). Within a cut, stages are strictly disjoint and in `sort_order` (V2:247-275, pipeline.ts:11-25) |
| F7 | Move tasks vertically; related info follows | D7a C: ask only if the stage has bonus/penalty entries for the old person (move / keep). D7b B: confirm dialog on every cross-person move. D7c B: "removed" line in the previous person's digest | Drag is horizontal only (useBarDrag.ts:60). `staff_id` mutable; TaskPanel already reassigns via a Select with no confirm/adjustment handling (TaskPanel.tsx:222-228). Stage pay, ICS, share pages, presence follow `staff_id` (pay.ts:46-67, shareData.ts:36-37,66). Adjustments keyed by (staff, cut, type), append-only, `reverses_id` UNIQUE, no `task_id` (V2:222-240); guard rules V2:350-380. Notice trigger enqueues only `NEW.staff_id` (V2:437-454) |
| F8 | 1-day tasks unreadable | D8 A+B: compact two-line bar under 2 days + hover card on every bar | `DAY_W = 40` (GanttBoard.tsx:39); 1-day bar = 36 px (TaskBar.tsx:51-52) holding grip + label + two 8 px handles; no tooltip in the tracker |

Out of scope (follow-ups): share-page narrow bars (it has a native `title=`), auto-scroll while dragging near the grid edge, "removed" notice on task delete, zoom levels.

---

## 2. RALPLAN-DR summary

**Principles**
1. The DB is the authority: anything that changes money or must be atomic runs in one SQL function under the per-project advisory lock; the client mirrors.
2. Reuse existing paths: `commit()` chain + `taskSync`, `writeVersioned`, notice queue + outbox, installed Mantine (+ dates already wired). No new dependencies.
3. Pure logic in pure modules with Vitest tests (lanes, month parsing, wheel decisions, drag targets, movable adjustments, digest planning).
4. Fix root causes (F4 = focus-open, F5 = dead zones).
5. One owner per file per wave.
6. One reassign path: drag and the panel's assignee Select both go through the confirm dialog + `moveTask`.

**Decision drivers**
1. Pay correctness on reassignment (append-only ledger, atomicity, no double or phantom moves).
2. No regression of drag / commit / realtime (taskSync ordering, versions, presence).
3. Small reviewable diff in the hottest file (`GanttBoard.tsx`).

**Options considered**

*O1 — Reassign write path*
- **(a) New RPC `tracker_move_task` (chosen):** task update with version check + optional reversal/re-entry of adjustments in one transaction, lock first. Pros: atomic, same lock order as every rule, one realtime UPDATE. Cons: one migration + types regen; repeats the version check `updateTask` does with `.eq('version')`.
- (b) `updateTask({staff_id})` then `addAdjustments`. Not atomic: a failure between the calls leaves pay on the wrong person; two op ids. Rejected (driver 1).
- (c) Plain `updateTask`, no adjustment handling (keep the panel path as is). Strongest counter-argument (Architect antithesis): it is consistent and needs no migration. Rejected by owner D7a = C; instead principle 6 makes BOTH paths use (a).

*O2 — "Removed" digest line*
- **(a) Snapshot in the enqueue trigger (chosen):** on `staff_id` change, also upsert the OLD staff's queue row and append `{task_id, project_name, cut_code, type_code, type_label, start_date, end_date}` to a new `removed jsonb`. Pros: survives later edits/deletes; no extra cron queries. Cons: 3 lookups in the trigger on a rare event.
- (b) Ids only, cron resolves labels from the audit log. Audit rows are JSON blobs without a task-id index; more cron code. Rejected.

*O3 — One row per cut*
- **(a) Group by `cut_id` inside `assignLanes`, first-fit on cut blocks (chosen).** Both callers stay consistent. Cons: a block's internal gap (another person's middle stage) cannot host another cut → can add lanes (accepted: owner chose readability).
- (b) Pack tasks, pin a cut to its first stage's lane. Later stages collide with cuts placed meanwhile → the same hopping. Rejected.

*O4 — Wheel hand-off*
- **(a) One `document` wheel listener (passive:false) while the board is mounted (chosen):** if nothing under the pointer can consume the delta, scroll the grid. One rule for desktop + tablet + panel + popovers.
- (b) CSS only (let the page scroll). Re-creates nested-scroll traps; does not cover the panel column. Rejected.

---

## 3. Acceptance criteria (testable)

F1
- AC1.1 Clicking the selected bar with < 4 px pointer movement clears the selection; the panel unmounts; at ≥1024 px `.card` width grows by ≥ 300 px.
- AC1.2 Dragging/resizing the selected bar by ≥ 1 day keeps it selected.
- AC1.2b A sub-day wobble (≥ 4 px, < 20 px, released back near the origin) keeps it selected and commits nothing.
- AC1.3 Esc with a task selected and focus not in an input/select/textarea/contenteditable or modal closes the panel; Esc inside a panel input does not.
- AC1.4 With the links editor open (unsaved draft), close (re-click, X, Esc) or selecting another bar shows the inline "Discard changes?" prompt; "Keep editing" keeps the draft; "Discard" performs the pending action. A typed Cut draft is saved by its existing blur rule (no prompt, no loss).
- AC1.5 Panel header close button (dictionary aria-label) behaves like AC1.1/AC1.4.

F2
- AC2.1 Clicking the month label opens a popover with a focused text field and a month grid; arrows still work.
- AC2.2 `parseMonthInput` tests: `10/2026`, `10-2026`, `10 2026`, `10.2026`, `2026-10`, `2026/10`, `10/26`, `T10/2026`, `thg 10 2026`, `tháng 10 2026` → `2026-10`; `13/2026`, `0/2026`, `abc`, `10/1999`, `` → `null`. `shiftMonth('2026-01', -1) = '2025-12'`, `shiftMonth('2026-12', 1) = '2027-01'`.
- AC2.3 Enter on a valid value navigates to `?m=YYYY-MM` and closes; invalid shows the dictionary error, no navigation.
- AC2.4 Picking a month navigates; "This month" navigates to `defaultMonth()`.
- AC2.5 Month names follow the page locale (vi / en).

F3
- AC3.1 After next/prev/jump, the header shows the target month's days within one frame and every staff row shows skeleton bars instead of TaskBars; STT/name/strength cells stay.
- AC3.2 While pending: no drag-create, no bar drag, panel hidden, presence hover not sent.
- AC3.3 The real board replaces the skeleton on arrival; no console errors; a failed navigation does not leave the skeleton forever (safety reset ≤ 20 s).

F4 (board mode; cut mode renders an assignee Select and is only regression-checked)
- AC4.1 Opening New Task in a project with ≥ 20 cuts focuses the Cut field and shows no listbox.
- AC4.2 Typing, clicking the field, or ArrowDown opens the list; height ≤ 190 px; picking an option closes it and it stays closed.
- AC4.3 With the list open, the first Esc closes only the list (`onDropdownClose` fires); the second Esc closes the popover.
- AC4.4 Close + reopen repeats AC4.1.

F5
- AC5.1 Desktop 1440×900: wheel over title, toolbar, panel column (panel not overflowing), gaps, strip below grid, shell header scrolls the grid by the wheel delta; an overflowing panel scrolls itself first.
- AC5.2 Tablet 900×800: wheel over the title scrolls the page to its end, then the grid.
- AC5.3 Popovers/dropdowns scroll themselves while they can; at their end the grid takes over. Wheel inside a modal dialog and Ctrl+wheel are never intercepted.
- AC5.4 Unit tests: `normalizeWheel` (deltaMode 0/1/2), `canConsume` (both axes, top/bottom/left/right ends, overflow hidden/visible = not consumable).

F6
- AC6.1 `assignLanes` tests: (i) cut A LO/AN/CL + overlapping cut B → all A stages in one lane, B in another; (ii) non-overlapping cuts share lane 0; (iii) touching blocks (A ends d5, B starts d6) share a lane; (iv) ties ordered by block start, end, `cut_id`; (v) null `cut_id` → single-task block; (vi) existing date-only case still yields a valid non-overlapping packing.
- AC6.2 Board and share page both use it (same function, callers unchanged).

F7
- AC7.1 Dragging a bar (move mode only) into another active staff row highlights that row; archived rows and the own row never highlight; resize never changes the person.
- AC7.2 Dropping on another person opens the confirm dialog ("Move C12 · LO from An to Minh", new dates if changed); Cancel → DB unchanged, bar back in place.
- AC7.2b Changing the assignee in the panel Select opens the same dialog (dates unchanged); Cancel restores the Select value.
- AC7.3 If the stage has movable adjustments for the old person, the dialog shows count + net and requires a choice (Move / Keep) before Confirm enables; otherwise no choice.
- AC7.4 Confirm → bar in the new row, `version` bumps once, other tabs update via realtime.
- AC7.5 "Move": per moved row, one reversal for the old staff (`reverses_id` = original, amount = −original) + one copy for the new staff, all in ONE batch; old staff net for the stage = 0; new staff net increases by exactly the transferred net.
- AC7.6 Stale version → conflict notice + fresh row. Target archived → `t.moveArchived` message, nothing written. Order violation → `order_conflict` notice.
- AC7.7 After A→B: B's queue row has the task id in `task_ids`; A's row has a `removed` entry with labels + old dates; A's `generation` bumped.
- AC7.8 `planDigest` tests: removed-only digest sends; removed entry whose task the recipient owns again is dropped; duplicates by `task_id` collapse to the last snapshot (A→B→A→B); the existing L24 case ("reassigned away") still drops when there is no snapshot.
- AC7.9 Digest email renders a "Đã chuyển khỏi bạn" table in the existing table style.
- AC7.10 `get_advisors` (security) empty after the migration.
- AC7.11 Same-person date move → A's `removed` stays `[]`.
- AC7.12 "Keep" (or no movable rows) → zero adjustment rows AND zero batches written.
- AC7.13 Move with `p_move_adjustments=true` but zero movable rows at commit time → no batch, no rows, task moved.
- AC7.14 Reusing an existing batch id → `adjustment_invalid`, nothing written (task not moved).

F8
- AC8.1 A bar whose visible span is 1 day shows cut code and type code on two lines, no grip; resize handles appear on hover/focus only.
- AC8.2 Hovering any bar ≥ 400 ms shows a card: cut · type code + label, dates + day count, progress %, assignee; never while dragging or on touch.

Global
- AC-G1 `npx.cmd tsc --noEmit`, `npm run lint`, `npm test` pass; `npm run build` succeeds.
- AC-G2 en/vi dictionaries have identical key sets.

---

## 4. Implementation steps (waves)

Routing: Contract `—` → `sonnet-executor`, else `opus-executor`. Each executor row gets a separate `opus-executor` reviewer. Max 4 agents alive. tsc may be red between A1–A4 and A5 (new DB types); the compile gate runs after A5.

### Wave A (parallel; disjoint files)

| ID | Deps | Files (sole owner) | Contract | Acceptance |
|----|------|--------------------|----------|------------|
| A1 | — | TR/dates.ts, TR/__tests__/dates.test.ts | `assignLanes<T extends {start_date: ISODate; end_date: ISODate; cut_id?: string \| null}>(tasks: T[]): Map<T, number>` (same name; callers untouched). Block = input tasks with the same non-null `cut_id`; span = [min start, max end]; sort blocks by (start, end, cut_id ?? '', first input index); first-fit lane where `laneEnd < block.start`; every task of a block gets its lane. Add `parseMonthInput(text: string): string \| null` (trim, lowercase, strip leading `tháng`/`thg`/`t`; `M[sep]YYYY`, `M[sep]YY` → 20YY, `YYYY[sep]M`; sep ∈ `/ - . space`; result must pass `isValidMonth`) and `shiftMonth(m: string, n: number): string`. | AC2.2, AC6.1 |
| A2 | — | new `supabase/migrations/<ts>_tracker_v23_move_task.sql` (NOT applied), src/lib/tracker/mailPlan.ts (+test), src/app/api/tracker/cron/route.ts, TR/emails/TrackerEmails.tsx | SQL: (1) `alter table public.tracker_notice_queue add column removed jsonb not null default '[]'`. (2) Replace `private.tracker_enqueue_notice()` (keep `security definer`, `search_path=''`, triggers unchanged): NEW upsert unchanged; additionally when `TG_OP='UPDATE' and old.staff_id is distinct from new.staff_id`, upsert the OLD staff row with the same `due_at`/`generation+1`/`claimed_until=null` rules and `removed = q.removed \|\| jsonb_build_array(snapshot)` (snapshot from `tracker_projects`/`tracker_cuts`/`tracker_work_types` by old ids; insert path `removed = jsonb_build_array(snapshot)`, `task_ids = '{}'`, `cycle_id` omitted so the column default gives a fresh cycle). (3) `public.tracker_move_task(p_task uuid, p_expected_version int, p_staff uuid, p_start date, p_end date, p_move_adjustments boolean, p_op uuid, p_reason text) returns setof public.tracker_tasks`, plpgsql, SECURITY INVOKER, `search_path=''`. Order: plain `select project_id, staff_id, cut_id, work_type_id` of the task (no row lock; task absent → `return;`) → `pg_advisory_xact_lock(hashtextextended(project_id::text,0))` → target staff missing or archived → `raise exception 'staff_archived'` → versioned `update tracker_tasks set staff_id=p_staff, start_date=p_start, end_date=p_end where id=p_task and version=p_expected_version returning *` into a variable; no row → `return;` (empty set, nothing written; the action reselects → conflict) → only then, if `p_move_adjustments` and old ≠ new staff: collect movable rows (project, cut, type, old staff, `reverses_id is null`, no row with `reverses_id = id`); if count > 0: `insert into tracker_adjustment_batches(id, project_id, reason) values (p_op, …) on conflict (id) do nothing`, and if no row was inserted → `raise exception 'adjustment_invalid'` (rolls back the task update too); insert per row a reversal (old staff, −amount, reverses_id) and a copy (new staff, amount, reason) → `return next` the updated task row. Revoke from anon/public, grant to authenticated (V2:585-596 pattern); revoke EXECUTE on the private function (HARD:1-17 pattern). TS: `RemovedMailTask = {task_id, project_name, cut_code, type_code, type_label, start_date, end_date}`; `NoticeRow.removed: RemovedMailTask[]`; `planDigest` returns `{send, changed, others, removed}` — `removed` = entries deduped by `task_id` (last wins) whose `task_id` is not among the recipient's loaded tasks; send when `changed.length \|\| removed.length`. Route: parse `n.removed` with an `Array.isArray` + field-type guard (drop malformed entries). `assignmentMail({staffName, changed, others, removed})` adds a "Đã chuyển khỏi bạn" table (TaskTable style). Update the mailPlan fixture (`removed: []`). | SQL reviewed; AC7.8, AC7.9 (render check), existing trackerMail tests green |
| A3 | — | GB/CreateTaskPopover.tsx, GB/MonthNav.tsx, new GB/wheelHandoff.ts (+test), src/i18n/dictionaries/{en,vi}.json | (a) Autocomplete: `openOnFocus={false}`, `maxDropdownHeight={180}`, keep `data-autofocus` and `withinPortal:false`; track `listOpen` via `onDropdownOpen/onDropdownClose`; Popover `closeOnEscape={!listOpen}`. (b) MonthNav props `{month: string; onNavigate?: (m: string) => void}` (fallback: own `router.push`, so GanttBoard compiles until B2); prev/next via `shiftMonth`; label = `UnstyledButton` opening a Mantine `Popover` with `TextInput` (data-autofocus, placeholder, error) + `MonthPicker` (value = current month; locale comes from the existing DatesProvider) + "This month"; Enter → `parseMonthInput` → navigate + close. (c) `wheelHandoff.ts`: `normalizeWheel({deltaX, deltaY, deltaMode}, pageHeight): {dx, dy}`; `canConsume(m: ScrollMetrics, dx, dy): boolean` with `ScrollMetrics = {scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth, overflowX, overflowY, isDocument}` (consumable only if overflow auto/scroll or `isDocument`, and room in that direction); `useWheelHandoff(scrollRef: RefObject<HTMLElement \| null>, enabled: boolean)` registers one `document` `wheel` listener `{passive:false}`: return on `ctrlKey`, `defaultPrevented`, target inside the grid, target inside `[aria-modal="true"]`; walk ancestors (incl. portal parents) up to `document.documentElement`; any `canConsume` → return; else if the grid `canConsume` → `scrollBy({left: dx, top: dy})` + `preventDefault()`. (d) All §6 dictionary keys in en + vi. | AC4.1-4.4, AC5.4, AC-G2 |
| A4 | — | GB/TaskBar.tsx, new GB/TaskBar.module.css, GB/useBarDrag.ts, GB/dragMath.ts (+test) | useBarDrag args add `staffId: string`, `onMove?(target: {staff_id: string; start_date: ISODate; end_date: ISODate}, baseline: number): void`; returns add `dropStaffId: string \| null`, `dy: number`, `wasDrag(): boolean` (true once after a gesture whose pointer travelled ≥ 4 px on either axis at any time — latched per gesture, reset on read and on the next pointerdown). Only `move` mode tracks Y: on pointermove, `targetStaff(document.elementsFromPoint(x, y), staffId)` where `targetStaff(els, own)` returns the `data-staff-id` of the first element with `data-drop="1"` whose id ≠ own, else null (pure, tested). Pointerup: `dropStaffId` → `onMove({staff_id: dropStaffId, ...applyDrag(base, mode, delta)}, version)`, never `onCommit`; else existing `onCommit` path. TaskBar: optional props `staffName?`, `onMove?`, `onDropTarget?(staffId \| null)`; `onClick` returns early when `wasDrag()`; while a foreign row is targeted the bar gets `transform: translateY(dy)` + raised z-index; `narrow` = visible span < 2 days → two lines (bold cut code / type code, 10 px), no grip, 6 px handles shown on `:hover`/`:focus-visible` — styles in TaskBar.module.css. Wrap in Mantine `Tooltip` (multiline, `openDelay={400}`, `events={{hover:true, focus:false, touch:false}}`, `disabled={preview != null}`); TaskBar forwards the Tooltip's ref and event handlers to the `<button>`, merging them with the useBarDrag pointer handlers (both run; drag handlers are never overridden). Card: cut · type code + label, `dd/MM – dd/MM · n days`, progress %, staffName. | AC1.2, AC1.2b (unit on the latch), AC7.1 (targetStaff tests), AC8.1-8.2 |

**Gate A** (orchestrator): reviews pass → **owner approval to apply the migration live** (decision-gated).

| ID | Deps | Task | Contract | Acceptance |
|----|------|------|----------|------------|
| A5 | A2 + owner OK | Apply migration, regen types | — | Supabase MCP `apply_migration`; file renamed to the live version; `get_advisors` security empty; `generate_typescript_types` → `src/types/database.types.ts`; supazod regen; `tsc` green except props consumed in B |

### Wave B (B1 ‖ B2; B3 after both)

| ID | Deps | Files | Contract | Acceptance |
|----|------|-------|----------|------------|
| B1 | A5 | ACT, TR/errors.ts, TR/pay.ts (+test), new GB/MoveDialog.tsx | ACT `moveTask(input: {id; expected_version: int; staff_id; start_date; end_date; move_adjustments: boolean; op_id: uuid; reason: string(3..500)}): Promise<ActionResult<Task>>` via `writeVersioned` with `supabase.rpc('tracker_move_task', {...}).maybeSingle()` (empty → reselect → conflict / not_found); zod refines dates ordered. errors.ts: P0001 `staff_archived` → new `TrackerError` `'staff_archived'`. pay.ts: `movableAdjustments<A extends {id: string; staff_id: string; cut_id: string; work_type_id: string; amount: number; reverses_id: string \| null}>(rows: A[], key: {staff_id; cut_id; work_type_id}): A[]` — the SQL rule (non-reversal rows of the key that no row reverses) + tests. MoveDialog props `{opened; projectId; task; cutCode; workType; fromName; toName; dates: {start; end} \| null; onCancel(); onConfirm(moveAdjustments: boolean)}`; on open loads rows for (project, cut, type, old staff) with the browser client (`src/utils/supabase/client.ts`), runs `movableAdjustments`; loading → none (no choice) or count + net formatted like CutDrawer with a required radio; Confirm disabled until loaded/chosen. Plain Mantine `Modal` (TaskPanel.tsx:258 pattern). | movableAdjustments tests; three dialog states seen in E2E |
| B2 | A1, A3, A4, B1 interface | GB/GanttBoard.tsx, GB/TaskPanel.tsx, GB/GanttBoard.module.css | **F1**: `onSelect(id)` → `selectedId === id ? requestClose() : requestSelect(id)`; both check `panelDirtyRef.current`; dirty → `pendingNav: {kind:'close'} \| {kind:'select'; id}` and TaskPanel shows an inline Discard / Keep editing prompt; TaskPanel gets `onClose` + header `CloseButton` (`t.closePanel`); `selected === null` → panel not rendered (Mantine `Transition`, 150 ms, `slide-left`; during the exit the panel renders from a `lastSelected` ref so the empty state never flashes), `.card` fills. Window `keydown` Esc while selected: skip if `defaultPrevented`, target is input/textarea/select/contenteditable, inside `[aria-modal="true"]`/`[role=listbox]`/`.mantine-Popover-dropdown`, or the New Task popover is open (`drag.draft?.open`). **F3**: first a 10-minute dev spike: does `startTransition(() => router.push(...))` keep `isPending` true until the new board mounts? Yes → skeleton = `navPending`; no → skeleton = `pendingMonth !== null` (state cleared by the remount) + 20 s safety reset. While pending: header days from `monthRange(pendingMonth)`, each row keeps its height and renders 1–2 Mantine `Skeleton` bars at offsets from a hash of the staff id, track handlers off, panel hidden, presence hover off. Pass `onNavigate` and `month={pendingMonth ?? month}` to MonthNav (two quick clicks step two months). **F5**: `ref` on `.scroll`; `useWheelHandoff(scrollRef, !pending)`. **F7**: `.track` gets `data-staff-id={s.id}`, `data-drop={active ? '1' : undefined}`, `.dropTarget` class for the current target (from TaskBar `onDropTarget`); TaskBar `onMove` and the TaskPanel assignee Select (new `onReassign(staffId)` prop replacing `update({staff_id})`) both set `moveDraft: {task, staff_id, start, end, baseline}` → `MoveDialog`; confirm → `commit(task.id, baseline, {patch: {staff_id, start_date, end_date}}, (v) => moveTask({id, expected_version: v, staff_id, start_date, end_date, move_adjustments, op_id, reason: fill(t.moveReason, …)}), (row) => store.apply({kind:'ack', id: task.id, row}), {typeId: task.work_type_id})` with `op_id = crypto.randomUUID()` generated once per confirmation; `failText` maps `staff_archived` → `t.moveArchived`; cancel → clear draft (Select shows the stored value again). **F8**: pass `staffName`. | AC1.1-1.5, AC3.1-3.3, AC5.1-5.3, AC7.2-7.6; tsc/lint/test green |
| B3 | B1, B2 | CLAUDE.md | — | Tracker section: v2.3 migration listed; `tracker_move_task` in RPCs; queue `removed`; lanes-by-cut rule; wheel hand-off; one reassign path; new test files in the Tests line; `nextjs-agent-rules` block kept |

### Wave C — verification
- C1 Reviewer per executor row (B2 reviewer also reads B1).
- C2 E2E (`sonnet-executor`, orchestrator-written brief after Gate B): debug Chrome :9222 + dev :3300, project with ≥ 20 cuts, two tabs for realtime, viewports 1440×900 and 900×800. Cases = every E2E AC; screenshots to `.omc/e2e/v2.3/`. Data: disposable tasks/adjustments with reason `[E2E]`; clean up (delete tasks, reverse adjustments); never call the cron route; SQL checks SELECT-only via `execute_sql`.
- C3 Orchestrator gate: full `npm test`, `tsc`, `lint`, `build` in background; HTML E2E report artifact.

---

## 5. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Click-after-drag toggles the panel | `wasDrag()` latch at 4 px either axis; AC1.2/1.2b |
| Lock vs row-lock deadlock in the RPC | Plain SELECT (no row lock) then advisory lock before any write, as in `tracker_create_task`; `writeRow` retries 40P01 once |
| Double or phantom adjustment move | Batch only when movable count > 0; existing batch id → `adjustment_invalid` (whole tx rolls back); `reverses_id` UNIQUE; `op_id` generated once per confirmation; AC7.12-7.14 |
| Ledger changes between dialog and confirm | RPC recomputes movable rows at commit; "keep"/no-choice passes `false` → nothing moves |
| Move to archived staff | Drop targets exclude archived rows; panel list already excludes them (TaskPanel.tsx:79); RPC raises `staff_archived` |
| Order trigger rejects new dates | Existing `order_conflict` mapping |
| Lanes reflow mid-drag | Lanes from `shown` (stored/optimistic); preview lives in useBarDrag |
| Target row off-screen | Wheel still scrolls the grid during a drag; target re-evaluated on pointermove; auto-scroll is a follow-up |
| Document wheel listener cost / hijack | Early returns; mounted only on the Schedule tab; modal + Ctrl excluded; consumability first |
| Duplicate removed lines | planDigest dedupes by task_id (AC7.8) |
| `isPending` semantics | B2 spike + remount-cleared fallback + 20 s reset |
| tsc red mid-wave | New props optional; compile gate after A5; B2 wires the rest |
| Migration without approval | Decision-gated A5 |

---

## 6. New dictionary keys (`tracker.board.*`, en + vi, added in A3)
`closePanel`, `discardTitle`, `discardBody`, `discard`, `keepEditing`, `jumpMonth` (aria), `monthPlaceholder` ("MM/YYYY"), `monthInvalid`, `thisMonth`, `moveTitle`, `moveBody` ("Move {cut} · {type} from {from} to {to}?"), `moveDates` ("New dates: {start} – {end}"), `moveAdjChecking`, `moveAdjFound` ("{n} bonus/penalty entries, net {total}"), `moveAdjMove`, `moveAdjKeep`, `moveConfirm`, `moveReason` (vi "Chuyển {cut} · {type} từ {from} sang {to}"), `moveArchived`, `hoverDays` ("{n} days"), `hoverProgress`, `hoverAssignee`, `loading` (sr-only). Reuse an existing `cancel` key if present.

---

## 7. Verification steps
1. `npm test`: dates.test.ts (lanes, parseMonthInput, shiftMonth), wheelHandoff.test.ts, dragMath.test.ts (targetStaff, wasDrag latch if extracted), pay.test.ts (movableAdjustments), mailPlan.test.ts (removed, dedupe).
2. `npx.cmd tsc --noEmit`, `npm run lint`, `npm run build` (background).
3. SQL: `get_advisors` security empty; SELECT checks for AC7.5, 7.7, 7.11-7.14 during E2E.
4. E2E report per AC with screenshots.

---

## ADR
- **Decision:** atomic `tracker_move_task` RPC used by both reassign paths (drag + panel Select) behind one confirm dialog; trigger-side "removed" snapshot in the notice queue; lanes grouped by cut in `assignLanes`; document-level wheel hand-off by consumability; Autocomplete `openOnFocus={false}`; skeleton via transition (verified) or remount-cleared pending month.
- **Drivers:** pay correctness, no sync regression, small diff in the board file.
- **Alternatives considered:** two-call reassign (non-atomic); plain `updateTask` reassign without adjustment handling; audit-log-based removed lines; first-stage lane pinning; CSS-only scrolling; controlled Autocomplete dropdown (reopens after pick — Critic C1).
- **Why chosen:** see §2; each rejected option fails driver 1 or 2, or an owner decision.
- **Consequences:** one migration (queue column, trigger change, new RPC, grants); types regen; the share page adopts the lane rule; rows can get taller where a person's cut stages have a gap worked by someone else; MonthNav delegates navigation to the board; panel reassign now asks for confirmation.
- **Follow-ups:** share-page narrow bars, drag auto-scroll, delete notices, zoom levels.

## Changelog
- r1 (2026-10-02): first draft from owner decisions D1–D8.
- r2 (2026-10-02): applied Architect AR1–AR5, Critic C1–C12, Codex X1–X5, X7–X10 (X6 rejected, C13 superseded) — see review log. Main changes: one reassign path (panel Select → MoveDialog); `openOnFocus={false}` instead of a controlled dropdown + `closeOnEscape={!listOpen}`; RPC batch only when movable rows exist and existing batch id rejected; `onMove` carries `staff_id`; 4 px drag latch; planDigest dedupe; wheel rule by consumability (only modals excluded); file ownership fixed (MonthNav → A3, new TaskBar.module.css); `staff_archived` message; isPending spike + fallback; negative ACs 7.11–7.14; hedges removed (dates setup, share cut_id).
- r3 (2026-10-02): Critic round 2 (APPROVE WITH CHANGES) minors applied: Esc skips the New Task popover; MonthNav gets `pendingMonth ?? month`; panel exit renders from `lastSelected`; OLD-row insert omits `cycle_id`; Tooltip handlers merged with drag handlers; AC4.3 asserts `onDropdownClose`.
