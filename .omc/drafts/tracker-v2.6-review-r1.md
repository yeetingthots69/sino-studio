# Tracker v2.6 fix tasks — review round 1 (2026-10-04)

Snapshot reviewed: `.omc/drafts/tracker-v2.6-fix-r1-snapshot.md`. Critic = `fable-critic`; Codex = codex-rescue (read-only). Ran in parallel, not cross-fed. Verdicts by the orchestrator.

| # | Source | Sev | Finding | Verdict | Evidence / action |
|---|--------|-----|---------|---------|-------------------|
| 1 | Critic 1 + Codex 1 | blocker | M5 `alter publication … set table` replaces the whole member list; and `tracker_tasks` has no column list at all | **Confirmed** | Live `pg_publication_rel.prattrs` is NULL for all 9 members (orchestrator query). The fact pass was wrong. M5 dropped; AC-SQL-7 now asserts prattrs NULL + 9 members + `is_fix` in attnames |
| 2 | Critic 2 + Codex 2 | major | Adding boolean `is_fix` to `REMOVED_FIELDS` drops every snapshot (string-only check) | **Confirmed** | `cron/route.ts:36-41`. `REMOVED_FIELDS` unchanged; `is_fix` read separately as optional boolean (missing/malformed ⇒ false); unit test with old-shape snapshot |
| 3 | Codex 3 | major | ICS and cron adapters build rows field by field (`shareShape.ts:20` `IcsTask`, `shareData.ts:74-83`, `cron/route.ts:23-34` `TaskRow`/`toMailTask`) | **Confirmed** | Added to §3.5 + adapter tests |
| 4 | Codex 4 | major | Optional `is_fix?` lets a projection silently drop the flag ⇒ full pay | **Confirmed** | `is_fix: boolean` required in `StageTask`, `PayTask`, earnings task type, `StageRow`, `MailTask`, `IcsTask`, `ShareTask`, `TaskSnapshot` |
| 5 | Critic 3 | major | `effectiveMonths` places B's fix bonus in the stage task's month | **Confirmed → owner decision D9** | Owner: use the fix's month for that staff (latest fix end) else the stage month |
| 6 | Critic 4 | major | M7 skip removes moving B's own fix bonus to the new fixer; only the self-fix case is ambiguous | **Confirmed** | Move-adjustments is already opt-in in `MoveDialog` with count shown. M7 dropped; existing behaviour kept; self-fix edge listed in risks |
| 7 | Critic 5 | minor | `movableAdjustments` signature change breaks `undoStack.ts:82-90` and tests | **Confirmed, moot** | Function untouched (follows from #6) |
| 8 | Codex 5 | minor | AC-SQL-9 contradicts `tracker_type_guard` (reorder of a used type is `type_in_use`); deferred check needs forcing | **Confirmed** | V2:304. AC-SQL-9 rewritten; `set constraints all immediate` before rollback |
| 9 | Codex 6 + Critic 6 | minor | Orphan fixes: usability untested; stage retype/recut also orphans fixes | **Confirmed** | AC-SQL-6 extended; retype/recut stated in scope; undo-delete of an orphan fix fails with `fix_no_stage` (accepted) |
| 10 | Critic 7 | minor | E8 "cron dry run" does not exist | **Accepted** (grep claim not re-run; the cron route writes on every call per its code) | E8 replaced with Vitest render of `DigestEmail` |
| 11 | Critic 8 | minor | B2 tsc cannot pass in parallel with B1 | **Confirmed** | Wave B: B1 first, then B2 ∥ B3 |
| 12 | Critic 9 | minor | Undo toast labels (`GanttBoard.tsx:426,463,537`) missing from label sites | **Accepted** | Added to §3.3 |
| 13 | Critic 10 | minor | AC-SQL-1 dates vague | **Confirmed** | Concrete dates |

Codex found no problems with: immutability-before-exemption trigger order, the partial unique index, RPC drop/recreate + grants. Critic verified the other §1 citations against live definitions.
