# Tracker v2.5: overlappable stages

Status: **DONE 2026-10-02**. Built, reviewed and E2E-verified (`.omc/e2e/v2.5/e2e-v2.5-results.md`); migration `20261002125744_tracker_v25_overlap` applied live with the owner's OK; uncommitted. History: r3, approved by the owner (consensus planning). The review log (Critic, Codex, and the orchestrator's verdicts) is in `.omc/drafts/tracker-v2.5-review-r1.md`. Execution after approval runs through `/orchestrate-with-subagents`, with at most 4 subagents at a time. No git writes: the owner commits. There is one migration; it is applied live only with the owner's OK (Gate A).

Paths: `GB/` = `src/components/tracker/GanttBoard/`, `TR/` = `src/components/tracker/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `V2` = `supabase/migrations/20260930065620_tracker_v2.sql`.

---

## 1. Requirements summary

**Owner request (2026-10-02).** Douga (DO) and shiage (SH) can start on the same day, and SH usually lasts 1 day. Today the studio works around this with a combined "DO + SH" type, which makes pay awkward. The owner wants stages markable as "overlappable" in the project create/edit modal.

**Owner decisions (2026-10-02):**

| # | Question | Answer |
|---|----------|--------|
| O1 | Overlap rule | An overlappable stage B may start on or after the start of the stage before it (A), never before. B's end date is free, so a 1-day SH inside a 5-day DO is OK |
| O2 | Which stages | Only the stage directly before it (the previous type by `sort_order` in the project). Every other pair stays strict |
| O3 | Where set | Per work type, in the project modal (`WorkTypesEditor`). It applies to every cut in the project |
| O4 | Unticking with existing overlaps | Block it, and name the overlapping cut |
| O5 | Default types (`TR/defaults.ts` has one combined `DO + SH` at 40 %) | **Split.** The defaults become LO 30 / GE 30 / DO 30 / SH 10 (sort 10/20/30/40), with SH `overlaps_prev: true`. Existing projects are not migrated |

**Current state (evidence):**
- SQL rule `private.tracker_task_order` (V2:247-275). It is a BEFORE INSERT/UPDATE trigger on `tracker_tasks` that takes the project advisory lock. An earlier type must end before the candidate starts, and a later type must start after the candidate ends. It raises `order_conflict` with `detail` set to the conflicting task id, picking the lowest `sort_order` first. Every task write is covered, including `tracker_create_task` and `tracker_move_task` (a plain `update`, v23 sql:61).
- Client mirror `orderConflict(stages, typeOrder: Map, candidate)` (TR/pipeline.ts:11). Its only caller is `CreateTaskPopover.tsx:80-85`, whose prop type is at :38. `typeOrder` is built in `GanttBoard.tsx:252` and `CutsView.tsx:75` and passed at `GanttBoard.tsx:893` and `CutsView.tsx:352`. Server errors are rendered by `orderConflictText` (GB/boardHelpers.ts:50-65) using `board.orderEarlier/orderLater/orderGeneric` (en.json:415-417).
- Type writes:
  - `tracker_save_work_types` (V2:473-490): delete, then update, then insert. It is called from ACT:211, with the payload built in `ProjectsTable.tsx:38`.
  - `tracker_create_project` (V2:460-471), fed `DEFAULT_WORK_TYPES` (ACT:171).
  - Direct DML through PostgREST is also possible (`work_types_rw` policy).
  - `private.tracker_type_guard` (V2:292-316) takes the lock and blocks deleting a used type or reordering one. It allows inserting a type between two used types.
  - Pattern for a project-wide rule checked at commit: the deferred constraint trigger `private.tracker_pct_total` (V2:319-347).
- Grants: EXECUTE on `private.*` is revoked from `authenticated` (V2:456). Trigger functions work because they are checked at CREATE TRIGGER time. A plain call from an RPC would fail.
- Errors: `mapDbError` keeps `detail` only for `order_conflict` (TR/errors.ts:34-41). `ProjectsTable.useErrorText` (:24-35) maps the error key to a fixed string.
- Lanes: `assignLanes` (TR/dates.ts:69-96) puts every task of a cut on a single lane. Row heights already follow `max(lane)+1` on the board (`GanttBoard.tsx:814`), the share page (`ScheduleGrid.tsx:55`) and the PNG (`schedulePng.tsx:35`). The PNG drops lanes ≥ 20 (`MAX_LANES`).

**Out of scope:** per-cut overrides; overlap with any stage other than the direct predecessor; migrating existing "DO + SH" tasks; PNG pagination.

---

## 2. RALPLAN-DR summary

**Principles:**
1. SQL is the authority, and the client mirrors the same predicate.
2. Data always satisfies the current rule (O4), whatever the write path: RPC or direct DML.
3. Only the pair (direct predecessor A, flagged B) changes.
4. Every surface that draws bars stays readable when bars overlap.

**Decision drivers:** correct checks under concurrency; no write path that leaves tasks breaking the rule; a small diff.

**Defining the predecessor:**
- (a) **Static (chosen).** The predecessor is the type with the next lower `sort_order` in the project, via `lag()` (unique `(project_id, sort_order)`, V2:205).
- (b) Dynamic, meaning the nearest earlier type that has a task in that cut. **Rejected:** it lets SH overlap GE when DO is skipped, and it changes as tasks come and go.

**Keeping data valid when types change:**
- (c) **Deferred constraint trigger on `tracker_work_types` (chosen).** It covers the RPC and direct DML at commit, mirrors `tracker_pct_total`, and needs no callable helper (Critic F1/F2, Codex X1/X2).
- (a) A re-check at the end of the RPC. **Rejected:** it is bypassed by direct DML, and calling a private helper fails on grants.
- (b) A per-row check in `tracker_type_guard`. **Rejected:** it can't see the final set of types after a save that changes several rows.

---

## 3. Behaviour

**Rule.** Take two tasks in one cut, A with the lower type `sort_order` and B with the higher one.
- If B's type has `overlaps_prev = true` and A's type is B's type's direct predecessor, the pair is valid iff `B.start_date >= A.start_date`.
- Otherwise the pair is valid iff `A.end_date < B.start_date` (unchanged).
- Each pair is checked on its own. So a later stage C that is **not** flagged must start after both DO and SH end. If C is also flagged, it needs only `C.start >= SH.start` against SH, and DO → C stays strict (not adjacent).
- A flag on the lowest type has no effect, because it has no predecessor.

**Editor.**
- `WorkTypesEditor` gets a column "Overlaps previous", a Checkbox with a hint tooltip. It is disabled on the first row.
- Moving a row keeps its flag.
- If a save would leave tasks breaking the rule (after unticking, or after inserting a type between A and B), the save fails with `overlap_in_use`, and the modal shows "Can't save: cut {cut} has stages that overlap under this setting."

**Board / Cuts conflict texts.**
- Strict pairs keep the existing wording (`orderEarlier` / `orderLater`).
- Flagged pairs get two new texts:
  - `orderEarly`: B starts before A starts, e.g. "Starts before DO C12 (10/09–14/09) starts".
  - `orderLate`: A would start after B has started, e.g. "Must start no later than SH C12 (10/09–10/09)".

**Lanes.** Inside a cut block, overlapping tasks get sub-lanes, so the block is k lanes tall (§4.5). The board, share page and PNG all pick this up through `assignLanes`.

**Pay, notices, undo, move:** no change. They are ordinary task writes through the same trigger. An undo that breaks the rule after a flag change is refused by `order_conflict`, which is already handled.

---

## 4. Contracts

**4.1 Migration `<ts>_tracker_v25_overlap.sql`.** All new code is trigger functions; there are no callable helpers and no grant changes.

- **Column.** `alter table public.tracker_work_types add column overlaps_prev boolean not null default false;`
- **`private.tracker_task_order`** is rewritten with `create or replace`. It keeps:
  - the `project_immutable` check;
  - the lock;
  - the unknown-type early return;
  - `order by w.sort_order limit 1`;
  - `detail` = the conflicting task id.

  The `where` clause becomes, with `v_prev` / `v_next` = the candidate type's predecessor / successor id (`lag`/`lead` over `tracker_work_types where project_id = new.project_id order by sort_order`) and `v_flag` = the candidate type's `overlaps_prev`:
  ```
  t.cut_id = new.cut_id and t.id <> new.id and (
    (w.sort_order < v_order and case when w.id = v_prev and v_flag      then t.start_date > new.start_date else t.end_date >= new.start_date end)
    or (w.sort_order > v_order and case when w.id = v_next and w.overlaps_prev then t.start_date < new.start_date else t.start_date <= new.end_date end))
  ```
- **`private.tracker_type_order_check()`.** A new constraint trigger: `create constraint trigger tracker_type_order after insert or update or delete on public.tracker_work_types deferrable initially deferred for each row`.
  - It takes the project lock.
  - It runs one query: `with types as (select id, sort_order, overlaps_prev, lag(id) over (order by sort_order) prev from tracker_work_types where project_id = X)`, joined to pairs of tasks in the same cut of project X, returning the first pair that breaks §3's rule.
  - On a violation it raises `overlap_in_use` with `detail` = the cut `code`.
  - It mirrors `tracker_pct_total` (V2:319-347), which handles `old`/`new` for project_id.
- **`tracker_create_project` and `tracker_save_work_types`.** Both read `overlaps_prev` with `coalesce(e.overlaps_prev, false)` in the recordset column list, and the update sets it. They need no explicit re-check, because the constraint trigger fires at commit.
- **Gate A dry run.** Run it inside `begin; set local role authenticated; set local request.jwt.claims = '{"email":"<admin>"}'; … rollback;` and verify. Rules for the run:
  - `request.jwt.claims` carries a real `tracker_users` email; otherwise RLS hides every row and the cases fail for the wrong reason.
  - Each expected failure goes in its own `savepoint` / `rollback to savepoint`.
  - Before the type-write cases, run `set constraints tracker_type_order immediate`. Name only this trigger: `all` would also fire `tracker_pct_total` and the deferred unique key mid-RPC. A deferred trigger never fires inside `begin … rollback`.

  The cases:
  - same-day start OK;
  - B before A refused;
  - A moved after B's start refused (`order_conflict`);
  - an unflagged C before A's end refused;
  - chained flags OK;
  - unticking via the RPC and via a direct `update` gives `overlap_in_use` + cut code;
  - inserting a type between A and B with an existing overlap gives `overlap_in_use`.

  `get_advisors` (security) must stay empty.

**4.2 Types, actions, errors.**
- Regenerate `database.types.ts` and supazod.
- `saveWorkTypesSchema` adds `overlaps_prev: z.boolean()`, and the `saveWorkTypes` input type follows. It is required on purpose: don't add `.default(false)`, which would hide a missing field.
- `TrackerError` adds `'overlap_in_use'`, and `P0001` maps it.
- `mapDbError` passes `detail` for both `order_conflict` and `overlap_in_use`.
- `useErrorText` in ProjectsTable formats `workTypesEditor.error.overlapInUse` with `{cut}` from `res.detail`.

**4.3 Client rule (TR/pipeline.ts).**
- `type TypeRule = {order: Map<string, number>; prev: Map<string, string | null>; overlaps: Set<string>}`.
- `typeRule(workTypes: {id; sort_order; overlaps_prev}[]): TypeRule`.
- `orderConflict(stages, rule, candidate): {task: StageTask; reason: 'earlier' | 'later' | 'early' | 'late'} | null`. It keeps the lowest-order pick, using the same predicate as the SQL.
- Callers:
  - `GanttBoard.tsx:252` and `CutsView.tsx:75` build `typeRule`;
  - the prop `typeOrder` becomes `typeRule` (`GanttBoard.tsx:893`, `CutsView.tsx:352`, `CreateTaskPopover.tsx:38`);
  - the popover uses `.task.id` and passes `reason` to the describe callback.
- **4.3b Server-side text.** Call sites that must pass the rule: `GanttBoard.tsx:299-300` (`describeConflict`), `CutsView.tsx:94-97` and `CutsView.tsx:354-355`. Update `GanttBoard/__tests__/boardHelpers.test.ts` for the new argument and the two new reasons. `orderConflictText` derives the reason from the conflicting task, the candidate type and the rule. `orderConflictText(t, conflictId, typeId, stages, cutCodes, typeById, rule)` needs the rule to tell flagged pairs apart.
- **Tests (`pipeline.test.ts`):** same-day OK; B before A; A after B's start; 1-day B inside A OK; extending A's end past B's end OK; unflagged C must clear A's end; chained flags; a non-adjacent type stays strict; a flag on the first type has no effect.

**4.4 i18n (en + vi in sync).** New keys:
- `tracker.board.orderEarly` and `tracker.board.orderLate`;
- `tracker.workTypesEditor.overlapsPrev` (column) and `tracker.workTypesEditor.overlapsPrevHint` (tooltip);
- `tracker.workTypesEditor.error.overlapInUse` (with `{cut}`).

**4.5 `assignLanes` (TR/dates.ts).**
- Inside each block, sort tasks by start date (then end date, then index) and give each the lowest sub-lane whose last end is before the task's start. The block height `k` is the number of sub-lanes.
- Packing: find the lowest `i` such that lanes `i .. i+k-1` all end before `b.start`. Set those `k` lane ends to `b.end`, and give each task lane `i + sub`.
- Tests:
  - two overlapping tasks of one cut get lanes 0 and 1;
  - a following non-overlapping block of height 2 reuses lanes 0–1;
  - block X (k=1, days 1–4) followed by block Y (k=2, days 3–6) puts Y at lanes exactly `[1, 2]`;
  - existing tests stay green.

**4.6 Editor.**
- `EditorType.overlaps_prev`.
- A Checkbox column, disabled on index 0.
- The `payload` in ProjectsTable carries `overlaps_prev`; the `typesEdited` compare follows from it.
- `DEFAULT_WORK_TYPES` (O5) = `LO Layout #3b82f6 30% /10`, `GE Genga #22c55e 30% /20`, `DO Douga #eab308 30% /30`, `SH Shiage #a855f7 10% /40, overlaps_prev: true`. Every row passes `overlaps_prev` explicitly.

