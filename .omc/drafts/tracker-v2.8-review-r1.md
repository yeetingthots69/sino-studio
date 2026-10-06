# Tracker v2.8 review round 1 (plan r1) — verdicts

Reviewers: fable-critic (fresh context) and Codex (read-only), same r1 snapshot, not cross-fed. Verdicts by the orchestrator after checking evidence.

## fable-critic (verdict REVISE)
| ID | Finding | Verdict | Action in r2 |
|---|---|---|---|
| B1 | Column UPDATE revoke on cuts.budgets/pay_split breaks SECURITY INVOKER RPCs | Confirmed (`PRESET:35-40`) | Revoke dropped; validation triggers guard; S11 rewritten |
| M1 | phase_id NOT NULL before backfill not executable | Confirmed | §4.4 ordered steps |
| M2 | create_project new param = same signature, needs drop not replace | Confirmed | Single function with added param, drop + recreate + ACL |
| M3 | `code` not locked in SQL | Confirmed | Guard locks id/code/phase_id/sort_order/project_id; editor shows code read-only |
| M4 | Descendant predicate + sort key underspecified | Confirmed | §4.2 rule restated; O6 sort note |
| m1 | CutsView typeRule call sites not in C2 | Confirmed | Named in C2 |
| m2 | S2 two outcomes | Confirmed | One expected error per path |
| m3 | Legacy `budget` audit rows | Confirmed | CutDrawer keeps legacy branch |
| m4 | Phases insert one per statement | Confirmed | §4.3 |
| m5 | saveWorkTypes per-phase sum source | Confirmed | Read phase_id server-side |
| m6 | Role string keys | Confirmed | B3 lists en.json:680 / vi.json:684 |

## Codex
| # | Finding | Verdict | Action in r2 |
|---|---|---|---|
| 1 | Destructive Gate A breaks prod before code lands (shared DB) | Confirmed; owner chose two-step migration | §4.0 expand/contract, Gate B |
| 2 | = B1 | Confirmed | as B1 |
| 3 | `private` helper not callable from invoker trigger (`V2:9` revokes schema usage) | Confirmed | Recursive CTE inlined |
| 4 | `created_at` mutable via table UPDATE grant → lock bypass | Confirmed (`V1:80`) | created_at immutable trigger + test |
| 5 | Column revokes don't override table grant; type id mutable | Confirmed | Guard trigger, not grants |
| 6 | Stale split keys after type delete; all-stale fallback changes pay | Confirmed as possible (`SPLIT:2`) | Preflight + strip-only-if-no-pay-change, else stop |
| 7 | V26 compares global sort_order against all peers | Confirmed (`V26:55`) | Rule restated by phase relation |
| 8 | Backfill sequencing, deferred events | Confirmed | §4.4 incl. SET CONSTRAINTS IMMEDIATE, per-cut compare |
| 9 | projects/page.tsx loader missing; action owners | Confirmed | C1/C2 rows |
| 10 | Override indicator, CutDrawer, order checker scope | Confirmed | §4.6 |
| 11 | Undo restores only one phase budget | Confirmed | `p_budgets` full map when cut is re-created |
| 12 | Rollback harness can't show S2/S4/S11 | Confirmed | Committed fixture, immediate constraints, sequential merge |
| 13 | No numeric oracle; footer meaning | Confirmed | O8 + numeric fixtures |

## Round 2 (plan r2)

### fable-critic (verdict APPROVE, fixes folded into r3)
| ID | Finding | Verdict |
|---|---|---|
| M5 | Contract: trigger `UPDATE OF budget` depends on the column; drop trigger before the column | Confirmed |
| m7 | Sum of phase budgets can exceed the 1e10 check on `budget` | Confirmed (= Codex 2) |
| m8 | Old modal reorder silently ignored | Confirmed |
| m9 | INSERT sync picks an arbitrary phase on multi-phase projects | Confirmed |
| m10 | S8 last clause vacuous (parallel phases) | Confirmed |
| m11 | Work-types audit fires during backfill | Confirmed |
| m12 | Contract `p_phases` should be required | Confirmed |
| m13 | `notify pgrst, 'reload schema'` | Accepted (cheap) |

### Codex (verdict REVISE, folded into r3)
| # | Finding | Verdict |
|---|---|---|
| 1 | `{phase: null}` from omitted `p_budget` rejected by validator | Confirmed |
| 2 | Aggregate ceiling + `sum` null on empty | Confirmed |
| 3 | Old modal custom create half-succeeds in the window | Confirmed; documented, users told |
| 4 | SQL harness inside dry-run rollback / fixtures / membership | Confirmed |
| 5 | SQL can't prove PostgREST resolution | Confirmed; S12h HTTP E2E |
| 6 | Blanket grep contradicts legit params | Confirmed |
| 7 | CTE needs `public.` under empty search_path | Confirmed |
