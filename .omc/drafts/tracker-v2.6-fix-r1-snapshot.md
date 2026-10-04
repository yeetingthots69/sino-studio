# Tracker v2.6: fix tasks (aid / fix a stage of a cut)

Status: **r1 DRAFT — pending review / pending approval.** Consensus planning (`/plan --consensus --interactive`). Execution after approval runs through `/orchestrate-with-subagents`, at most 3 subagents at a time. No git writes: the owner commits. One migration; it is applied live only with the owner's OK (Gate A).

Paths: `TR/` = `src/components/tracker/`, `GB/` = `TR/GanttBoard/`, `CV/` = `TR/CutsView/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `V2` = `supabase/migrations/20260930065620_tracker_v2.sql`, `V23` = `…/20261002034325_tracker_v23_move_task.sql`, `V25` = `…/20261002125744_tracker_v25_overlap.sql`.

---

## 1. Requirements summary

**Owner request (2026-10-04).** Staff A does C1 LO (first stage); staff B must step in and fix A's LO work of C1, on any date (the same day as LO, during it, or after it). Today the studio added an FI ("Fix") work type at the end of the type list, so the pipeline order rule refuses an FI task on LO's dates.

**Owner decisions** (`.omc/drafts/tracker-v2.6-decisions.md`, decision page https://claude.ai/artifact/51bpUAjmRM4En5Pfc3FyGb):

| # | Question | Answer |
|---|----------|--------|
| Q0 | What a fix belongs to | One stage of a cut ("C1 LO fix"). Several fixes per stage allowed. |
| D1 | Pay | A fix pays nothing by itself. Managers use the existing bonus/penalty on that stage (C1 LO) for B and/or A. |
| D2 | Dates | Any dates. No date check. |
| D3 | Stage must exist | A fix can only be created when the stage task (non-fix task of that cut + type) exists. If the stage task is deleted later, its fixes stay. |
| D4 | Board look | Bar in B's row, stage colour, striped, labelled "C1 LO · Fix". A's bar unchanged. |
| D5 | Creating | Board create popover gets a "Fix" switch; the stage picker then lists only stages of that cut that have a stage task. |
| D6 | Existing FI type (Stillomatic 1+2: code FI, 0 %, 2 tasks) | Leave it; the owner cleans up by hand. The migration does not touch it. |
| D7 | Cuts page | Small read-only fix count on the stage cell. |
| D8 | Emails, ICS, share page/PNG | Fixes appear like normal tasks, with progress and links, labelled as fixes. |

**Current state (evidence):**
- Order rule: trigger `private.tracker_task_order` (V25:8-46), BEFORE INSERT/UPDATE on `tracker_tasks`, advisory lock (V25:20), `project_immutable` check at the top; compares every other task of the same cut by `sort_order`; applies to every type. Deferred constraint trigger `tracker_type_order` → `tracker_type_order_check()` (V25:49-87) self-joins tasks of a cut on type edits (raises `overlap_in_use`).
- Uniqueness: constraint `tracker_tasks_cut_type_key unique (cut_id, work_type_id)` (V2:213). Client maps 23505 → `duplicate` by code only (`TR/errors.ts:31`), not by name.
- `public.tracker_create_task(p_project, p_staff, p_type, p_cut_code, p_start, p_end, p_budget default null)` (V2:492; grants V2:587/594): ensures the cut, then plain insert (no ON CONFLICT). Called from `ACT:412 createTask` (schema `createTaskSchema` ACT:387, RPC call ACT:422).
- `public.tracker_move_task(...)` (V23:43) moves the old staff's open bonus/penalty rows matched by `(project_id, cut_id, work_type_id, staff_id)`. Client mirror `movableAdjustments` (`TR/pay.ts:97-106`).
- Version bump trigger fires on every UPDATE (V2:278). Audit stores `to_jsonb(row)`. Notice enqueue `private.tracker_enqueue_notice` (V23:7) snapshots removed tasks with `cut_code`/`type_code`.
- Realtime: `supabase_realtime` publishes `tracker_tasks` with an **explicit column list** (live `pg_publication_tables.attnames` = `id, project_id, staff_id, work_type_id, start_date, end_date, progress, created_at, updated_at, cut_id, version, links`). A new column is not published unless the list is reset.
- Grants on `tracker_tasks`: table-level only; RLS policy `tasks_rw` has no column logic → no grant change needed.
- One-task-per-stage assumptions in TS:
  - `CV/CutsView.tsx:80` `taskByStage` Map, `:85` `adjByStage`, `:242`, `:278`; `CV/BulkModal.tsx` via `BulkStage.key`; `CV/cutsViewHelpers.ts` `waitingFor`.
  - `TR/earnings.ts:28-31` `effectiveMonths` `taskMonth` keyed `cut:type` (last row wins).
  - `TR/pay.ts:46-70` `payLines` (one line per task, full stage amount), `:97-106` `movableAdjustments`.
  - `GB/CreateTaskPopover.tsx:74-86` (`used` set, `orderConflict` at :81), `GB/GanttBoard.tsx:921-923` `usedTypeIds` for the panel type chips, `TR/pipeline.ts:31-48` `orderConflict`.
- Explicit column lists on `tracker_tasks` (missing `is_fix` ⇒ silently `undefined`): `[projectId]/page.tsx:43` (stage index), `[projectId]/cuts/page.tsx:32`, `TR/Earnings/loadEarnings.ts:18`, `src/lib/tracker/shareData.ts:36` and `:65` (ICS), `src/app/api/tracker/cron/route.ts:23` `TASK_COLS`, `ACT:636` (sendResources), `ACT:687` (sendSchedule). Hand-picked types: `GB/GanttBoard.tsx:43` `StageRow`, `TR/pipeline.ts:3` `StageTask`, `TR/pay.ts:43` `PayTask`, `src/lib/tracker/mailPlan.ts:7,20` `MailTask`/`RemovedMailTask`, `TR/ics.ts:4` `IcsEvent`, `src/lib/tracker/shareShape.ts:49-53` + `ShareDto`, `GB/undoStack.ts:9-12` `TaskSnapshot`.
- Label building ("C1 · LO") is duplicated: `GB/TaskBar.tsx:54,79-81,103-109`, `TR/ScheduleGrid/ScheduleGrid.tsx:25` `name()`, `src/lib/tracker/schedulePng.tsx:75`, ICS route `src/app/api/tracker/ics/[token]/[staffId]/route.ts:15`, `TR/emails/TrackerEmails.tsx:74,105-106,170`, `TR/Earnings/views.tsx:85`.
- Panel can retype/recut any task: `GB/TaskPanel.tsx:168` (cut Autocomplete), `:186-192` (type chips); `taskPatch` (ACT:394) accepts `cut_code`, `work_type_id`.
- Undo: delete-undo re-creates via `createTask` (`GB/GanttBoard.tsx:608-640`) from `TaskSnapshot` (`GB/undoStack.ts:9-12`), which has no fix flag.
- UI strings come from `src/i18n/dictionaries/{en,vi}.json` (`tracker.board`, `tracker.cuts`, `tracker.common`); emails and the PNG keep their own Vietnamese text.

**Out of scope:** pay on the fix itself (D1); auto bonus/penalty; converting/deleting the existing FI type and its 2 tasks (D6); a marker on A's bar (D4); a "fix" entry point in the panel or the Cuts page (D5); blocking deletion of a stage task that has fixes (D3).

---

## 2. RALPLAN-DR summary

**Principles**
1. The DB stays authoritative: every fix exemption and rule is enforced in SQL; the client only mirrors it for early feedback.
2. A fix is a task. Reuse the task machinery (board, drag, panel, undo, realtime, taskSync, share, ICS, digest) instead of a parallel path.
3. Pay is computed only in `TR/pay.ts`; a fix can never add to a stage's pay or to the pay totals.
4. Rows that are not fixes behave exactly as today (order, uniqueness, pay, months, Cuts grid).
5. Smallest diff: one column, no new table, no new RPC.

**Decision drivers**
1. Parity with tasks on every surface (D8) without a second code path to keep in sync.
2. Correctness of the order rule and of pay/earnings when a stage has extra rows.
3. Low risk for a live-DB migration (additive column, constraint swap, function replacements).

**Options**

| | A. `is_fix` flag on `tracker_tasks` (fix row reuses the stage's `work_type_id`) | B. Separate `tracker_fixes` table | C. "Floating" work type (keep FI type, flag it exempt from order + uniqueness, add `fixes_type_id` on the task) |
|---|---|---|---|
| Pros | Every task surface works unchanged; stage colour/label free (D4); no project setup; one column | Zero risk to existing task invariants (unique/order untouched) | Keeps the owner's existing FI type; type list shows "Fix" |
| Cons | Every `cut:type` map must ignore fix rows; explicit column lists must add the column | Duplicates realtime, taskSync, undo, drag, panel, share DTO, ICS, digest, notice queue — contradicts D8 parity and P2 | Needs a per-project FI type with 0 % in the 100 % pay total; bar colour/label is FI not the stage (contradicts D4); still needs a target-stage column, so strictly more moving parts than A |

**Chosen: A.** B is invalidated by D8 + P2 (≥ 8 surfaces duplicated). C is viable but contradicts D4 and adds project setup and a second column; A covers the same need with one column.

**Pre-mortem (live migration)**
1. *Realtime column list not reset* → payloads lack `is_fix`; `taskSync` treats a fix as a stage task; Cuts/pay double-count after a realtime insert. Mitigation: migration step M5 + acceptance AC-SQL-7 (`pg_publication_tables.attnames` contains `is_fix`).
2. *An explicit select misses `is_fix`* → `undefined` ⇒ treated as a stage ⇒ fix pays the full stage amount. Mitigation: `payLines`/maps test `is_fix === true` only, and AC-GREP-1 lists every select; E2E case E5 checks Cuts totals with a fix present.
3. *`is_fix` flipped by a direct PostgREST update* → a fix becomes a duplicate stage (bypassing the partial unique) or a stage escapes the order rule. Mitigation: SQL raises `fix_immutable` on any `is_fix` change (AC-SQL-4).

---

## 3. Design

### 3.1 Data model (migration `<ts>_tracker_v26_fix.sql`)

- M1 `alter table public.tracker_tasks add column is_fix boolean not null default false;`
- M2 Drop constraint `tracker_tasks_cut_type_key`; create `unique index tracker_tasks_cut_type_key on public.tracker_tasks (cut_id, work_type_id) where not is_fix` (same name, so logs/docs stay valid; 23505 → `duplicate` mapping is by code and unchanged).
- M3 Replace `private.tracker_task_order()` (latest body V25:8-46). Contract, in this order:
  1. Advisory lock and the existing `project_immutable` check stay first, unchanged.
  2. `TG_OP = 'UPDATE' and new.is_fix is distinct from old.is_fix` → `raise exception 'fix_immutable'` (P0001).
  3. If `new.is_fix`: on INSERT, or on UPDATE where `cut_id` or `work_type_id` changed, require `exists (select 1 from tracker_tasks t where t.cut_id = new.cut_id and t.work_type_id = new.work_type_id and not t.is_fix)`, else `raise exception 'fix_no_stage'`. Then `return new` (no order check, D2).
  4. Otherwise the existing order logic, with `and not t.is_fix` added to the conflict search.
- M4 Replace `private.tracker_type_order_check()` (V25:49-87): exclude fix rows on both sides of the self-join (`not a.is_fix and not b.is_fix`).
- M5 `alter publication supabase_realtime set table public.tracker_tasks (id, project_id, staff_id, work_type_id, start_date, end_date, progress, created_at, updated_at, cut_id, version, links, is_fix)` — verify the current list live first; it must be the live list + `is_fix`. Other publication members are untouched (`set table` for one table replaces only that table's entry — the executor must confirm this against the PG docs; if `set table` would drop the other tables, use `drop table` + `add table (cols)` for `tracker_tasks` instead).
- M6 Replace `public.tracker_create_task`: `drop function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint)`; create the same function with an extra trailing `p_is_fix boolean default false` inserted into `is_fix`. Re-apply the V2:587/594 revoke/grant lines for the new signature. Body otherwise unchanged (the cut is still ensured first; a failed `fix_no_stage` rolls the cut insert back with the statement).
- M7 Replace `public.tracker_move_task` (V23:43): when the task row is a fix, the adjustment move is skipped even if `p_move_adjustments` is true (no batch is written). Everything else unchanged (version check, `staff_archived`, dates).
- M8 Replace `private.tracker_enqueue_notice` (V23:7): add `'is_fix', old.is_fix` to the `removed` snapshot object. Nothing else changes.
- `tracker_type_guard` unchanged: a type used only by fixes still counts as "in use" (correct: the fix would lose its stage).
- `get_advisors` (security) must stay empty after apply.

### 3.2 Pure modules (client mirror + pay)

- `TR/pipeline.ts`: `StageTask` gains `is_fix?: boolean`. `orderConflict` returns `null` when `candidate.is_fix`, and ignores rows with `is_fix` when searching. `typeRule` unchanged.
- `TR/pay.ts`: `PayTask` gains `is_fix?: boolean`. `payLines` emits **no line** for `is_fix === true` rows. `movableAdjustments` takes the task (or a flag) and returns `[]` for a fix (mirrors M7).
- `TR/earnings.ts`: `effectiveMonths` builds `taskMonth` from non-fix rows only (a bonus on C1 LO keeps the stage task's month).
- `TR/errors.ts`: new keys `FIX_NO_STAGE = 'fix_no_stage'`, `FIX_IMMUTABLE = 'fix_immutable'`; `TrackerError` gains `'fix_no_stage'`; `fix_immutable` maps to `'invalid'`. Every `TrackerError` → text switch gets the new case (board `failText` `GB/GanttBoard.tsx:303-309`, CutsView `errorText` near `CV/CutsView.tsx:98`).
- A shared label helper is **not** added: each label site appends the fix word itself (6 sites, different text sources).

### 3.3 Board

- `[projectId]/page.tsx:43` stage-index select adds `is_fix`; `StageRow` (`GB/GanttBoard.tsx:43`) adds `is_fix`.
- `GB/CreateTaskPopover.tsx`: new Mantine `Switch` "Fix" (dictionary `tracker.board.fixSwitch`), shown only when not `cutMode`. When on:
  - The cut must resolve to an existing cut (`cuts.find`); no new cut is created.
  - Type chips enabled = types that have a non-fix stage task in that cut; others disabled. If none, show `tracker.board.fixNoStage`.
  - No `orderConflict` call (D2); `ready` does not depend on it.
  - Submit adds `is_fix: true`.
  When off: `used` counts non-fix rows only (a fix never makes a stage look taken). Budget field hidden when the switch is on (the cut exists).
- `ACT createTask`: `createTaskSchema` gains `is_fix: z.boolean().optional()`; passes `p_is_fix: input.is_fix ?? false`. `taskPatch` does not accept `is_fix`.
- `GB/TaskBar.tsx`: fix rows get a `.fix` class in `TaskBar.module.css` (diagonal stripes from the stage colour via `repeating-linear-gradient` over the existing tint; progress fill still visible) and the visible type text `"{code} · {fix}"` with `fix` = `tracker.board.fix`. Hover card and aria-label (`barLabel`) also include it.
- `GB/TaskPanel.tsx`: for a fix, the cut Autocomplete and type chips render read-only (text "C1 · LO · Fix"); assignee/dates/progress/links unchanged. `usedTypeIds` (`GB/GanttBoard.tsx:921-923`) counts non-fix rows only.
- `MoveDialog` / reassign path: for a fix, `movableAdjustments` returns `[]`, so no "move bonus/penalty" option appears (mirrors M7).
- Undo: `TaskSnapshot` (`GB/undoStack.ts:9-12`) gains `is_fix`; delete-undo passes it to `createTask` (`GB/GanttBoard.tsx:608-640`). Every place that builds a snapshot from a row copies `is_fix`.
- Realtime/taskSync: no code change (row type comes from `Tables<'tracker_tasks'>`; payload carries `is_fix` after M5).

### 3.4 Cuts page

- `[projectId]/cuts/page.tsx:32` and `TR/Earnings/loadEarnings.ts:18` selects add `is_fix`.
- `CV/CutsView.tsx`: `taskByStage` (`:80`) built from non-fix tasks only; new `fixCount: Map<stageKey, number>` from fix tasks; filled stage cell (`:292-310`) shows `tracker.cuts.fixCount` ("{n} fix") when > 0, read-only. Pay totals use `payLines` (fixes already excluded). The cutMode `CreateTaskPopover` receives `stages={tasks}`; its `used` already ignores fixes (3.3).
- BulkModal unchanged (it works off `taskByStage`).

### 3.5 Share page, PNG, ICS, emails

- `src/lib/tracker/shareData.ts:36,65` selects add `is_fix`; `shareShape.ts` forwards `is_fix`; `ShareDto` task type gains it.
- `ScheduleGrid.tsx` `name()` (`:25`) appends " · Fix" for fixes; bar style adds the same stripe (inline `repeating-linear-gradient`).
- `schedulePng.tsx:73-91`: label suffix + inline stripe. If Satori cannot render `repeating-linear-gradient`, keep only the label suffix and report it (no workaround code).
- ICS route `:15`: summary `"{cut} · {type} · Fix"` for fixes.
- Cron `TASK_COLS` (`cron/route.ts:23`) adds `is_fix`; `MailTask`/`RemovedMailTask` gain `is_fix`; `REMOVED_FIELDS` (`:36`) includes it; `TrackerEmails.tsx:74,170` append " · Fix"; `ACT:636` and `:687` selects add `is_fix` and their label text appends " · Fix"; `TrackerEmails.tsx:105` key becomes the task id (stage + fix in one cut would collide).
- The word is "Fix" in both locales (the studio's own term; owner chose the label "C1 LO · Fix").

### 3.6 Dictionaries (`en.json` + `vi.json`, same keys)

`tracker.board.fix` = "Fix"; `tracker.board.fixSwitch` = "Fix a stage" / "Sửa công đoạn (Fix)"; `tracker.board.fixNoStage` = "This cut has no stage task to fix" / "Cut này chưa có công đoạn nào để sửa"; `tracker.board.fixNoStageError` (for `fix_no_stage`) = "The stage to fix has no task" / "Công đoạn cần sửa chưa có task"; `tracker.cuts.fixCount` = "{n} fix" / "{n} fix".

---

## 4. Acceptance criteria

SQL (run in a transaction that is rolled back, or on throwaway rows cleaned up after; as an authenticated tracker user where RLS matters):
- AC-SQL-1 With C1 LO (A, 10–14) and C1 GE (12+ forbidden today), inserting a fix (B, C1, LO, 10–10) succeeds; a second fix for C1 LO (C, 20–25) succeeds.
- AC-SQL-2 A fix of C1 LO dated after C1 GE starts succeeds; inserting/moving a non-fix GE task still raises `order_conflict` against the LO stage task exactly as before; fix rows are never named as the conflicting task.
- AC-SQL-3 A fix of C1 GE when C1 has no GE stage task raises `fix_no_stage`, and the RPC with a new cut code leaves no new cut behind.
- AC-SQL-4 `update tracker_tasks set is_fix = true` on a stage task (and the reverse) raises `fix_immutable`.
- AC-SQL-5 A second non-fix C1 LO task still raises 23505.
- AC-SQL-6 Deleting the C1 LO stage task while a fix exists succeeds; the fix remains.
- AC-SQL-7 `pg_publication_tables` for `tracker_tasks` lists `is_fix`; every other table in `supabase_realtime` is still published.
- AC-SQL-8 `tracker_move_task(fix, …, p_move_adjustments := true)` with an open bonus for the fix's old staff on that stage moves the task and writes no adjustment batch.
- AC-SQL-9 Making a type overlappable / reordering types is not blocked by fix rows alone (`tracker_type_order_check` ignores fixes).
- AC-SQL-10 `get_advisors` security returns no new findings; old 7-arg `tracker_create_task` no longer exists; new one has the same grants.

Unit (Vitest, `npm test` green, `npx.cmd tsc --noEmit` clean, `npm run lint` clean):
- AC-U1 `pipeline.test.ts`: `orderConflict` returns null for a fix candidate; a fix row of an earlier type never blocks a later candidate.
- AC-U2 `pay.test.ts`: `payLines` emits no line for a fix; totals equal the same data without the fix; `movableAdjustments` returns `[]` for a fix.
- AC-U3 `earnings.test.ts`: a bonus on C1 LO lands in the stage task's month even when a later-dated fix of C1 LO exists.
- AC-U4 `shareShape.test.ts`: `is_fix` is forwarded.
- AC-U5 `errors` mapping: `fix_no_stage` → `'fix_no_stage'`, `fix_immutable` → `'invalid'`.

Grep:
- AC-GREP-1 Every explicit `tracker_tasks` select listed in §1 includes `is_fix` (or is `*`).

E2E (debug Chrome on :9222, local dev, throwaway project or cut `E2E-FX`):
- E1 Board: with C1 LO (A) and C1 GE (A) scheduled, create a fix on B's row on LO's first day via the Fix switch → bar appears striped, LO colour, "LO · Fix"; no order error.
- E2 Fix switch on a cut with no stage tasks shows `fixNoStage`, submit disabled.
- E3 Drag/resize the fix across GE's dates → saves (no order error); undo/redo works; delete + undo re-creates it as a fix (still striped).
- E4 Panel on the fix: cut/type read-only; progress and links edit; reassign to C shows no bonus/penalty move option.
- E5 Cuts page: LO cell shows "1 fix"; stage pay badge and totals unchanged vs. before the fix; GE cell unaffected.
- E6 Share page and PNG show the fix with the suffix (and stripes where supported); ICS feed for B contains "C1 · LO · Fix".
- E7 Second tab: creating a fix in tab 1 appears striped in tab 2 via realtime without reload.
- E8 Digest preview (mail plan or cron dry run, no real email): fix listed with " · Fix".

---

## 5. Execution plan (after approval; max 3 subagents at once)

| ID | Deps | Task | Agent | Contract | Acceptance |
|----|------|------|-------|----------|-----------|
| A1 | — | Migration file `supabase/migrations/<ts>_tracker_v26_fix.sql` (M1–M8), written, not applied | opus-executor | §3.1 | File reviewed in R1 |
| GATE A | A1 | Owner OK → main session applies via `apply_migration` (subagents are denied it), confirms the file name matches the live version | orchestrator | — | `list_migrations` shows it |
| A2 | Gate A | SQL acceptance run (AC-SQL-1…10) + types regen (`generate_typescript_types` → `src/types/database.types.ts`; `npx supazod …`) | opus-executor | §4 SQL | All AC-SQL pass, test rows removed |
| B1 | A2 | Pure modules + tests + errors + dictionaries (§3.2, §3.6) | opus-executor | §3.2 | AC-U1…U3, U5 |
| B2 | A2 | Board + actions (§3.3, ACT changes incl. `:636`/`:687` selects + labels) | opus-executor | §3.3 | tsc/lint clean |
| B3 | A2 | Cuts page, share, PNG, ICS, cron, email templates (§3.4, §3.5) | opus-executor | §3.4–3.5 | AC-U4, AC-GREP-1 |
| R1 | each row | Fresh reviewer per wave ("are there any bugs in this?") | opus-executor | — | No open defects |
| E | B1–B3, R1 | E2E E1–E8 per orchestrator brief | sonnet-executor | §4 E2E | Pass table + evidence in `.omc/e2e/v2.6/` |
| D | E | CLAUDE.md tracker section (is_fix rules, new error keys, migration name, publication column list), memory | sonnet-executor | — | Docs match code |

File ownership in wave B: dictionaries and `errors.ts` only in B1; `ACT` only in B2; `CutsView`, share/PNG/ICS/cron/emails only in B3. B2 and B3 both rely on B1's dictionary keys (fixed in §3.6, so they can run in parallel).

---

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Publication `set table` semantics drop other tables | M5 note; AC-SQL-7 checks all members |
| An explicit select forgets `is_fix` ⇒ double pay | `=== true` checks; AC-GREP-1; E5 |
| Old `tracker_create_task` overload left behind | M6 drops the exact 7-arg signature; AC-SQL-10 |
| Fix moved with adjustments steals the stage's bonus rows | M7 + client mirror; AC-SQL-8, E4 |
| Orphan fixes after the stage task is deleted (accepted by D3) | Shown on board as usual; Cuts empty cell shows no count (accepted) |
| Satori lacks repeating gradients | Label suffix still identifies the fix (§3.5) |
| Existing FI type left as is (D6) | Owner cleans up; no code assumes it is gone |

---

## 7. Verification steps

1. `npm test`, `npx.cmd tsc --noEmit`, `npm run lint` — all green.
2. AC-SQL-1…10 via `execute_sql` with cleanup.
3. E2E E1–E8 with evidence under `.omc/e2e/v2.6/`.
4. `get_advisors` (security) empty.

---

## ADR (draft — finalized after review)

- **Decision:** Option A — `tracker_tasks.is_fix` flag; a fix reuses its stage's `work_type_id`, is exempt from order and from the per-stage unique, requires an existing stage task, pays nothing.
- **Drivers:** task-parity on all surfaces (D8); correctness of order and pay; low-risk live migration.
- **Alternatives considered:** B separate table (rejected: duplicates every task surface); C floating FI work type (rejected: contradicts D4 stage colour, adds project setup and a target column).
- **Why chosen:** one column reuses all existing task machinery; exemptions live in two SQL functions and three pure TS functions.
- **Consequences:** every `cut:type` keyed map must skip fix rows; explicit selects must carry `is_fix`; the realtime column list grows.
- **Follow-ups:** owner removes the FI type (D6); optional marker on A's bar; optional fix creation from the panel.

## Changelog
- r1 (2026-10-04): first draft from owner decisions D1–D8 and two fact passes.