---

## 5. Waves

| ID | Deps | Task | Contract | Acceptance |
|----|------|------|----------|-----------|
| A1 | none | Migration file + dry run as `authenticated` in a rolled-back transaction | §4.1 | Every dry-run case in §4.1 gives the expected result, with `overlap_in_use` observed while the trigger is forced immediate; advisors clean |
| Gate A | A1 | Owner OK, then apply live and regenerate types | none | `list_migrations` shows it; tsc clean |
| B1 | Gate A | pipeline.ts `typeRule`/`orderConflict`; boardHelpers text; CreateTaskPopover + both parents; i18n board keys; tests | §4.3, §4.4 | Tests pass; tsc clean |
| B2 | Gate A | `assignLanes` sub-lanes + tests | §4.5 | Tests pass (surfaces need no change: heights already follow the lane count) |
| B3 | Gate A | Editor column, action schema, errors map + detail, `useErrorText`, payload, defaults, i18n editor keys | §4.2, §4.6 | tsc + tests pass |
| R | B* | A fresh reviewer per row (B1 + B3 can share one, since they touch the same i18n files) | none | PASS |
| E2E | R | Browser brief (own tab, same rules as v2.4) | none | §6 |

B1, B2 and B3 run in parallel. B1 and B3 both edit `en.json`/`vi.json` in different subtrees, so tell each to edit only its own keys.

