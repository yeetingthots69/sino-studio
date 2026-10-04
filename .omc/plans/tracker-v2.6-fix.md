# Tracker v2.6: fix tasks (aid / fix a stage of a cut)

Status: **DONE 2026-10-04.** Built, reviewed and E2E-verified (`.omc/e2e/v2.6/e2e-v2.6-results.md`); migration `20261004081552_tracker_v26_fix` applied live with the owner's OK; uncommitted. Consensus planning (`/plan --consensus --interactive`). Review log: `.omc/drafts/tracker-v2.6-review-r1.md`. Execution after approval runs through `/orchestrate-with-subagents`, at most 3 subagents at a time. No git writes: the owner commits. One migration; it is applied live only with the owner's OK (Gate A).

Paths: `TR/` = `src/components/tracker/`, `GB/` = `TR/GanttBoard/`, `CV/` = `TR/CutsView/`, `LT/` = `src/lib/tracker/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `CRON` = `src/app/api/tracker/cron/route.ts`, `V2` = `supabase/migrations/20260930065620_tracker_v2.sql`, `V23` = `…/20261002034325_tracker_v23_move_task.sql`, `V25` = `…/20261002125744_tracker_v25_overlap.sql`.

---

## 1. Requirements summary

**Owner request (2026-10-04).** Staff A does C1 LO (first stage); staff B must step in and fix A's LO work of C1, on any date (the same day as LO, during it, or after it). Today the studio added an FI ("Fix") work type at the end of the type list, so the pipeline order rule refuses an FI task on LO's dates.

**Owner decisions** (`.omc/drafts/tracker-v2.6-decisions.md`, decision page https://claude.ai/artifact/51bpUAjmRM4En5Pfc3FyGb):

| # | Question | Answer |
|---|----------|--------|
| Q0 | What a fix belongs to | One stage of a cut ("C1 LO fix"). Several fixes per stage allowed. |
| D1 | Pay | A fix pays nothing by itself. Managers use the existing bonus/penalty on that stage (C1 LO) for B and/or A. |
| D2 | Dates | Any dates. No date check. |
| D3 | Stage must exist | A fix can only be created when the stage task (non-fix task of that cut + type) exists. If the stage task is later deleted (or moved to another cut/type), its fixes stay. |
| D4 | Board look | Bar in B's row, stage colour, striped, labelled "C1 LO · Fix". A's bar unchanged. |
| D5 | Creating | Board create popover gets a "Fix" switch; the stage picker then lists only stages of that cut that have a stage task. |
| D6 | Existing FI type (Stillomatic 1+2: code FI, 0 %, 2 tasks) | Leave it; the owner cleans up by hand. The migration does not touch it. |
| D7 | Cuts page | Small read-only fix count on the stage cell. |
| D8 | Emails, ICS, share page/PNG | Fixes appear like normal tasks, with progress and links, labelled as fixes. |
| D9 | Month of a bonus/penalty on a fixed stage | If the adjustment's staff has a fix on that stage: end month of their latest fix. Otherwise the stage task's month (today's rule). |

**Current state (evidence):**
- Order rule: trigger `private.tracker_task_order` (V25:8-46), BEFORE INSERT/UPDATE on `tracker_tasks`, advisory lock (V25:20), `project_immutable` check at the top; compares every other task of the same cut by `sort_order`; applies to every type. Deferred constraint trigger `tracker_type_order` → `tracker_type_order_check()` (V25:49-87, initially deferred V25:86) self-joins tasks of a cut on type edits (raises `overlap_in_use`).
- `private.tracker_type_guard` (V2:292-316) blocks deleting a used type and changing a used type's `sort_order` (`type_in_use`, V2:304).
- Uniqueness: constraint `tracker_tasks_cut_type_key unique (cut_id, work_type_id)` (V2:213). Client maps 23505 → `duplicate` by code only (`TR/errors.ts:31`), not by name.
- `public.tracker_create_task(p_project, p_staff, p_type, p_cut_code, p_start, p_end, p_budget default null)` (V2:492; revoke/grant V2:587/594): ensures the cut, then plain insert (no ON CONFLICT). Called from `ACT:412 createTask` (schema `createTaskSchema` ACT:387, RPC call ACT:422).
- `public.tracker_move_task(...)` (V23:43) optionally (`p_move_adjustments`) moves the old staff's open bonus/penalty rows matched by `(project_id, cut_id, work_type_id, staff_id)` (V23:68-73). The client shows the count and lets the manager choose in `MoveDialog`, using `movableAdjustments` (`TR/pay.ts:97-106`).
- Version bump trigger fires on every UPDATE (V2:278). Audit stores `to_jsonb(row)`. Notice enqueue `private.tracker_enqueue_notice` (V23:7) snapshots removed tasks with string fields; `CRON:36-41` keeps a snapshot only if every `REMOVED_FIELDS` key is a string.
- Realtime: every `supabase_realtime` member, `tracker_tasks` included, has **no column list** (live `pg_publication_rel.prattrs` is NULL for all 9 members), so a new column is published automatically. No publication change is needed.
- Grants on `tracker_tasks`: table-level only; RLS policy `tasks_rw` has no column logic → no grant change.
- One-task-per-stage assumptions in TS:
  - `CV/CutsView.tsx:80` `taskByStage` Map, `:85` `adjByStage`, `:242`, `:278`; `CV/BulkModal.tsx` via `BulkStage.key`; `CV/cutsViewHelpers.ts` `waitingFor`.
  - `TR/earnings.ts:24-36` `effectiveMonths` `taskMonth` keyed `cut:type` (last row wins).
  - `TR/pay.ts:46-70` `payLines` (one line per task, full stage amount).
  - `GB/CreateTaskPopover.tsx:74-86` (`used` set, `orderConflict` at :81), `GB/GanttBoard.tsx:921-923` `usedTypeIds` for the panel type chips, `TR/pipeline.ts:31-48` `orderConflict`.
- Explicit column lists on `tracker_tasks` (a missing `is_fix` is silently `undefined`): `[projectId]/page.tsx:43` (stage index), `[projectId]/cuts/page.tsx:32`, `TR/Earnings/loadEarnings.ts:18`, `LT/shareData.ts:36` and `:65` (ICS), `CRON:23` `TASK_COLS`, `ACT:636` (sendResources), `ACT:687` (sendSchedule).
- Field-by-field adapters and hand-picked types: `GB/GanttBoard.tsx:43` `StageRow`, `TR/pipeline.ts:3` `StageTask`, `TR/pay.ts:43` `PayTask`, `TR/earnings.ts` task input type, `LT/mailPlan.ts:7,20` `MailTask`/`RemovedMailTask`, `CRON:24-34` `TaskRow` + `toMailTask`, `TR/ics.ts:4` `IcsEvent`, `LT/shareShape.ts:20` `IcsTask` + `LT/shareData.ts:74-83` mapping, `LT/shareShape.ts:49-53` + `ShareDto` task, `GB/undoStack.ts:9-12` `TaskSnapshot`.
- Label building ("C1 · LO") is duplicated: `GB/TaskBar.tsx:54,79-81,103-109`, undo toast labels `GB/GanttBoard.tsx:426,463,537` (`codes()`), `TR/ScheduleGrid/ScheduleGrid.tsx:25` `name()`, `LT/schedulePng.tsx:75`, ICS route `src/app/api/tracker/ics/[token]/[staffId]/route.ts:15`, `TR/emails/TrackerEmails.tsx:74,105-106,170`, `TR/Earnings/views.tsx:85`.
- Panel can retype/recut any task: `GB/TaskPanel.tsx:168` (cut Autocomplete), `:186-192` (type chips); `taskPatch` (ACT:394) accepts `cut_code`, `work_type_id`.
- Undo: delete-undo re-creates via `createTask` (`GB/GanttBoard.tsx:608-640`) from `TaskSnapshot` (`GB/undoStack.ts:9-12`), which has no fix flag.
- UI strings come from `src/i18n/dictionaries/{en,vi}.json` (`tracker.board`, `tracker.cuts`, `tracker.common`); emails and the PNG keep their own Vietnamese text.

**Out of scope:** pay on the fix itself (D1); auto bonus/penalty; converting/deleting the existing FI type and its 2 tasks (D6); a marker on A's bar (D4); a "fix" entry point in the panel or the Cuts page (D5); blocking deletion, retype or recut of a stage task that has fixes (D3: its fixes stay as "orphans", still fully editable).

---

## 2. RALPLAN-DR summary

**Principles**
1. The DB stays authoritative: every fix exemption and rule is enforced in SQL; the client only mirrors it for early feedback.
2. A fix is a task. Reuse the task machinery (board, drag, panel, undo, realtime, taskSync, share, ICS, digest, move dialog) instead of a parallel path.
3. Pay is computed only in `TR/pay.ts` / `TR/earnings.ts`; a fix can never add to a stage's pay or to pay totals.
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
| Cons | Every `cut:type` keyed map must ignore fix rows; explicit selects/adapters must carry the column | Duplicates realtime, taskSync, undo, drag, panel, share DTO, ICS, digest, notice queue — contradicts D8 parity and P2 | Needs a per-project FI type with 0 % in the 100 % pay total; bar colour/label is FI not the stage (contradicts D4); still needs a target-stage column, so strictly more moving parts than A |

**Chosen: A.** B is invalidated by D8 + P2 (≥ 8 surfaces duplicated). C is viable but contradicts D4 and adds project setup and a second column; A covers the same need with one column.

**Pre-mortem**
1. *A projection or adapter drops `is_fix`* → treated as a stage ⇒ fix pays the full stage amount / blocks order / steals the stage month. Mitigation: `is_fix: boolean` is **required** in every hand-picked type (§3.2), so tsc fails on any projection that omits it; AC-GREP-1 for selects; adapter unit tests from DB-shaped rows (AC-U4, AC-U6); E5 checks Cuts totals with a fix present.
2. *Removed-task digest silently empty* (new snapshot field breaks the string-only parser) → managers stop getting "Đã chuyển khỏi bạn". Mitigation: `REMOVED_FIELDS` untouched, `is_fix` parsed separately (§3.5); AC-U6 parses old- and new-shape snapshots.
3. *`is_fix` flipped by a direct PostgREST update* → a fix becomes a duplicate stage (bypassing the partial unique) or a stage escapes the order rule. Mitigation: SQL raises `fix_immutable` on any `is_fix` change (AC-SQL-4).

---

## 3. Design

### 3.1 Data model (migration `<ts>_tracker_v26_fix.sql`)

- M1 `alter table public.tracker_tasks add column is_fix boolean not null default false;`
- M2 Drop constraint `tracker_tasks_cut_type_key`; create `unique index tracker_tasks_cut_type_key on public.tracker_tasks (cut_id, work_type_id) where not is_fix` (same name; 23505 → `duplicate` mapping is by code and unchanged).
- M3 Replace `private.tracker_task_order()` (latest body V25:8-46). Contract, in this order:
  1. Advisory lock and the existing `project_immutable` check stay first, unchanged.
  2. `TG_OP = 'UPDATE' and new.is_fix is distinct from old.is_fix` → `raise exception using errcode = 'P0001', message = 'fix_immutable'`.
  3. If `new.is_fix`: on INSERT, or on UPDATE where `cut_id` or `work_type_id` changed, require `exists (select 1 from public.tracker_tasks t where t.cut_id = new.cut_id and t.work_type_id = new.work_type_id and not t.is_fix)`, else raise `fix_no_stage` (P0001). Then `return new` (no order check, D2). An UPDATE of a fix that changes only dates/staff/progress/links does **not** check the stage (orphans stay editable).
  4. Otherwise the existing order logic, with `and not t.is_fix` added to the conflict search.
- M4 Replace `private.tracker_type_order_check()` (V25:49-87): exclude fix rows on both sides of the self-join (`not a.is_fix and not b.is_fix`).
- M5 Replace `public.tracker_create_task`: `drop function public.tracker_create_task(uuid, uuid, uuid, text, date, date, bigint)`; create the same function with an extra trailing `p_is_fix boolean default false` inserted into `is_fix`. Re-apply the V2:587/594 revoke/grant lines for the new 8-arg signature. Body otherwise unchanged (a `fix_no_stage` raise rolls back the cut insert with the statement).
- M6 Replace `private.tracker_enqueue_notice` (V23:7): add `'is_fix', old.is_fix` to the `removed` snapshot object. Nothing else changes.
- Unchanged on purpose:
  - `tracker_move_task`: moving a fix offers the old staff's open bonus/penalty on that stage, exactly like a stage task (opt-in in `MoveDialog`, count shown). For a fixer that is their fix bonus (D1). Self-fix edge in §6.
  - `tracker_type_guard`: a type used only by fixes still counts as "in use" for delete and reorder.
  - Realtime publication: no change (no column lists).
- `get_advisors` (security) must stay empty after apply.

### 3.2 Pure modules (client mirror + pay)

`is_fix: boolean` is **required** (not optional) in every type below; fixtures are updated.
- `TR/pipeline.ts`: `StageTask` gains `is_fix`. `orderConflict` returns `null` when `candidate.is_fix`, and skips rows with `is_fix` when searching. `typeRule` unchanged.
- `TR/pay.ts`: `PayTask` gains `is_fix`. `payLines` emits **no line** for fix rows. `movableAdjustments` unchanged.
- `TR/earnings.ts` `effectiveMonths` (D9): the task input type gains `is_fix` and `staff_id` (if not already present). Contract:
  - `stageMonth: Map<'cut:type', month>` from non-fix rows (end_date month).
  - `fixMonth: Map<'cut:type:staff', month>` from fix rows, value = month of the **latest** `end_date` among that staff's fixes on that stage.
  - Adjustment month = `fixMonth.get(cut:type:a.staff_id) ?? stageMonth.get(cut:type) ?? <existing fallback>`.
- `TR/errors.ts`: new keys `FIX_NO_STAGE = 'fix_no_stage'`, `FIX_IMMUTABLE = 'fix_immutable'`; `TrackerError` gains `'fix_no_stage'`; `fix_immutable` maps to `'invalid'`. Every exhaustive `TrackerError` → text switch gets the new case (board `failText` `GB/GanttBoard.tsx:303-309`, CutsView `errorText` near `CV/CutsView.tsx:98`, any other found by tsc).
- `GB/boardHelpers.ts:44` local `Stage` type (used by `orderConflictText`) is exempt: SQL never names a fix in `detail` (AC-SQL-2).
- No shared label helper: each label site appends the fix word itself (different text sources).

### 3.3 Board

- `[projectId]/page.tsx:43` stage-index select adds `is_fix`; `StageRow` (`GB/GanttBoard.tsx:43`) adds `is_fix`.
- `GB/CreateTaskPopover.tsx`: new Mantine `Switch` (`tracker.board.fixSwitch`), shown only when not `cutMode`. When on:
  - The cut must resolve to an existing cut (`cuts.find`); no new cut is created; budget field hidden.
  - Type chips enabled = types that have a non-fix stage task in that cut; others disabled. If none, show `tracker.board.fixNoStage` and keep submit disabled.
  - No `orderConflict` call (D2).
  - Submit adds `is_fix: true`.
  When off: `used` counts non-fix rows only (a fix never makes a stage look taken).
- `ACT createTask`: `createTaskSchema` gains `is_fix: z.boolean().optional()`; passes `p_is_fix: input.is_fix ?? false`. `taskPatch` does not accept `is_fix`.
- `GB/TaskBar.tsx`: fix rows get a `.fix` class in `TaskBar.module.css` (diagonal stripes in the stage colour via `repeating-linear-gradient` over the existing tint; progress fill still visible) and the visible type text `"{code} · {fix}"` (`tracker.board.fix`). Hover card and aria-label (`barLabel`) include it.
- Undo toast labels (`GB/GanttBoard.tsx:426,463,537`, `codes()`): append " · Fix" for fixes.
- `GB/TaskPanel.tsx`: for a fix, the cut Autocomplete and type chips render read-only (text "C1 · LO · Fix"); assignee/dates/progress/links unchanged. `usedTypeIds` (`GB/GanttBoard.tsx:921-923`) counts non-fix rows only.
- Undo: `TaskSnapshot` (`GB/undoStack.ts:9-12`) gains `is_fix`; delete-undo passes it to `createTask` (`GB/GanttBoard.tsx:608-640`); every place that builds a snapshot copies it. Undoing the delete of an orphan fix fails with `fix_no_stage` and shows `tracker.board.fixNoStageError` (accepted).
- Realtime/taskSync: no code change (row type is `Tables<'tracker_tasks'>`; payload carries every column).

### 3.4 Cuts page

- `[projectId]/cuts/page.tsx:32` and `TR/Earnings/loadEarnings.ts:18` selects add `is_fix` (and `staff_id` if missing, for D9).
- `CV/CutsView.tsx`: `taskByStage` (`:80`) built from non-fix tasks only; new `fixCount: Map<stageKey, number>` from fix tasks; filled stage cell (`:292-310`) shows `tracker.cuts.fixCount` when > 0, read-only. Pay totals use `payLines` (fixes excluded). The cutMode `CreateTaskPopover` receives `stages={tasks}`; its `used` ignores fixes (§3.3).
- BulkModal unchanged (works off `taskByStage`).

### 3.5 Share page, PNG, ICS, emails

- Share: `LT/shareData.ts:36` select adds `is_fix`; `LT/shareShape.ts` forwards it; `ShareDto` task type gains it. `ScheduleGrid.tsx` `name()` (`:25`) appends " · Fix"; bar style adds the stripe (inline `repeating-linear-gradient`).
- PNG `LT/schedulePng.tsx:73-91`: label suffix + inline stripe. If Satori cannot render `repeating-linear-gradient`, keep only the label suffix and report it.
- ICS: `LT/shareData.ts:65` select adds `is_fix`; mapping `:74-83` copies it; `IcsTask` (`LT/shareShape.ts:20`) gains it; ICS route `:15` summary `"{cut} · {type} · Fix"` for fixes.
- Cron/digest: `TASK_COLS` (`CRON:23`) adds `is_fix`; `TaskRow` and `toMailTask` (`CRON:24-34`) carry it; `MailTask` gains it. `RemovedMailTask` gains `is_fix: boolean`; **`REMOVED_FIELDS` stays unchanged**; `parseRemoved` sets `is_fix = r.is_fix === true` (missing or malformed ⇒ false, old queue rows keep working).
- Templates: `TrackerEmails.tsx:74,170` append " · Fix"; `ACT:636` and `:687` selects add `is_fix` and their label text appends " · Fix"; `TrackerEmails.tsx:105` React key becomes the task id.
- The word is "Fix" in both locales (the studio's own term; owner chose the label "C1 LO · Fix").

### 3.6 Dictionaries (`en.json` + `vi.json`, same keys)

`tracker.board.fix` = "Fix"; `tracker.board.fixSwitch` = "Fix a stage" / "Sửa công đoạn (Fix)"; `tracker.board.fixNoStage` = "This cut has no stage task to fix" / "Cut này chưa có công đoạn nào để sửa"; `tracker.board.fixNoStageError` (for `fix_no_stage`) = "The stage to fix has no task" / "Công đoạn cần sửa chưa có task"; `tracker.cuts.fixCount` = "{n} fix" / "{n} fix".

---

## 4. Acceptance criteria

SQL (via `execute_sql` on throwaway rows in an archived test project `E2E-v26`, or in a transaction ending with `set constraints all immediate;` before `rollback`; rows cleaned up after):
Setup: cut `F1` with types LO (sort 10) < GE (20); stage tasks LO (A, 2026-11-02..11-06) and GE (A, 11-09..11-13).
- AC-SQL-1 Fix of F1 LO (B, 11-02..11-02) inserts; a second fix of F1 LO (C, 11-09..11-12, overlapping GE) inserts.
- AC-SQL-2 Updating GE (non-fix) to start 11-05 still raises `order_conflict` with detail = the LO **stage** task id; no fix is ever named in `detail`.
- AC-SQL-3 `tracker_create_task(..., p_cut_code := 'F2-NEW', ..., p_is_fix := true)` raises `fix_no_stage` and cut `F2-NEW` does not exist afterwards; a fix of F1 with a type that has no F1 stage task raises `fix_no_stage`.
- AC-SQL-4 `update … set is_fix = true` on the LO stage task, and `set is_fix = false` on a fix, both raise `fix_immutable`.
- AC-SQL-5 A second non-fix F1 LO task raises 23505.
- AC-SQL-6 Delete the F1 LO stage task while fixes exist: succeeds, fixes remain. Then on an orphan fix: updating progress, links and dates succeeds; `tracker_move_task` to another staff succeeds; inserting a new fix of F1 LO raises `fix_no_stage`.
- AC-SQL-7 `pg_publication_rel` for `supabase_realtime` still has 9 members, all with `prattrs` NULL; `pg_publication_tables.attnames` for `tracker_tasks` contains `is_fix`.
- AC-SQL-8 Toggling `overlaps_prev` on GE succeeds with only fix rows sitting inside LO/GE overlap windows (`tracker_type_order_check` ignores fixes; deferred check forced with `set constraints all immediate`); a non-fix overlap still raises `overlap_in_use`. Run after AC-SQL-6: reordering LO (now used only by orphan fixes) raises `type_in_use` (unchanged guard).
- AC-SQL-9 `get_advisors` security has no new findings; `to_regprocedure('public.tracker_create_task(uuid,uuid,uuid,text,date,date,bigint)')` is NULL; the 8-arg function has EXECUTE for `authenticated` and not for `anon`/`public`.
- AC-SQL-10 Moving a fix with an open bonus for its old staff on that stage and `p_move_adjustments := true` moves the bonus (reversal + copy, one batch) — unchanged behaviour.

Unit (Vitest; `npm test` green, `npx.cmd tsc --noEmit` clean, `npm run lint` clean):
- AC-U1 `pipeline.test.ts`: `orderConflict` returns null for a fix candidate; a fix of an earlier type never blocks a later non-fix candidate.
- AC-U2 `pay.test.ts`: `payLines` emits no line for a fix; totals equal the same data without the fix.
- AC-U3 `earnings.test.ts` (D9): B's bonus on F1 LO with B's fix ending 2026-11-20 and A's stage ending 2026-10-30 lands in 2026-11; A's penalty on F1 LO lands in 2026-10; with two fixes by B (10-28, 11-20) → 2026-11; orphan fix (no stage task) → fix month.
- AC-U4 `shareShape.test.ts`: `is_fix` forwarded in the share DTO; ICS mapping from a DB-shaped row carries `is_fix` and the summary ends in " · Fix".
- AC-U5 errors: `fix_no_stage` → `'fix_no_stage'`, `fix_immutable` → `'invalid'`.
- AC-U6 Cron: `parseRemoved` keeps an old-shape snapshot (no `is_fix`) with `is_fix=false`, a new one with `true`, and drops a snapshot missing a string field (unchanged); `toMailTask` from a DB-shaped row carries `is_fix`; rendered `DigestEmail` for a fix contains "LO · Fix" and two rows of one cut (stage + fix) render without a duplicate React key warning.

Grep:
- AC-GREP-1 Every explicit `tracker_tasks` select listed in §1 includes `is_fix` (or is `*`).

E2E (debug Chrome on :9222, local dev, archived/throwaway project `E2E-v26` or cut `E2E-FX`; no real emails):
- E1 Board: with F1 LO (A) and F1 GE (A), create a fix on B's row on LO's first day via the Fix switch → bar striped, LO colour, "LO · Fix"; no order error.
- E2 Fix switch on a cut with no stage tasks shows `fixNoStage`, submit disabled; on F1, only LO and GE chips are enabled.
- E3 Drag/resize the fix across GE's dates → saves; undo/redo works; delete + undo re-creates it as a fix (still striped).
- E4 Panel on the fix: cut/type read-only; progress and links edit; reassign to C opens `MoveDialog` as for a stage task.
- E5 Cuts page: LO cell shows "1 fix"; stage pay badges and totals equal the values before the fix; GE cell unaffected.
- E6 Share page and PNG show the fix with the suffix (stripes where supported); ICS feed for B contains "F1 · LO · Fix".
- E7 Second tab: creating a fix in tab 1 appears striped in tab 2 via realtime without reload.

---

## 5. Execution plan (after approval; max 3 subagents at once)

| ID | Deps | Task | Agent | Contract | Acceptance |
|----|------|------|-------|----------|-----------|
| A1 | — | Migration file `supabase/migrations/<ts>_tracker_v26_fix.sql` (M1–M6), written, not applied | opus-executor | §3.1 | Reviewed in R-A |
| R-A | A1 | Fresh review of the migration ("are there any bugs in this?") | opus-executor | — | No open defects |
| GATE A | R-A | Owner OK → main session applies via `apply_migration` (subagents are denied it); file name = live version | orchestrator | — | `list_migrations` shows it |
| A2 | Gate A | SQL acceptance (AC-SQL-1…10) with cleanup + types regen (`generate_typescript_types` → `src/types/database.types.ts`; `npx supazod …`) | opus-executor | §4 SQL | All AC-SQL pass, test rows removed |
| B1 | A2 | Pure modules + tests + `errors.ts` + dictionaries (§3.2, §3.6, AC-U1…U3, U5) | opus-executor | §3.2 | Tests green |
| B2 | B1 | Board + `ACT` (§3.3, plus `ACT:636`/`:687` selects + labels) | opus-executor | §3.3 | tsc/lint clean |
| B3 | B1 | Cuts page, share, PNG, ICS, cron, email templates (§3.4, §3.5, AC-U4, AC-U6, AC-GREP-1) | opus-executor | §3.4–3.5 | tests/tsc clean |
| R-B | B2, B3 | Fresh reviewer over the wave B diff | opus-executor | — | No open defects |
| E | R-B | E2E E1–E7 per orchestrator brief | sonnet-executor | §4 E2E | Pass table + evidence in `.omc/e2e/v2.6/` |
| D | E | CLAUDE.md tracker section (is_fix rules, new error keys, migration name, D9 month rule), memory | sonnet-executor | — | Docs match code |

File ownership: `errors.ts`, dictionaries and pure modules only in B1; `ACT` only in B2; `CutsView`, share/PNG/ICS/cron/emails only in B3.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| A projection/adapter drops `is_fix` ⇒ double pay / wrong month | Required field in every type (tsc); AC-GREP-1; AC-U4, AC-U6; E5 |
| Removed-task digest breaks on the new snapshot field | `REMOVED_FIELDS` unchanged; separate boolean parse; AC-U6 |
| Old `tracker_create_task` overload left behind | M5 drops the exact 7-arg signature; AC-SQL-9 |
| Self-fix (B owns both the stage and a fix of it): moving the fix offers to move B's stage bonus too | Opt-in in `MoveDialog` with count shown; manager unticks. Accepted; no code |
| Orphan fixes after the stage task is deleted, retyped or recut (D3) | Stay fully editable (AC-SQL-6); undo of deleting an orphan fix fails with `fix_no_stage` (accepted); Cuts empty cell shows no count |
| Satori lacks repeating gradients | Label suffix still identifies the fix (§3.5) |
| Existing FI type left as is (D6) | Owner cleans up; no code assumes it is gone |

---

## 7. Verification steps

1. `npm test`, `npx.cmd tsc --noEmit`, `npm run lint` — all green.
2. AC-SQL-1…10 via `execute_sql` with cleanup.
3. E2E E1–E7 with evidence under `.omc/e2e/v2.6/`.
4. `get_advisors` (security) empty.

---

## ADR

- **Decision:** Option A — `tracker_tasks.is_fix` flag; a fix reuses its stage's `work_type_id`, is exempt from the order rule and from the per-stage unique (partial unique index), requires an existing stage task on create/retarget, is immutable as a flag, pays nothing; bonus/penalty months follow the staff's latest fix (D9).
- **Drivers:** task parity on all surfaces (D8); correctness of order and pay; low-risk live migration.
- **Alternatives considered:** B separate table (rejected: duplicates every task surface); C floating FI work type (rejected: contradicts D4 stage colour, adds project setup and a target column).
- **Why chosen:** one column reuses all existing task machinery; exemptions live in two SQL trigger functions and three pure TS functions; required typing turns every missed projection into a compile error.
- **Consequences:** every `cut:type` keyed map must skip fix rows; explicit selects/adapters carry `is_fix`; orphan fixes are possible by design (D3).
- **Follow-ups:** owner removes the FI type (D6); optional marker on A's bar; optional fix creation from the panel; optional history of who fixed what in the Cuts cell tooltip.

## Changelog
- r1 (2026-10-04): first draft from owner decisions D1–D8 and two fact passes.
- r3 (2026-10-04): Critic round 2 APPROVE; applied its two minors (AC-SQL-8 ordering note, `boardHelpers` `Stage` type exempt).
- r2 (2026-10-04): review round 1 (`.omc/drafts/tracker-v2.6-review-r1.md`). Dropped the publication change (no column lists live; `set table` would have unpublished 8 tables) and the move-task adjustment skip (existing opt-in kept). Added D9 month rule, required `is_fix` typing, ICS/cron adapter coverage, separate `is_fix` parse in `parseRemoved`, undo toast labels, orphan-fix usability and type-guard ACs, concrete AC dates, forced deferred checks, digest render test instead of a non-existent cron dry run, B1 before B2/B3.
- done (2026-10-04): executed; deviations: email stage label renders 'LO · Fix · Layout'; helpers toIcsTask/icsSummary/fixSuffix moved into shareShape.ts and TaskRow/toMailTask/parseRemoved into mailPlan.ts for testability.
