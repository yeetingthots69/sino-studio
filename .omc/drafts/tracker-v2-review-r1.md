# Tracker v2 plan — review round 1 (snapshot: plan r1)

## Architect (orchestrator, 2026-09-30)

Steelman against Option A: for ~5 users, plpgsql triggers + string-keyed error mapping ('order_conflict', 'pct_total') are a brittle contract between SQL and TS, harder to debug than one RPC per write. Tension: DB authority (race-proof) vs app-level legibility. Synthesis: keep A, but route task creation through one RPC (fewer round trips, one error surface) and keep message keys as exported TS constants tested against SQL proofs.

Findings (to fold into r2):
- AR1 (high) Deploy order vs single Supabase project: dev and prod share `wsgtdbdtuxlfoueviuup`. Migration 1.1 drops `tasks.name`, `staff.strengths`, sets `cut_id not null` → the live v1 app breaks the moment 1.1 runs. Needs owner answer (is v1 in daily use?) → expand/contract split or accepted downtime.
- AR2 (high) Reorder lock vs insert-between: per-row `sort_order` lock + dense ordering means inserting a type between two used types forces renumbering → `type_in_use`. Use sparse ordering (10, 20, 30), `unique (project_id, sort_order) deferrable initially deferred`, RPC keeps given values; drop the "equal sort_order" clause.
- AR3 (high) Reversal after reassignment: adjustment guard requires a task with (cut, type, staff); after the stage is reassigned, reversing an old adjustment fails. Apply the task-existence check only when `reverses_id is null`. Drawer lists adjustments of former assignees too.
- AR4 (high) Assignment notices per task spam animators when a manager plans a month (one email per task) and double Resend calls per edit risk the 2 req/s rate limit. Coalesce per staff: one pending scheduled digest per staff (`unique (staff_id) where kind='assignment' and status='scheduled'`), content = the staff's upcoming tasks with the ones changed in the window highlighted; one retry on 429.
- AR5 (medium) createTask = 3 sequential PostgREST calls (upsert cut, select cut, insert task). Use invoker RPC `tracker_create_task(...) returns jsonb {task, cut}`; `tracker_ensure_cut(project, code, budget)` for cut changes in updateTask.
- AR6 (medium) MusicPlayer hides only on `/tracker`; the public share page lives under `[locale]` → hide on `/(en|vi)/share` too.
- AR7 (medium) Session PNG route `/api/tracker/png` is unneeded; PNG via share token only (share modal creates the share first). Remove it (also a stray sentence in §3.6 mentions an `ics/[token]/png` path).
- AR8 (low) Share page must select cuts by the ids of the loaded tasks only (not every cut of the project), and staff names only for `staff_ids`.
- AR9 (low) Realtime payload ordering: reducer ignores task payloads whose `version` < state version (already in pre-mortem 2; make it a contract line in §3.4).
- AR10 (low) Row 2.3 is the largest row; both halves edit `GanttBoard.tsx` → one executor, sequential sub-steps, reviewer after.

## Critic (fable-critic, critic-v2) — verdict REVISE — orchestrator verdicts

Note: launched concurrently with Codex (owner asked for sequential; fixed for round 2+). Both reviewed snapshot r1 independently.

