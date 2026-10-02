# Tracker v2.5 overlappable stages: review round 1 (plan r1)

Critic (`fable-critic`) and Codex reviewed the same r1 snapshot in parallel; neither saw the other's output. The orchestrator checked every finding against the code. Plan r2 applies them.

## Critic (verdict: APPROVE WITH CHANGES)

| # | Sev | Finding | Verdict | Resolution (r2) |
|---|-----|---------|---------|-----------------|
| F1 | major | A private helper called from an invoker RPC fails. EXECUTE is revoked (V2:456), and only trigger functions are checked at CREATE TRIGGER time | CONFIRMED | No callable helper. The predicate is inlined in the task trigger and in a deferred constraint trigger |
| F2 | major | A check that lives only in the RPC is bypassed by direct DML through PostgREST (`work_types_rw` policy) | CONFIRMED | Option (c): a deferred constraint trigger on `tracker_work_types`, modelled on `tracker_pct_total` (V2:319-347) |
| F3 | major | `mapDbError` keeps `detail` only for `order_conflict` (errors.ts:38), and `useErrorText` doesn't interpolate | CONFIRMED (read errors.ts:34-41) | §4.2 extends both |
| F4 | major | The reverse pair direction (A moved after B's start) is untested | CONFIRMED | Added to A1, B1 tests and E2E |
| F5 | minor | Packing a k-lane block is underspecified | CONFIRMED | §4.5 specifies it |
| F6 | minor | Row heights already follow the lane count. PNG MAX_LANES = 20 | CONFIRMED (schedulePng.tsx:22-37) | B2 acceptance rewritten. The cap is noted in §7 |
| F7 | minor | No dictionary keys named | CONFIRMED | Keys listed |
| F8 | minor | `coalesce` in create_project; a flag on the first row | CONFIRMED | `coalesce(..., false)`. A flag on the lowest type is harmless (`lag` is null) and is stated |
| F9 | minor | Union signature churn | CONFIRMED | Only the `TypeRule` shape; `typeOrder` prop renamed `typeRule` |
| F10 | minor | State that `tracker_move_task` is covered by the trigger | CONFIRMED | Stated |

## Codex (verdict: REVISE)

| # | Sev | Finding | Verdict | Resolution (r2) |
|---|-----|---------|---------|-----------------|
| X1 | blocker | Private helper grant path | CONFIRMED (same as F1) | As F1 |
| X2 | major | RPC-only validation; test direct DML and both commit orders | CONFIRMED (same as F2) | As F2. A1 tests direct DML |
| X3 | major | B1 misses CreateTaskPopover and both parents | CONFIRMED | Added to B1 |
| X4 | major | `overlap_in_use` detail is not displayed | CONFIRMED (same as F3) | As F3 |
| X5 | major | PNG drops lanes ≥ 20; asks for pagination or an overflow indicator | PARTLY. The cap exists, but the same limit already applies to cross-cut overlaps today. A cut adds at most one sub-lane in practice | Not fixing (ponytail): noted in §7 as an existing ceiling |
| X6 | minor | The three-stage sentence is wrong when C is also flagged | CONFIRMED | Wording fixed; chained-flags test added |
| X7 | minor | Conflict wording covers only one direction | CONFIRMED | Two texts: `orderEarly` (starts before A starts) and `orderLate` (A starts after B started) |

## Critic round 2 (plan r2; verdict APPROVE WITH CHANGES)

| # | Sev | Finding | Verdict | Resolution (r3) |
|---|-----|---------|---------|-----------------|
| F11 | minor | The lag/lead scope is not shown, and the variable names are mixed | CONFIRMED | Scope and names unified |
| F12 | major | A deferred trigger never fires inside `begin … rollback`, so the dry run would pass vacuously | CONFIRMED (PG fires deferred constraint triggers at commit) | `set constraints tracker_type_order immediate` |
| F13 | minor | The first raise aborts the script; it needs a real allow-listed email | CONFIRMED | Savepoints; real email |
| F14 | minor | Lane test with two outcomes | CONFIRMED | Exact `[1, 2]` |
| F15 | minor | `orderConflictText` call sites missing | CONFIRMED | Listed |
| F16 | minor | The schema flag must stay required | CONFIRMED | Noted |