---

## 6. E2E acceptance

1. In a test project (LO, GE, DO, SH), tick SH. Create DO 5–9 and SH 5–5 in cut E2E-O1. Both save.
2. Drag SH to 4–4: refused with the `orderEarly` text. Drag SH to 9–9: OK. Drag DO to start on 10 (after SH's start): refused with the `orderLate` text.
3. Create a later stage starting on 9 (DO hasn't ended): refused.
4. Give DO and SH to the same staff: two sub-lanes with no overlapping bars, on the board and on the share page.
5. Untick SH while E2E-O1 overlaps: the save is refused, naming E2E-O1. Move SH to 10–10, then untick: OK.
6. Pay: Earnings shows DO and SH from their own %.
7. Undo a drag of SH: works. No console errors.
8. Clean up the test data.

---

## 7. Risks

- **Rule drift between SQL and TS.** Mitigation: one predicate each side, the same case list in the dry run and the unit tests.
- **Concurrency.** Task triggers, `tracker_type_guard` and both new checks take the same project advisory lock. The deferred type check runs at commit, after the lock, so it sees committed tasks.
- **PNG ceiling (accepted).** `MAX_LANES = 20` per person already drops overlapping tasks above lane 20. Sub-lanes add at most a lane or two per cut. Add pagination or an overflow marker only if a real schedule hits it.
- **Performance.** The deferred check is per type row, and a save touches at most about 10 rows. Each check is O(tasks per cut²) over the project (≤ 6 per cut), so it is negligible. Optional: dedupe per transaction later if saves grow.

## Changelog
- r1 (2026-10-02): first draft from O1–O4.
- r2 (2026-10-02): applied Critic F1–F10 and Codex X1–X4, X6, X7. Codex X5 (PNG pagination) was accepted as an existing ceiling.
  - The deferred constraint trigger replaces the RPC re-check, and the predicate is inlined with no private helper call.
  - The reverse-direction text and tests were added.
  - Error detail is carried through to the editor.
  - Lane packing for k-lane blocks is specified.
  - The `TypeRule` prop replaces `typeOrder`.
- r3 (2026-10-02): applied Critic round 2 F11–F16 (all confirmed).
  - The dry run forces the constraint trigger immediate, uses savepoints and a real allow-listed email.
  - The lane test expectation is exact.
  - The `orderConflictText` call sites are listed.
  - The schema field is strict on purpose.
  - O5 defaults are split LO/GE/DO/SH 30/30/30/10, with SH overlappable.