- H1 shared DB → CONFIRMED; resolved by owner 2026-09-30: v1 not in real use → single migration, stated as precondition + pre-backfill asserts.
- H2 `UPDATE OF sort_order` fires on unchanged value → CONFIRMED (PG docs). Fix: `WHEN (old.sort_order is distinct from new.sort_order)`; audit trigger compares columns.
- H3 backfill vs trigger order → CONFIRMED. Fix: explicit statement order + asserts in SQL.
- M1 after() coalescing race → CONFIRMED; superseded by DB outbox (Codex #8).
- M2 ICS per member narrowed → CONFIRMED. Fix: `/api/tracker/ics/[token]/[staffId]`.
- M3 realtime versions soften G1 → CONFIRMED. Fix: expected version captured at interaction start (with Codex #1).
- M4 font tracing on Vercel → CONFIRMED (plausible, cheap). Fix: `outputFileTracingIncludes` + preview check.
- M5 23514 → generic → CONFIRMED (actions.ts:82-84). Fix: map to 'invalid'; SQL parity fixture test.
- M6 insert-between → CONFIRMED (= AR2). Sparse order.
- M7 conflict shape vs writeRow → CONFIRMED. Fix: explicit `{ok:false,error:'conflict',fresh}`; updateTask extends writeRow.
- L1–L8 → all CONFIRMED; L6 fixed by actor trigger; L8 resolved by relaxed adjustments (helpers) — adjustments stay on the staff profile after task delete, intended.

## Codex (codex-v2) — verdict AGREE WITH CHANGES — orchestrator verdicts

1 stale drag/draft with realtime version → CONFIRMED (useBarDrag baseline + GanttBoard realtime apply). Interaction-start version; chain advances only via own acks; delete versioned.
2 version regression via responses/refresh/deletes → CONFIRMED in part: single `reconcile()` with per-id max version + tombstones. Refresh generations → REJECTED (refresh now rare; version max covers regression).
3 type lock + create/reorder race → CONFIRMED. Project-level advisory xact lock in all rule triggers/RPCs.
4 empty type list / concurrent 100% → CONFIRMED. ≥1 type required; project lock.
5 equal sort_order + legacy exemption → CONFIRMED. Unique deferrable order; order check on every insert/update (legacy C10 test rows must be fixed or deleted by the owner; documented).
6 grants missing → CONFIRMED. Explicit grants per table.
7 reversal after reassignment → CONFIRMED (= AR3). Validate against original; non-reversal guard relaxed for helpers (owner N3).
8 coalescing not durable → CONFIRMED. DB outbox filled by trigger + pg_cron/pg_net worker; no after(), no Resend scheduling.
9 reminder idempotency suppresses failures → CONFIRMED. Status states + lease + Resend idempotency keys + retry.
10 public DTO → CONFIRMED. Presentational ScheduleGrid (not GanttBoard); referenced cuts/types only; `server-only` in admin.ts.
11 migration-first breaks v1 → CONFIRMED; owner: v1 not in use; asserts added.
12 headers/cache/cron guard → CONFIRMED. next.config headers for share pages, `private, no-store` on PNG/ICS, empty-secret guard.
13 Resend error handling → CONFIRMED except provider-status polling → REJECTED (webhooks/polling out of scope; status = accepted).
14 realtime gaps → work types in pay views CONFIRMED; public share 60 s refresh CONFIRMED; shares/audit/email publication REJECTED (not live-watched); initial-subscribe resync REJECTED (v1 deliberate; ~1 s gap).
15 month-only precheck → CONFIRMED. Project-wide stage index loaded + server conflict detail.

# Round 2 (snapshot r2)

## Critic (critic-v2) — APPROVE WITH CHANGES — verdicts
r1 H1–H3, M1–M7, L1–L8 all resolved per Critic.
- N-H1 email_log UPDATE not granted → CONFIRMED. Column-level UPDATE grant (status, resend_id, error, attempts) + policy.
- N-M1 composite FK indexes → CONFIRMED. Add indexes; drop redundant work_type_id index.
- N-M2 pg_cron/pg_net not installed; http timeout 5 s → CONFIRMED. Extensions in migration; timeout 60 s; AC for succeeded run.
- N-M3 INSERT trigger WHEN can't reference OLD → CONFIRMED (PG rule). Split _ins/_upd triggers.
- N-M4 deadlock task-row vs advisory lock → CONFIRMED (rare). writeRow retries once on 40P01.
- N-L1..L5 → CONFIRMED (exhausted rows surfaced; ponytail ceiling note; X-Robots on share paths only; S5 via RPC; lock proof review-only).

## Codex (codex-v2) — AGREE WITH CHANGES — verdicts
1 normalizer before prechecks; exact fixture assert → CONFIRMED.
2 invoker bodies can't call private helper → CONFIRMED. Inline advisory lock.
3 = N-H1 → CONFIRMED.
4 generation reset reuses idempotency key → CONFIRMED. cycle_id uuid per queue row.
5 retries must resend persisted payload → CONFIRMED. payload jsonb (from,to,subject,html) stored before first send; retries ≤ 24 h.
6 bounded atomic claims, retries outside 08:00, claim tokens → CONFIRMED. service_role-only claim RPCs with skip locked + limit.
7 project without types; project_id moves → CONFIRMED. Deferred check on project insert; project_id immutable on types/tasks.
8 own echo before ack → CONFIRMED. Provisional events while in flight; baselines for slider/links/delete.
9 refresh snapshot hides newer inserts; tombstones vs month-leave → CONFIRMED. Snapshot start time rule; tombstones only for real deletes.
10 stale notice for old assignee → CONFIRMED. task_ids on queue row; send only still-relevant tasks, else drop.
11 archived projects in studio totals; reversal month → CONFIRMED.
12 bulk retry-safety → CONFIRMED. Client op id + batches table via RPC.
13 ICS DTO sequence/stamp → CONFIRMED; publication narrowing → CONFIRMED (add shares; wording narrowed); bootstrap resync → REJECTED again (v1 perf decision; server version check prevents stale writes; documented in §8).
Rollback proofs need SET CONSTRAINTS ALL IMMEDIATE → CONFIRMED.

## Owner (2026-09-30, after round 2)
Bulk bonus/penalty must allow mixing bonuses and penalties in one batch → per-row sign + amount, optional per-row reason overriding the batch reason.
