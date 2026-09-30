# Plan: `/tracker` v2 — cuts, pipeline order, pay, sharing, Drive links, email

Status: **r3 — APPROVED 2026-09-30 (execution via /orchestrate-with-subagents, max 4 concurrent)** (Critic r2 APPROVE WITH CHANGES · Codex r2 AGREE WITH CHANGES · all accepted findings applied) (consensus, deliberate mode: data migration + public token access + money)
Date: 2026-09-30 · Builds on `.omc/plans/tracker-v1.md` (as-built: its §9 changelog) · Owner answers: `.omc/drafts/tracker-v2-decisions.md` (bottom section) · Review log: `.omc/drafts/tracker-v2-review-r1.md`
Execution: `/orchestrate-with-subagents`, max 4 concurrent subagents (opus-executor / sonnet-executor; separate reviewer per row).

## 1. Requirements summary

v2 turns the free-form board into a cut-based production pipeline with pay, and lets managers share schedules and resources with animators.

Owner decisions (2026-09-30; IDs from the decision page):
- **Cuts** (B1–B3): a cut is a record per project (`code`, `budget`, links). Every task belongs to exactly one cut (B2). Managers type a code in the task's cut box; existing cuts autocomplete, a new code creates the cut. Bulk "add C1…C40" in the Cuts view. Codes are normalised (trim, uppercase, no spaces, no leading zeros: `c 01` → `C1`).
- **Pipeline order** (C1–C5): one task per cut per work type (C5). A stage must start strictly after every earlier stage of the same cut ends, and end strictly before every later stage starts (C1). Checked on create and on every edit (C2); a violating write is blocked with a message naming the conflicting task (C3). Missing stages are not required (C4).
- **Work types per project** (D1–D3): defaults are a constant in code: LO / Layout 30 %, GE / Genga 30 %, DO + SH / Douga + Shiage 40 % (owner prototype values). Each project owns its list (≥ 1 type). Once a type has tasks, delete and reorder are locked; label, color and pay % stay editable and are audited (D2). Pay % must total exactly 100 (D3).
- **Board staff columns** (E1–E5): board only. Strengths column can be hidden; staff header cycles studio order → A–Z → Z–A; the strengths column filters by strength (multi). Strengths are a fixed list managed on the Staff page; "Toàn năng" (all-rounder) matches every filter. Choices persist per browser.
- **Create by click / drag** (F1): click an empty day (1 day) or drag across days on a staff row → popover (cut, work type, budget if the cut is new) → create.
- **Realtime + conflicts** (G1): every table shown on a management page publishes changes (projects, staff, strengths, work types, cuts, tasks, adjustments, shares; audit and email logs are read on open). A task edit is rejected when the task changed after the user started that edit; the user sees "changed by someone else" and the fresh values.
- **Pay** (H1–H6 + prototype values): stage pay = cut budget × work-type %. One person per stage, so a person's stage pay = sum of their stages across cuts. Earned when the task reaches 100 %, pending before. Derived live; budget / % changes audited. Every tracker user sees money. Bonuses/penalties: signed amount + required reason, append-only; removal = reversing entry with its own reason. No payout tracking.
- **Owner additions (2026-09-30)**:
  - **N1 Cuts-view look** (prototype "Copy values"): completed = type color + check badge; in progress = partial fill by progress; pay badge in the cell under the type label; earned when the stage reaches 100 %; comfortable density; full staff names; dates as `dd/mm–dd/mm`.
  - **N2 Earnings views**: a staff earnings list + staff profile, in two scopes: **project** (from a project: totals for that project) and **studio** (from the top-level tracker nav: totals across all projects).
  - **N3 Bulk bonus/penalty** in the Cuts view: pick several stages, add/deduct money for each stage's assignee, and add entries for helpers who are not the assignee (a member from another stage/cut who jumped in). **Bonuses and penalties can be mixed in one batch** (per-row sign and amount). One required batch reason; any row may override it with its own reason. Earnings history includes archived projects.
- **Staff email** (I1): optional; email features are disabled for staff without one.
- **Sharing** (J1–J4): (1) secret read-only link, no login, chosen members' rows, month navigation, auto-refresh every 60 s, revocable, no expiry; (2) a calendar feed URL **per member**; (4) PNG download of the chosen members' month. No pay in shares.
- **Drive** (K1–K4): pasted links on project, cut and task. Drive permissions stay in Drive.
- **Email** (L1–L4): manual "send resources" and "send schedule"; automatic assignment notice (digest per person, sent 10–15 min after the last change); daily deadline reminder. Vietnamese only. Sender `tracker@web.sinostudio.vn` (already-verified Resend domain; `TRACKER_MAIL_FROM`) — owner confirmed 2026-09-30. Every send is logged.
- **Precondition (owner, 2026-09-30):** the live v1 tracker is not in real use; the one Supabase project may break for v1 code between migration 1.1 and the v2 deploy. Existing rows are test data.

Out of scope (v2): payouts/paid status; member logins; Drive API (picker, auto-match, permission grants); Resend delivery status (webhooks/polling); role enforcement; Supabase Storage.

## 2. RALPLAN-DR summary

**Principles**
1. The database is the authority for every rule two managers can race on (order rule, one task per stage, % total, append-only pay), serialised by one per-project lock. Actions and UI pre-check only for friendly messages.
2. Convenience for non-technical managers: the cut box is a typed code with autocomplete; errors name the conflicting cut/stage/dates.
3. Derive, don't store: stage pay, earned/pending and totals are computed from budget × % × progress; only human inputs (budgets, %, adjustments) are stored and audited.
4. Public surfaces use one narrow server-only DTO with explicit fields; nothing public touches pay or emails.
5. Durable side effects: emails are driven by DB rows (outbox, log with states), never by fire-and-forget callbacks.
6. Reuse v1 plumbing (`writeRow`, realtime `setAuth`, `useRefreshScheduler`, `dates.ts`, dictionaries, CSS Modules). No new npm dependencies.

**Decision drivers (top 3)**
1. Correctness under concurrent edits by ~5 managers (G1, order rule, money).
2. Manager convenience (non-technical users).
3. Solo-dev delivery in waves, each usable on its own (A1).

**Options (main choice: where rules live)**

A. **DB-authoritative model** (chosen): tables + composite FKs + triggers (order rule, reorder lock, adjustment guard, actor stamping, audit, notice enqueue) + deferred constraint trigger for the % total + invoker RPCs for multi-row writes, all serialised per project with `pg_advisory_xact_lock`. Actions map DB errors to typed results.
- Pros: races impossible; any client path obeys the rules; SQL proofs test the rules once.
- Cons: plpgsql to write/review; error mapping between SQL message keys and TS (mitigated: keys are exported TS constants, covered by SQL proofs and a unit test).

B. **Action-enforced rules + pay snapshots**: actions read sibling rows and validate; pay rows written at 100 %.
- Pros: all logic in TypeScript.
- Cons: check-then-write race (no row locks through PostgREST); every write path must repeat checks; snapshots contradict H3. Rejected on driver 1.

C. **Supabase Edge Functions service** for rules and email.
- Pros: secrets off Vercel.
- Cons: second deploy target and auth path for 5 users. Rejected on driver 3.

Secondary choices:
- **Public reads:** server-only admin client behind a DTO module (chosen) vs an anon-executable SECURITY DEFINER RPC (breaks "advisors empty"; the email worker needs the admin client anyway).
- **Conflict detection:** integer `version` bumped by trigger, expected version captured at interaction start (chosen) vs `updated_at` compare (WAL vs PostgREST timestamp formats differ → false conflicts).
- **Pay computation:** one TS pure function (chosen) vs SQL view (second rounding site).
- **PNG:** `next/og` `ImageResponse` (built in) (chosen) vs `html-to-image` (new dep).
- **Assignment notices:** DB outbox row per staff written by a trigger, flushed every 5 min by `pg_cron` → `pg_net` → a Next route (chosen) vs Resend `scheduledAt` + cancel inside `after()` (races, not durable — review r1) vs immediate per-change emails (spam while a manager plans a month) vs Vercel Cron (sub-daily schedules need a paid plan; plan tier unknown).
- **Public page rendering:** a presentational `ScheduleGrid` (chosen) vs `GanttBoard` with a `readOnly` prop (mutation-heavy component, serialises full rows to the client).

## 3. Architecture

### 3.1 Schema — migration `tracker_v2` (one transaction via MCP `apply_migration`; local file identical)

Live facts (2026-09-30): 13 staff; project "Demo"; global work types LO 1 / GE 2 / DO + SH 3 (no archived); 4 tasks: C10 LO 09-04…07, C10 GE 09-04…06, C10 DO + SH 09-04…06 (these overlap — they violate the new order rule), C11 LO 09-12…15; 26 comma-split strength values; publication = `tracker_tasks` only; no `private` schema.

**Statement order (mandatory):** (0) extensions + `private` schema + `tracker_normalize_cut` → (1) pre-backfill asserts → (2) new tables without rule triggers → (3) add nullable columns → (4) backfill → (5) post-backfill asserts → (6) NOT NULL / constraints / indexes / drops → (7) functions, triggers, RPCs → (8) RLS, grants → (9) publication.

(0):
```sql
create extension if not exists pg_cron;                        -- available, not installed (verified); schema per Supabase docs
create extension if not exists pg_net with schema extensions;
create schema if not exists private;                           -- not exposed by PostgREST; holds trigger functions only
revoke all on schema private from anon, authenticated, public;

create function public.tracker_normalize_cut(raw text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(upper(regexp_replace(raw, '\s', '', 'g')), '^C0+(?=[0-9])', 'C')
$$;  -- TS mirror normalizeCutCode must match (fixture test)
```

(1) Pre-backfill asserts (`do $$ … raise exception … $$`), against the exact supported fixture — abort on any drift: exactly 1 project; exactly 3 work types (codes LO, GE, DO + SH), none archived; every task in that project; every `tracker_normalize_cut(name)` has length 1–20; no two tasks share (normalised name, work type).

(2)–(6) Objects:

```sql
create table public.tracker_cuts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  code text not null check (length(code) between 1 and 20 and code = public.tracker_normalize_cut(code)),
  budget bigint not null default 0 check (budget between 0 and 10000000000),        -- VND
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code),
  unique (id, project_id)
);

alter table public.tracker_work_types
  add column project_id uuid references public.tracker_projects(id) on delete cascade,
  add column pay_pct numeric(5,2) not null default 0 check (pay_pct between 0 and 100),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();
-- backfill: project_id = Demo; sort_order = 10/20/30 (LO/GE/DO + SH); pay_pct = 30/30/40
alter table public.tracker_work_types
  alter column project_id set not null,
  drop constraint tracker_work_types_code_key,
  drop column archived_at,
  add constraint tracker_work_types_project_code_key unique (project_id, code),
  add constraint tracker_work_types_id_project_key unique (id, project_id),
  add constraint tracker_work_types_project_order_key unique (project_id, sort_order) deferrable initially deferred;

alter table public.tracker_tasks
  add column cut_id uuid,
  add column version int not null default 1,
  add column links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 20);
-- backfill: insert into tracker_cuts (project_id, code) select distinct project_id, tracker_normalize_cut(name) … ;
--           update tracker_tasks set cut_id = … (rule triggers do not exist yet)
alter table public.tracker_tasks
  alter column cut_id set not null,
  drop column name,
  drop constraint tracker_tasks_work_type_id_fkey,
  add constraint tracker_tasks_cut_fk  foreign key (cut_id, project_id) references public.tracker_cuts(id, project_id) on delete restrict,
  add constraint tracker_tasks_type_fk foreign key (work_type_id, project_id) references public.tracker_work_types(id, project_id) on delete restrict,
  add constraint tracker_tasks_cut_type_key unique (cut_id, work_type_id);
create index on public.tracker_tasks (cut_id, project_id);           -- covers tracker_tasks_cut_fk
create index on public.tracker_tasks (work_type_id, project_id);     -- covers tracker_tasks_type_fk
drop index public.tracker_tasks_work_type_id_idx;                    -- now redundant (name verified at execution)

alter table public.tracker_projects add column links jsonb not null default '[]'
  check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 20);

alter table public.tracker_staff add column email text
  check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create unique index tracker_staff_email_key on public.tracker_staff (email) where email is not null;
create table public.tracker_strengths (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (length(trim(label)) between 1 and 40),
  all_rounder boolean not null default false,
  sort_order int not null default 0
);
create table public.tracker_staff_strengths (
  staff_id uuid not null references public.tracker_staff(id) on delete cascade,
  strength_id uuid not null references public.tracker_strengths(id) on delete cascade,
  primary key (staff_id, strength_id)
);
create index on public.tracker_staff_strengths (strength_id);
-- backfill: LO(1) Genga(2) Douga + Shiage(3) Sakkan(4) Toàn năng(5, all_rounder)
--   from regexp_split_to_table(strengths, '\s*,\s*'); junction rows; then drop column tracker_staff.strengths

-- One row per submission (single entry, bulk batch or reversal); id = client operation id → retry-safe
create table public.tracker_adjustment_batches (
  id uuid primary key,                            -- generated by the client once per form submission
  project_id uuid not null references public.tracker_projects(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 500),
  created_by text not null,                       -- stamped by trigger
  created_at timestamptz not null default now()
);
create index on public.tracker_adjustment_batches (project_id);

create table public.tracker_pay_adjustments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.tracker_adjustment_batches(id) on delete restrict,
  project_id uuid not null,
  cut_id uuid not null,
  work_type_id uuid not null,
  staff_id uuid not null references public.tracker_staff(id) on delete restrict,
  amount bigint not null check (amount <> 0 and abs(amount) <= 10000000000),   -- signed: bonus > 0, penalty < 0
  reason text not null check (length(trim(reason)) between 3 and 500),         -- row override or the batch reason
  reverses_id uuid unique references public.tracker_pay_adjustments(id) on delete restrict,
  created_by text not null,                       -- stamped by trigger
  created_at timestamptz not null default now(),
  foreign key (cut_id, project_id) references public.tracker_cuts(id, project_id) on delete restrict,
  foreign key (work_type_id, project_id) references public.tracker_work_types(id, project_id) on delete restrict
);
create index on public.tracker_pay_adjustments (cut_id, project_id);
create index on public.tracker_pay_adjustments (work_type_id, project_id);
create index on public.tracker_pay_adjustments (staff_id);
create index on public.tracker_pay_adjustments (batch_id);

create table public.tracker_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,                                     -- lower(jwt email); null for service role
  table_name text not null,
  row_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  old jsonb, new jsonb
);
create index on public.tracker_audit_log (table_name, row_id);

create table public.tracker_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.tracker_projects(id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9_-]{43}$'),   -- randomBytes(32).base64url, server-side
  staff_ids uuid[] not null check (cardinality(staff_ids) between 1 and 50),
  label text check (label is null or length(label) <= 80),
  created_by text not null,                                            -- stamped by trigger
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index on public.tracker_shares (project_id);

-- Assignment-notice outbox: at most one open debounce cycle per staff (digest)
create table public.tracker_notice_queue (
  staff_id uuid primary key references public.tracker_staff(id) on delete cascade,
  cycle_id uuid not null default gen_random_uuid(),   -- new per inserted row → never reused after delivery
  generation int not null default 1,                  -- bumps on every enqueue within the cycle
  task_ids uuid[] not null default '{}',              -- tasks whose assignment/dates changed in this cycle
  first_change_at timestamptz not null default now(),
  due_at timestamptz not null,                        -- last change + 10 min
  claimed_until timestamptz                           -- worker lease; reset to null by every enqueue
);
-- The worker converts a due queue row into an email_log row (payload persisted) and deletes the queue row
-- if its generation is unchanged; all retries then operate on the email_log row.

create table public.tracker_email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('resources','schedule','assignment','reminder')),
  staff_id uuid references public.tracker_staff(id) on delete set null,
  to_email text not null,
  subject text not null,
  payload jsonb not null,                         -- {from, to, reply_to?, subject, html}: exactly what is (re)sent
  status text not null check (status in ('pending','accepted','failed')),
  idempotency_key text not null unique,           -- Resend Idempotency-Key; e.g. assign-{cycle_id}-{generation}
  resend_id text,
  error text,
  attempts int not null default 0,
  claim_token uuid,                               -- worker lease token
  claimed_until timestamptz,
  ref_date date,                                  -- reminders
  task_id uuid, cut_id uuid,                      -- context only (no FK: log outlives rows)
  created_by text,                                -- stamped by trigger; null for worker
  created_at timestamptz not null default now()
);
create index on public.tracker_email_log (created_at desc);
create index on public.tracker_email_log (staff_id);
create index on public.tracker_email_log (status, created_at) where status <> 'accepted';
create unique index tracker_email_reminder_once on public.tracker_email_log (staff_id, ref_date) where kind = 'reminder';
```

(5) Post-backfill asserts: no task with null `cut_id`; tasks count unchanged (4); every project has ≥ 1 type and `sum(pay_pct) = 100`; junction rows = number of non-empty comma-split values (26).

(7) Functions (all `set search_path = ''`, qualified names; EXECUTE revoked from `anon, public`).
**Project lock** = the inline statement `perform pg_advisory_xact_lock(hashtextextended(<project_id>::text, 0));` written directly in each trigger/RPC body below (invoker code cannot call helpers in the unexposed `private` schema). All rule-relevant writes of one project are serialised by it.
**Triggers with a WHEN that reads OLD are split** into `_ins` (no WHEN) and `_upd` (WHEN …) triggers (Postgres forbids OLD in INSERT trigger conditions).
1. `private.tracker_task_order()` — BEFORE INSERT OR UPDATE ON `tracker_tasks` (every update, C2), SECURITY INVOKER: on UPDATE raise `invalid` (`P0001`, message `project_immutable`) if `project_id` changed; project lock; find the first task `t` of `new.cut_id`, `t.id <> new.id`, whose type's `sort_order` < new's with `t.end_date >= new.start_date`, or > new's with `t.start_date <= new.end_date` → `raise exception using errcode = 'P0001', message = 'order_conflict', detail = t.id::text`. (Legacy C10 rows: any edit is refused until their dates are fixed or the rows deleted — test data, owner's choice.)
2. `private.tracker_bump_version()` — BEFORE UPDATE ON `tracker_tasks`: `new.version := old.version + 1; new.updated_at := now()` (replaces `t_upd` on tasks). `public.set_updated_at` triggers added on `tracker_cuts`, `tracker_work_types`.
3. `private.tracker_type_guard()` — BEFORE INSERT OR UPDATE OR DELETE ON `tracker_work_types`, SECURITY INVOKER: project lock (old/new project); on UPDATE raise `project_immutable` if `project_id` changed; on UPDATE when `old.sort_order is distinct from new.sort_order`, or on DELETE: if a task references the row → `raise … message = 'type_in_use'`.
4. `private.tracker_pct_total()` — CONSTRAINT TRIGGERs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW, on `tracker_work_types` (AFTER INSERT OR UPDATE OR DELETE) **and on `tracker_projects` (AFTER INSERT)**: for the affected project if it still exists: `count(*) >= 1 and sum(pay_pct) = 100`, else `raise … message = 'pct_total'`. A project inserted without types therefore fails at commit.
5. `private.tracker_adjustment_guard()` — BEFORE INSERT ON `tracker_pay_adjustments`: stamp `created_by := lower(auth.jwt()->>'email')` (null → raise); the batch row's `project_id` equals new's; if `reverses_id is null`: staff not archived (any staff — helpers allowed, N3); if set: original exists, original `reverses_id is null`, and new `project_id, cut_id, work_type_id, staff_id` equal the original's and `amount = -original.amount` — else `raise … message = 'adjustment_invalid'`.
6. `private.tracker_stamp_actor()` — BEFORE INSERT ON `tracker_shares`, `tracker_email_log`, `tracker_adjustment_batches`: `new.created_by := lower(auth.jwt()->>'email')` (null only under service role; the NOT NULL columns on shares and batches mean only users can create them).
7. `private.tracker_audit()` — AFTER triggers, SECURITY DEFINER (owner `postgres`, which bypasses RLS — verified `rolbypassrls`; not RPC-callable: `private` schema, returns `trigger`): insert `(actor, table_name, row_id, action, to_jsonb(old), to_jsonb(new))`. Attached to `tracker_cuts`, `tracker_work_types`, `tracker_tasks` (`_ins`, `_upd`, `_del`) and `tracker_pay_adjustments` (`_ins`). `_upd` WHEN: `old.* is distinct from new.*`; for tasks only `cut_id, work_type_id, staff_id, start_date, end_date, progress` are compared.
8. `private.tracker_enqueue_notice()` — AFTER triggers on `tracker_tasks`, SECURITY DEFINER (writes the outbox users cannot write): `_ins` always; `_upd` WHEN `staff_id, start_date, end_date, cut_id, work_type_id` distinct. Body: `insert into public.tracker_notice_queue (staff_id, task_ids, due_at) values (new.staff_id, array[new.id], now() + interval '10 minutes') on conflict (staff_id) do update set due_at = excluded.due_at, generation = tracker_notice_queue.generation + 1, task_ids = (select array_agg(distinct x) from unnest(tracker_notice_queue.task_ids || new.id) x), claimed_until = null` (keeps `cycle_id`, `first_change_at`). Progress/links edits never enqueue. The old assignee is not enqueued; the worker drops task ids no longer assigned to the queued staff (§3.7).

RPCs (public schema):
- SECURITY INVOKER, `grant execute … to authenticated` (RLS applies):
  - `tracker_create_project(p_name text, p_color text, p_types jsonb) returns public.tracker_projects`.
  - `tracker_save_work_types(p_project uuid, p_types jsonb) returns setof public.tracker_work_types` — `p_types` = full desired list `[{id?, code, label, color, pay_pct, sort_order}]`; project lock; updates/inserts/deletes; the deferred unique on `(project_id, sort_order)` allows swaps of unused types.
  - `tracker_create_task(p_project uuid, p_staff uuid, p_type uuid, p_cut_code text, p_start date, p_end date, p_budget bigint default null) returns jsonb` → `{task, cut}`: normalise code, `insert … on conflict (project_id, code) do nothing` (budget only on insert), select cut, insert task.
  - `tracker_ensure_cut(p_project uuid, p_code text) returns public.tracker_cuts` (cut changes in the task panel).
  - `tracker_add_adjustments(p_batch uuid, p_project uuid, p_reason text, p_entries jsonb) returns setof public.tracker_pay_adjustments` — `insert into tracker_adjustment_batches (id, project_id, reason) … on conflict (id) do nothing`; if the batch already existed → return its rows unchanged (retry-safe); else insert every entry `{cut_id, work_type_id, staff_id, amount, reason?}` (row reason defaults to `p_reason`, `reverses_id` optional) in one statement and return them.
- Service role only (`revoke execute … from public, anon, authenticated; grant execute … to service_role`), SECURITY INVOKER — used by the email worker through the admin client:
  - `tracker_claim_notices(p_limit int, p_lease interval) returns setof public.tracker_notice_queue` — `update tracker_notice_queue set claimed_until = now() + p_lease where staff_id in (select staff_id from tracker_notice_queue where due_at <= now() and (claimed_until is null or claimed_until < now()) order by due_at for update skip locked limit p_limit) returning *`. The worker then inserts the email-log row (`on conflict (idempotency_key) do nothing`) and deletes the queue row `where staff_id = … and cycle_id = … and generation = <claimed>`; a crash before the delete lets the lease expire and the row is reclaimed (the insert is idempotent), and a newer enqueue (higher generation) survives with `claimed_until` reset to null by the enqueue upsert.
  - `tracker_claim_emails(p_limit int, p_lease interval) returns setof public.tracker_email_log` — `update tracker_email_log set claim_token = gen_random_uuid(), claimed_until = now() + p_lease, attempts = attempts + 1 where id in (select id from tracker_email_log where status in ('pending','failed') and attempts < 5 and created_at > now() - interval '23 hours' and (claimed_until is null or claimed_until < now()) order by created_at for update skip locked limit p_limit) returning *`. Completion updates are conditioned on `claim_token`.

(8) RLS + grants (explicit; policies alone grant nothing):

| Table | Policy (to authenticated, `(select public.is_tracker_user())`) | Grants to authenticated |
|---|---|---|
| `tracker_cuts`, `tracker_strengths`, `tracker_staff_strengths`, `tracker_shares` | for all | select, insert, update, delete |
| `tracker_adjustment_batches`, `tracker_pay_adjustments` | select; insert | select, insert |
| `tracker_audit_log` | select | select |
| `tracker_email_log` | select; insert; update | select, insert, **update (status, resend_id, error, attempts) only** (column grant; manual sends finalise their own row) |
| `tracker_notice_queue` | none | none (definer trigger + service role only) |

`revoke all … from anon, authenticated` first on every new table. Existing tables keep their v1 grants.

(9) Publication: `alter publication supabase_realtime add table public.tracker_projects, public.tracker_staff, public.tracker_cuts, public.tracker_work_types, public.tracker_strengths, public.tracker_staff_strengths, public.tracker_pay_adjustments, public.tracker_shares;`

After migration: `list_migrations` → rename local file to the applied version; `get_advisors` security + performance empty; regenerate `database.types.ts` + supazod (CLAUDE.md "Types regen"); `src/utils/supabase/admin.ts` gets `import 'server-only'`.

### 3.2 Pure helpers (unit-tested, `src/components/tracker/`)

```ts
// cuts.ts
export function normalizeCutCode(raw: string): string;              // parity fixture: 12 inputs of S1 with SQL outputs committed
export function compareCutCodes(a: string, b: string): number;      // natural: C2 < C10 < C10A
export function cutRange(from: number, to: number): string[];       // 1 ≤ from ≤ to, ≤ 200 codes
// pipeline.ts
export type StageTask = {id: string; cut_id: string; work_type_id: string; start_date: ISODate; end_date: ISODate};
export function orderConflict(stages: StageTask[], typeOrder: Map<string, number>, candidate: StageTask): StageTask | null;
// pay.ts
export function pctHundredths(p: number): number;                   // Math.round(p * 100)
export function stagePay(budget: number, payPct: number): number;   // Math.round(budget * pctHundredths(payPct) / 10000)
export function pctTotalOk(pcts: number[]): boolean;                // sum of hundredths === 10000 and length ≥ 1
export type PayLine = {task_id: string; project_id: string; cut_id: string; work_type_id: string; staff_id: string; amount: number; earned: boolean; end_date: ISODate};
export function payLines(tasks, cuts, types): PayLine[];            // earned = progress === 100
export type Totals = {earned: number; pending: number; adjustments: number; total: number};   // total = earned + pending + adjustments
export function staffTotals(lines: PayLine[], adjustments): Map<string, Totals>;
// ics.ts
export function buildIcs(calName: string, events: {uid: string; start: ISODate; endInclusive: ISODate; summary: string; description?: string; sequence: number; stamp: string}[]): string;
//   CRLF; DTSTART;VALUE=DATE; DTEND = endInclusive + 1 day; SEQUENCE; RFC 5545 escaping (\\ ; , newline); fold at 75 octets (UTF-8 safe)
// staffView.ts
export type StaffSort = 'studio' | 'az' | 'za';
export function viewStaff(staff, strengthIdsByStaff, allRounderIds: Set<string>, opts: {sort: StaffSort; filter: string[]}): Staff[];
//   filter empty → all; else staff with any selected strength OR any all-rounder strength; az/za via localeCompare(…, 'vi')
// GanttBoard/dragMath.ts
export function dayIndexFromX(offsetX: number, dayWidth: number, days: number): number;       // floor, clamped 0..days-1
// GanttBoard/taskSync.ts (pure, tested) — see §3.4
export function reconcile(state: TaskState, input: ConfirmedInput): TaskState;
```

### 3.3 Server actions (`src/app/[locale]/tracker/actions.ts`)

Result type: `ActionResult<T> = {ok: true; data: T} | {ok: false; error: TrackerError; detail?: string} | {ok: false; error: 'conflict'; fresh: TaskRow}`.
`TrackerError` = `'network' | 'unauthenticated' | 'invalid' | 'duplicate' | 'not_found' | 'in_use' | 'order_conflict' | 'pct_total' | 'generic'`.
`writeRow` error mapping (message keys exported as TS constants shared with tests): `P0001` + `order_conflict` → `'order_conflict'` (`detail` = conflicting task id); `type_in_use` → `'in_use'`; `pct_total` → `'pct_total'`; `adjustment_invalid` / `project_immutable` → `'invalid'`; `23503` → `'in_use'`; `23505` → `'duplicate'`; `23514` → `'invalid'`; other `P0001` → `'generic'`. `40P01` (deadlock between a task row lock and the project lock — possible only when a type delete races a task edit) → the write is retried once, then `'generic'`.

| Action | Input (zod) | Notes |
|---|---|---|
| `createTask` | `project_id, staff_id, work_type_id: uuid; cut_code: 1–20; start_date, end_date; budget?: int 0–1e10` | RPC `tracker_create_task`. Returns `{task, cut}`. `NO_REVALIDATE`. |
| `updateTask` | `id: uuid; expected_version: int ≥ 1; patch: partial {cut_code, staff_id, work_type_id, start_date, end_date, progress, links}` | `cut_code` → `tracker_ensure_cut` first (an orphan empty cut on a later conflict is accepted). `.update(patch).eq('id').eq('version', expected_version).select().maybeSingle()`; no row → reselect by id: found → `{ok:false, error:'conflict', fresh}`, else `'not_found'`. Implemented as a `writeRow` variant (`writeVersioned`) so auth/zod/error mapping stay shared. |
| `deleteTask` | `id; expected_version` | `.delete().eq('id').eq('version', …)` with the same conflict path. |
| `createCuts` | `project_id; from, to: int; budget?: int` | bulk insert `cutRange`, `onConflict ignoreDuplicates`; returns inserted rows. |
| `updateCut` | `id; patch: {budget?, links?, code?}` | code normalised; `refresh()`. |
| `deleteCut` | `id` | FK restrict → `'in_use'`. |
| `createProject` | `name, color` | RPC `tracker_create_project` with `DEFAULT_WORK_TYPES`. |
| `updateProject` | `id; name?, color?, links?` | |
| `saveWorkTypes` | `project_id; types: [{id?, code 1–20, label 1–80, color hex, pay_pct 0–100 (≤ 2 decimals), sort_order int}] (≥ 1)` | refine: `pctTotalOk`, codes unique, sort_orders unique. RPC. |
| `createStaff` / `updateStaff` | + `email?: lowercased email | null`; `strength_ids: uuid[]` | strengths: delete-missing + insert-new (idempotent). |
| `createStrength` / `updateStrength` / `deleteStrength` | `label 1–40, all_rounder, sort_order` | Staff page manager. |
| `addAdjustments` | `op_id: uuid (client-generated once per form open); project_id; reason 3–500; entries: [{cut_id, work_type_id, staff_id: uuid; amount: int ≠ 0 (signed, bonus/penalty mixed freely), |amount| ≤ 1e10; reason?: 3–500}] (1–100)` | RPC `tracker_add_adjustments` (atomic; a retry with the same `op_id` returns the original rows). Drawer single entry uses the same action. |
| `reverseAdjustment` | `op_id: uuid; id: uuid; reason 3–500` | reads the original, calls the same RPC with one entry `{…original keys, amount: -original.amount, reverses_id: id}` (guard validates). |
| `createShare` / `revokeShare` | `project_id, staff_ids (1–50), label?` / `id` | token = `randomBytes(32).toString('base64url')`. |
| `sendResources` | `{task_id} | {cut_id}` | §3.7 |
| `sendSchedule` | `share_id; month` | §3.7 |

Removed: `createWorkType`, `updateWorkType`, `archiveWorkType`, the work-types page, `WorkTypesTable`, nav link, dictionary keys.

`DEFAULT_WORK_TYPES` (`src/components/tracker/defaults.ts`): `[{code:'LO', label:'Layout', color:'#3b82f6', pay_pct:30, sort_order:10}, {code:'GE', label:'Genga', color:'#22c55e', pay_pct:30, sort_order:20}, {code:'DO + SH', label:'Douga + Shiage', color:'#eab308', pay_pct:40, sort_order:30}]`.

### 3.4 Board (`GanttBoard/`)

- **Loader** (`[projectId]/page.tsx`, parallel): project; work types of the project; staff; strengths + junction; cuts of the project; tasks overlapping the month (render set); **stage index** = all project tasks `id, cut_id, work_type_id, staff_id, start_date, end_date, version` (for pre-checks and C5 chip disabling across months).
- **Task sync contract** (`taskSync.ts`, pure + tested):
  - State keeps per id: confirmed row, confirmed `version`, `confirmedAt` (client clock when last confirmed); plus a tombstone set of **physically deleted** ids (own delete ack or realtime DELETE only — a task leaving the viewed month is removed from the render set, never tombstoned).
  - `reconcile()` is the only entry for confirmed data — action responses, realtime payloads and refreshed props: accept a row only if its `version` > the confirmed version (equal version = no-op); rows for tombstoned ids are ignored.
  - **Refresh snapshots:** `requestRefresh()` records `snapshotStartedAt`. When new props arrive: rows in the props go through the version rule; a row missing from the props is removed only if its `confirmedAt` < `snapshotStartedAt` (covers missed DELETEs); rows confirmed after the snapshot started (e.g. a realtime INSERT during the refresh) are kept. Month navigation remounts the board (fresh state).
  - **Baselines:** every user interaction records the task's confirmed version when it starts — pointerdown for drag/resize; first keystroke for the cut draft or a links draft; first `onChange` of a slider gesture; opening the delete confirmation; the change event for chips/selects/date inputs.
  - **Provenance:** while an own commit for a task is in flight, realtime payloads for that task are held as provisional. When the action settles: a held payload whose version equals the ack version is the own echo; a higher version is a foreign change (reconciled and recorded as `foreignAt`); lower versions are dropped. Without an in-flight commit every payload with a higher version is foreign.
  - **Commit:** sends `expected_version = baseline`, except when the only confirmed versions since the baseline are the user's own acks on that task — then the latest own ack. If a foreign change was recorded after the baseline, the commit is not sent: revert, show the conflict notice with fresh values. The server check covers realtime lag.
  - **Per-task chain:** commits for one task run one at a time; if one fails or conflicts, queued commits for that task are dropped and their optimistic patches reverted.
  - `'conflict'` response → drop the optimistic patch, `reconcile(fresh)`, show "Công việc vừa được người khác sửa — đang hiển thị bản mới nhất" / "Changed by someone else — showing the latest". `'order_conflict'` → revert and show e.g. "Không thể xếp: C12 · LO (10/09–14/09) chưa kết thúc" built from the stage index (fallback: generic message).
- **Click / drag create** (`useDragCreate.ts`): pointerdown on the `.track` element itself (not a bar; left button; active staff only) → `dayIndexFromX`; mouse/pen drag extends a ghost; touch = tap only (no drag; horizontal scroll unaffected). Pointerup → `CreateTaskPopover` anchored to the ghost; Escape / outside click cancels. The "+" button opens the popover on the 1st of the month (or today if within the month).
- **`CreateTaskPopover`**: cut `Autocomplete` (project cuts, natural order; typed value shown normalised; "new cut" hint); work type chips — chips already used by that cut (stage index) disabled; budget `NumberInput` only for a new cut; `orderConflict` pre-check message; submit → `createTask`.
- **TaskPanel**: cut `Autocomplete` replaces the name input (commit on option pick / blur, normalised); task links editor + read-only cut and project links; "Gửi tài liệu" (disabled without assignee email); conflict / order messages.
- **Staff columns**: staff header click cycles `studio → az → za`; strengths header: filter `MultiSelect` + hide toggle (hidden → grid drops the 220 px column, sticky offsets shift); STT numbers the displayed order; prefs in `localStorage` key `tracker.board.v1` via `useSyncExternalStore` (server snapshot = defaults).
- **View switcher** in the board header: "Lịch" | "Cut" | "Nhân sự" (project earnings, §3.5) — links preserve `?m=`.
- **Share button** → `ShareModal` (§3.6). Staff names link to the project-scope profile.
- **Realtime**: existing `useTaskRealtime` feeds `reconcile()`; `tracker_cuts` payloads update the cuts map; `useRealtimeRefresh(['tracker_work_types','tracker_staff','tracker_strengths','tracker_staff_strengths'])`.

### 3.5 Cuts view, pay, earnings (N1–N3)

- **Cuts view** `(app)/[projectId]/cuts/page.tsx`. Loader: project, work types, cuts, all project tasks, staff (id, name, email, archived_at), adjustments of the project, audit rows for the project's cuts/types (latest 200). Rows = cuts natural-sorted; columns = work types by `sort_order`.
  - Cell (N1): lit in the type color; full assignee name; `dd/mm–dd/mm`; progress; in progress = partial fill by progress; completed = type color + check badge; pay badge in the cell under the type label (`stagePay`); empty = dim "—" with "+" (click → `CreateTaskPopover` in cut mode: cut + type fixed, pick staff + dates); "chờ LO" hint when an earlier existing stage is < 100 %. Comfortable density.
  - Sticky first column: code + inline budget `NumberInput` (commit on blur → `updateCut`). Footer: per-type totals + grand total. "Thêm cut" modal (from/to + optional budget) → `createCuts`.
- **Drawer** (lit cell): `budget × % = amount`; people rows = assignee plus anyone with adjustments on that stage (former assignees, helpers): base (assignee only), adjustments sum, total, earned/pending; adjustments list newest first (reversed entries struck through, reversal entries labelled, batch entries tagged "hàng loạt"); add form (staff select defaulting to the assignee, signed amount, required reason) → `addAdjustments` with one entry; "Hoàn tác" asks for a reason inline → `reverseAdjustment`. Cut links editor + "Gửi tài liệu" (assignees of the cut with an email). Audit list for this cut / its types.
- **Bulk bonus/penalty (N3)**: toolbar button "Thưởng/phạt hàng loạt" → selection mode (checkbox overlay on lit and empty-but-existing-cut cells; count shown) → "Tiếp tục" → modal (an `op_id` uuid is generated when it opens): one row per selected stage pre-filled with its assignee (staff select, any active staff); **each row has its own "+ Thưởng / − Phạt" toggle and amount, so bonuses and penalties mix freely in one batch**; "áp dụng cho tất cả" copies one sign + amount to every row; "Thêm người hỗ trợ" adds a row (stage select + staff select) for helpers; one required batch reason plus an optional per-row reason that overrides it; preview of the per-person net (e.g. "Tôm −200.000 ₫ · Vũ Thư +200.000 ₫"); submit → `addAdjustments` (atomic, retry-safe). Cancel leaves nothing behind.
- **Earnings list + profile (N2)**, both driven by `payLines` + `staffTotals`:
  - Project scope: `(app)/[projectId]/people/page.tsx` (view switcher "Nhân sự") — table of staff with any stage or adjustment in the project: earned / pending / adjustments / total, sortable by total; row → `(app)/[projectId]/people/[staffId]`.
  - Studio scope: `(app)/people/page.tsx` (new nav item "Thu nhập" / "Earnings" in `TrackerShell`) — same table across **all projects, archived included** (historical earnings), plus a per-project breakdown column (archived projects marked); row → `(app)/people/[staffId]`. `ponytail:` loads every project's tasks, cuts, types and adjustments per render and computes with `payLines`/`staffTotals` — fine for a few thousand tasks; add a SQL aggregate only if measured slow, and never as a second pay formula.
  - Profile: header (name, strengths, email), totals, stage table (project [studio scope only], cut, type, dates, status, amount), adjustments (with reasons, author, batch tag, reversals). Month filter `?m=YYYY-MM` or `?m=all` (default: `all` in project scope, current month in studio scope). Effective month: a stage → its task's `end_date` month; an adjustment → its stage task's `end_date` month when the task exists, else its `created_at` month; **a reversal → the effective month of the entry it reverses**.
  - Staff page names link to the studio profile; board staff names to the project profile.
- Realtime for the cuts view, earnings list and profiles: `useRealtimeRefresh(['tracker_tasks','tracker_cuts','tracker_work_types','tracker_pay_adjustments'])` → debounced `router.refresh()` via `useRefreshScheduler`, deferred while a budget input, drawer form or bulk modal is dirty.

### 3.6 Sharing

- `ShareModal` (board): pick staff (multi), optional label → `createShare`; list of the project's shares with: copy link, per-member calendar URLs (one copy button per member), download PNG (viewed month), send schedule email, revoke (inline two-step).
- **Public DTO** `src/lib/tracker/shareData.ts` (`import 'server-only'`; the only importer of `createAdminClient` besides the email worker): `loadShare(token, month)` → `{project: {name}, month, staff: {id, name}[], types: {id, code, label, color, sort_order}[] (only referenced), cuts: {id, code, links}[] (only referenced by returned tasks), tasks: {id, staff_id, cut_id, work_type_id, start_date, end_date, progress, links}[]}` — scope comes only from the share row (`project_id`, `staff_ids`), `revoked_at is null`, else `null`. Never selects `budget`, `pay_pct`, `email`, adjustments, other staff. `loadShareMember(token, staffId)` for ICS: all tasks of that member in the project with `{id, cut_code, type_code, start_date, end_date, links, version, updated_at}` (UID = `task.id@sinostudio.vn`, SEQUENCE = `version`, DTSTAMP/LAST-MODIFIED = `updated_at`); `null` if `staffId ∉ staff_ids`.
- **Public page** `src/app/[locale]/share/[token]/page.tsx`: `dynamic = 'force-dynamic'`, `robots: noindex`; renders `ScheduleGrid` (new presentational server component: month grid, rows per member, bars with cut · type, dates, progress, links with `rel="noreferrer noopener"`), month nav links, a tiny client `AutoRefresh` (`router.refresh()` every 60 s; a revoked token turns into the 404 on the next refresh). `null` DTO → `notFound()`.
- **ICS** `src/app/api/tracker/ics/[token]/[staffId]/route.ts`: `buildIcs`; summary `C12 · GE`; description = links; `Content-Type: text/calendar; charset=utf-8`.
- **PNG** `src/app/api/tracker/share/[token]/png/route.ts?m=`: `renderSchedulePng(dto)` in `src/lib/tracker/schedulePng.tsx` via `ImageResponse` (`next/og`), flexbox only, width = 220 + days × 32 px, height bounded by ≤ 50 rows; font = committed TTF with Vietnamese coverage at `src/lib/tracker/fonts/`, read with `readFile(join(process.cwd(), 'src/lib/tracker/fonts/…'))`; `next.config.ts` `outputFileTracingIncludes: {'/api/tracker/share/**': ['./src/lib/tracker/fonts/*.ttf']}`. Executor reads `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` first.
- **Headers** (`next.config.ts` `headers()`): `/:locale(en|vi)/share/:path*` → `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`; `/api/tracker/:path*` → `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`. The ICS and PNG handlers also set `Cache-Control` explicitly (`ImageResponse` defaults to public caching).
- `robots.ts`: disallow `/en/share`, `/vi/share`. `MusicPlayer`: hide on `/(en|vi)/(tracker|share)` (same hook-order rule as v1). Tokens never logged.

### 3.7 Email (Resend)

- `src/services/trackerMail.ts` (`import 'server-only'`): `new Resend(RESEND_API_KEY)`, `from = process.env.TRACKER_MAIL_FROM ?? 'Sino Studio <contact@sinostudio.vn>'`. Templates in `src/components/tracker/emails/` (plain JSX, inline styles, Vietnamese), rendered once to HTML with the installed `@react-email/render` and stored in `payload`. `deliver(row)` sends **exactly** `row.payload` with `idempotencyKey = row.idempotency_key`; checks the returned `{error}` (the SDK does not always throw); on 429 waits `retry-after` once (≤ 5 s) then leaves the row `failed`; on success `status = 'accepted'`, `resend_id`. A row is never re-rendered: retries resend the stored payload, and only within 23 h of `created_at` (Resend's idempotency window is 24 h); older `pending`/`failed` rows are left `failed` and listed as "Gửi lỗi" (see observability).
- **Manual sends** (server actions, cookie client): render → insert log rows `pending` (key `manual-{uuid}`, payload, `replyTo` = the sending manager) → deliver → update `status`/`resend_id`/`error`/`attempts` (column grant). A row left `pending` by a crash is picked up by the worker's retry pass. Staff without email are skipped and reported ("2 người chưa có email").
  - `sendResources`: task → its assignee; cut → every assignee of the cut. Body: project, cut and task links, stage, dates.
  - `sendSchedule`: every member of the share with an email: their tasks of the month (cut, type, dates), the share link and their calendar URL.
- **Worker** `src/app/api/tracker/cron/route.ts` (POST): if `!process.env.CRON_SECRET` → 500; `Authorization` must equal `Bearer ${CRON_SECRET}` (constant-time compare) else 401. Admin client (service role). Every run, bounded to 50 deliveries:
  1. **Digests**: `tracker_claim_notices(20, '2 minutes')`. For each claimed row: keep only `task_ids` still assigned to that staff; if none, or the staff has no email / is archived → delete the queue row (same `cycle_id` + `generation`) without sending. Else render the digest (the changed tasks first, then the staff's other open tasks with `end_date >= today(ICT)` and `progress < 100` across non-archived projects), insert the log row `pending` with key `assign-{cycle_id}-{generation}` (`on conflict do nothing`), delete the queue row where `cycle_id` and `generation` match.
  2. **Reminders enqueue** (first run at or after 08:00 ICT each day, i.e. when no reminder row exists yet for tomorrow's date): for tomorrow (ICT), active staff with email and tasks ending tomorrow with `progress < 100` in non-archived projects → insert one `pending` log row per staff (key `reminder-{staff_id}-{date}`, unique partial index on `(staff_id, ref_date)`, `on conflict do nothing`).
  3. **Deliver/retry** (every run): `tracker_claim_emails(50, '2 minutes')` → `deliver(row)` → completion update `where id = … and claim_token = …`. Rows with `attempts >= 5` stay `failed`.
- **Scheduling** (row 4.3, after the v2 deploy, via MCP `execute_sql` — not in a migration file because it holds the URL; extensions are created by migration 1.1): the owner already stored the secret in Vault as **`cron_secret`** (2026-09-30; same value as `CRON_SECRET`), so only `select cron.schedule('tracker-mail', '*/5 * * * *', $$ select net.http_post(url := 'https://sinostudio.vn/api/tracker/cron', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 60000) $$)` remains (after the v2 deploy, with owner approval). During development the job stays unscheduled; the worker is exercised by calling the route locally.
- Env (Vercel + `.env`): `RESEND_API_KEY` (exists), `TRACKER_MAIL_FROM`, `SUPABASE_SECRET_KEY` (now required on Vercel — reverses v1 §3.4), `CRON_SECRET`. Email links use `SITE_URL` from `src/lib/seo.ts`.

### 3.8 Realtime for the other tables

- `src/components/tracker/useRealtimeRefresh.ts`: one channel per mount (unique topic), `setAuth(session.access_token)` before `subscribe` (as `useTaskRealtime`), one unfiltered `postgres_changes` listener per table, any event → `requestRefresh()` (`useRefreshScheduler`); resync on reconnect. No resync on the first subscribe (v1 performance decision: it would add one RSC request per page load); an event in the ~1 s gap between render and subscribe is missed until the next refresh or navigation, and stale task writes are still refused by the version check (§8).
- Mounted in: `TrackerShell` (`tracker_projects`), Projects page (`tracker_projects`, `tracker_work_types`), Staff page (`tracker_staff`, `tracker_strengths`, `tracker_staff_strengths`), board (§3.4), `ShareModal` (`tracker_shares`), cuts view / earnings / profiles (§3.5).

### 3.9 Projects and Staff pages

- Projects modal: name, color, links editor, `WorkTypesEditor` (rows code / label / color / pay % / up-down; used types locked: no delete, no move; new rows get the midpoint `sort_order` between neighbours, or renumber unused rows in steps of 10 when there is no gap; running total must be 100 to enable Save; new project pre-filled from `DEFAULT_WORK_TYPES`). Save = `updateProject` + `saveWorkTypes`, or `createProject`.
- Staff page: email field; strengths chip `MultiSelect`; "Điểm mạnh" manager modal (add / rename / delete / all-rounder / order). Names link to the studio profile.
- Nav: remove "Work types" (route deleted → 404); add "Thu nhập" / "Earnings".

### 3.10 App-level

- Dictionaries: new `tracker.*` keys, en + vi in sync (5.1 runs a key-parity check). Emails vi only (templates).
- `CLAUDE.md` Tracker section: tables, triggers, RPCs, lock rule, share routes + DTO rule, cron worker + pg_cron, env vars, removal of global work types.
- No new npm dependencies; one TTF file added.

## 4. Implementation — waves and rows

Routing: Contract `—` → `sonnet-executor`; otherwise `opus-executor`. Every row gets a separate `opus-executor` reviewer. Max 4 subagents at once (including reviewers). Lint / tsc / test / build in the background.

| ID | Deps | Task | Contract | Acceptance |
|---|---|---|---|---|
| **1.1** | — | Migration `tracker_v2` (§3.1) in the mandated statement order; rename local file to applied version; types + supazod regen; `server-only` in `admin.ts`; advisors | §3.1 verbatim | SQL proofs S1–S14 pass; `get_advisors` security + performance empty; report lists the tsc errors left for rows 2.x |
| **2.1** | 1.1 | Pure helpers + tests (§3.2) incl. `taskSync.reconcile` + commit-chain helper | signatures §3.2, rules §3.4 "Task sync contract" | `npm test` green; tests cover: S1 parity fixture, natural sort, order rule edges (equal dates, C4 missing stages), `stagePay` .5 rounding, % total with 2 decimals, RFC 5545 escaping + UTF-8 folding, vi sort + all-rounder filter, stale-version / tombstone / own-echo cases |
| **2.2** | 1.1 | Actions (§3.3) + `writeVersioned` + error mapping + `DEFAULT_WORK_TYPES`; delete work-types page/table/nav/keys | §3.3 | tsc clean for actions; unit test maps every SQL key; `/en/tracker/work-types` → 404 |
| **2.3** | 2.1, 2.2 | Board (§3.4): loader + stage index, cuts map, task sync wiring, click/drag create + popover, "+" popover, panel cut autocomplete, conflict/order messages, staff column tools, view switcher | §3.4 | E2E B1–B12 |
| **2.4** | 2.2 | Projects modal (links + WorkTypesEditor), Staff page (email, strengths chips + manager), nav changes | §3.9 | E2E P1–P5 |
| **3.1** | 2.3 | `useRealtimeRefresh` + wiring (§3.8) | setAuth before subscribe; unfiltered; unique topic | E2E R1–R4 |
| **3.2** | 2.3 | Cuts view + drawer + adjustments + reversal + bulk bonus/penalty + bulk cut add + audit list (§3.5, N1, N3) | §3.5; pay only via `payLines`/`staffTotals` | E2E C1–C10 |
| **3.3** | 2.1, 2.2 | Earnings lists + profiles, project and studio scope (§3.5, N2) | §3.5 month rules | E2E E1–E5 |
| **4.1** | 2.3, 2.4 | Links editor + wiring (project, cut, task); read-only display | https only, ≤ 20, label 1–80 | E2E L1–L3 |
| **4.2** | 2.3 | Shares: actions, ShareModal, DTO, `ScheduleGrid` page + AutoRefresh, ICS per member, PNG + font + tracing, headers, robots, MusicPlayer | §3.6 | E2E H1–H9; `rg createAdminClient src` lists only `shareData.ts`, the cron route and `admin.ts` |
| **4.3** | 4.1, 4.2 | Email: service, templates, manual sends, worker route (digests, reminder enqueue, deliver/retry), Vault secret + pg_cron job after deploy (owner supplies secret), log | §3.7 (payload persisted before first attempt; claim tokens; key = `assign-{cycle_id}-{generation}`) | E2E M1–M9; SQL S15–S16 |
| **5.1** | all | `CLAUDE.md`, dictionary parity, final lint/tsc/test/build, Vercel preview check (PNG, share headers) | — | all gates green |
| **5.2** | 5.1 | Full E2E (sonnet-executor; brief `.omc/drafts/e2e-v2-brief.md` written by the orchestrator) | — | pass/fail table; orchestrator judges |

Waves: W1 = 1.1 · W2 = 2.1 ∥ 2.2 → 2.3 ∥ 2.4 · W3 = 3.1 ∥ 3.2 ∥ 3.3 · W4 = 4.1 ∥ 4.2 → 4.3 · W5 = 5.1 → 5.2. After W2 the board is usable with cuts, order rule, click/drag create, conflicts, staff tools and per-project types.

Manual setup (owner):
1. ~~Resend root domain~~ Not needed: sender is `tracker@web.sinostudio.vn` (web.sinostudio.vn already verified; owner 2026-09-30).
2. ~~Vercel env: `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `TRACKER_MAIL_FROM`.~~ Done 2026-09-30 (local `.env` + Vercel). Local `.env` `RESEND_API_KEY` is empty (needed for local email E2E, row 4.3).
3. ~~Vault secret~~ Done: `cron_secret`. Remaining: approve scheduling the job after the v2 deploy.
4. Enter staff emails on the Staff page.
5. Fix or delete the legacy C10 test tasks (they overlap and cannot be edited under the order rule).

## 5. Acceptance criteria

1. Migration applied in the mandated order; asserts pass; 4 tasks keep their staff/dates and show as C10 / C11; 13 staff; 26 junction rows; Demo types LO 30 / GE 30 / DO + SH 40 with sort 10/20/30.
2. Order rule: with C1 LO 01/10–05/10, C1 GE starting 05/10 is refused with a message naming "C1 · LO"; starting 06/10 succeeds; then dragging C1 LO to end 06/10 is refused. C1 DO + SH with no GE is allowed.
3. A second C1 · LO task cannot be created (chip disabled even when the existing LO task is in another month; DB `duplicate`).
4. Typing `c 01` creates / selects `C1`; cuts autocomplete in natural order (C2 before C10).
5. Click on an empty day → 1-day task via the popover; drag across 4 days → 4-day task; clicking a bar still selects it; on a 390 px touch viewport horizontal scrolling still works and a tap opens the popover.
6. Tab A changes a task's dates; tab B had started dragging the same task before A's change arrived → B's drop is refused with the conflict notice and shows A's dates; nothing from B is saved. With realtime disabled in B (offline channel), B's stale save is refused by the server (`conflict`). Five rapid successive drags of one task in one tab produce no conflict and end at the last position.
7. Project work types: new project gets LO 30 / GE 30 / DO + SH 40. Save disabled unless the total is 100.00; a direct single-row % update via PostgREST fails with `pct_total`. A used type cannot be deleted or moved; its label / color / % can change (saving the full list with an unchanged order succeeds) and the change appears in the audit list. A new type can be inserted between two used types.
8. Board staff tools: hide/show strengths, sort cycle, strength filter (Genga → Genga staff + Toàn năng staff); survive reload; no hydration warning in the console.
9. Cuts view (N1): computed styles of the four cell states match the prototype values (check badge on completed, partial fill width = progress %, dim empty, "chờ" hint); badges equal `round(budget × % / 100)`; changing a budget updates badges and footer totals.
10. Adjustments: amount + reason required (UI + DB); `update` / `delete` on `tracker_pay_adjustments` as a tracker user → permission denied; reversal inserts `−amount` referencing the original; a second reversal of the same entry fails; reversing after the stage was reassigned succeeds.
11. Bulk (N3): selecting 3 stages + 1 helper row, with two penalties, one bonus and the helper's bonus, one batch reason and one row-level reason override, inserts 4 rows (mixed signs, correct per-row reasons) sharing one `batch_id`; a failing row (e.g. amount 0) inserts nothing; submitting the same `op_id` twice leaves 4 rows, not 8; the helper's total increases in both earnings scopes.
12. Earnings (N2): project list totals equal `staffTotals` over that project; studio list equals the sum across all projects including archived ones; profiles in both scopes show the same stage and adjustment rows for their scope; month filter follows the §3.5 effective-month rule, including a reversal counted in its original's month.
13. Realtime: a change on Projects / Staff / strengths / work types / cuts / adjustments in tab A appears in tab B within 2 s without manual reload.
14. Share link: `/vi/share/<token>` without login shows only the chosen members, read-only; the HTML/RSC payload contains no budget or pay-% values, no email addresses and no other staff's names or ids (dictionary label strings such as "budget" are expected: the locale layout serialises the whole dictionary on every page — pre-existing, backlog item); a share of an archived project → 404; response headers `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`; a revoked token → 404 (open page turns 404 within 60 s).
15. ICS per member: imports into Google Calendar as all-day events with correct inclusive dates; a `staffId` not in the share → 404; revoked → 404.
16. PNG: `/api/tracker/share/<token>/png?m=2026-10` returns `image/png` with `Cache-Control: private, no-store`; a fixed string with diacritics ("Hưng Nomi — Đang làm") renders without tofu on the Vercel preview.
17. Emails (test recipients only): send resources / send schedule deliver; staff without email reported, not errored; three edits to one person's tasks within 10 min produce one digest; the worker with no/empty `CRON_SECRET` → 500, wrong bearer → 401; running the worker twice on one day sends each reminder once; a reminder that failed (forced Resend error) is retried on a later run with the identical payload and key, including runs after 09:00; a digest for a staff whose only changed task was reassigned away is dropped unsent; after a delivered digest, a new change produces a new key (`assign-{new cycle_id}-1`); every manual send ends `accepted` or `failed`; after scheduling, `cron.job_run_details` shows a succeeded run and `net._http_response` a 200.
18. `/en/tracker/work-types` → 404; nav has no Work types link and has Earnings.
19. `npm run lint` (no new errors), `npx.cmd tsc --noEmit`, `npm test`, `npm run build` pass; `get_advisors` empty; robots disallows `/en/share`, `/vi/share`.

## 6. Verification

**SQL proofs** (row 1.1 / 4.3, `execute_sql` with `set local role authenticated; set local request.jwt.claims = '{"email":"…"}'` inside `begin … rollback` where they write; proofs of deferred triggers/constraints run `set constraints all immediate` before the rollback so the deferred check actually fires):
- S1 normaliser: `c 01`→`C1`, `C010`→`C10`, `c12a`→`C12A`, `C0`→`C0`, `C00`→`C0`, ` C 7 `→`C7`, `OP`→`OP`, `c1-2`→`C1-2`, `C?`→`C?`, `C100`→`C100`, `c0012b`→`C12B`, `ed`→`ED` (outputs committed as the TS fixture).
- S2 order refusal on insert (through `tracker_create_task`) with `detail`; S3 refusal on update (drag); S4 refusal on a progress-only update of a violating row (C2 every edit); S5 duplicate cut + type through `tracker_create_task` → 23505; S5b `project_id` change on a task or type → `project_immutable`.
- S6 `pct_total` on a single-row % update at commit; S7 RPC save (total 100, unchanged order, changed label) succeeds; S8 `type_in_use` on reorder / delete of a used type; S9 insert-between with sparse order succeeds; S10 empty type list for an existing project → `pct_total`.
- S11 adjustments: update/delete denied; reversal rules; helper (non-assignee) insert allowed; `created_by` = JWT email even when a different value is supplied.
- S12 audit rows with actor for cut budget, type %, task dates; no audit row for a no-op update.
- S13 anon: every new table denied / 0 rows; RPC execute denied; `tracker_notice_queue` denied to authenticated.
- S14 non-allow-listed `@sinostudio.vn` email: 0 rows everywhere; inserts denied.
- S10b project inserted without types → `pct_total` at commit.
- S11b `tracker_add_adjustments` twice with the same `p_batch` → second call returns the original rows, count unchanged; mixed-sign entries accepted.
- S15 (4.3) enqueue: a date change inserts/updates one queue row, bumps `generation`, appends the task id, resets `claimed_until`; progress-only update does not enqueue; after the queue row is deleted, the next enqueue has a new `cycle_id`.
- S16 (4.3) `tracker_claim_notices` / `tracker_claim_emails`: execute denied to `authenticated`; as service role they return at most `p_limit` rows and a second immediate call returns none of the claimed rows (lease).
- Lock: review-only (code review checks every rule trigger/RPC body starts with the project lock); not proven via MCP, whose calls cannot be reliably interleaved.

**Unit** (`npm test`): see row 2.1, plus `writeRow` mapping, `buildIcs`, worker claim/generation logic as a pure planner function.

**E2E** (sonnet-executor; brief at `.omc/drafts/e2e-v2-brief.md`; Chrome MCP attach mode): groups B (board), P (projects/staff), R (realtime, two tabs), C (cuts/pay/bulk), E (earnings/profiles), L (links), H (sharing; incognito for the public page; header + payload checks), M (email; recipients limited to `delivered@resend.dev` and the owner's address). Screenshots for visual cases only (cuts cell states, PNG, share page); behavioural cases assert via `evaluate_script`, network, SQL.

**Observability**: `tracker_email_log` (status, attempts, error; "Gửi lỗi" = `status <> 'accepted' and (attempts >= 5 or created_at < now() - interval '23 hours')`, checked in E2E group M and documented in `CLAUDE.md` as the query to run), `tracker_notice_queue` (rows with `due_at` older than 30 min = stuck worker), `tracker_audit_log`, `cron.job_run_details` for the pg_cron job, `net._http_response` for the HTTP call, Vercel function logs (`console.error` on every worker failure path; tokens never logged).

## 7. Pre-mortem (deliberate mode)

1. **Migration corrupts or blocks the data.** Backfill runs after a rule trigger exists and fails on the overlapping C10 rows, or the live data drifted from the snapshot. *Mitigation:* mandated statement order; pre- and post-backfill asserts abort the transaction; owner confirmed v1 is not in use, so the v1 break between 1.1 and the v2 deploy is accepted.
2. **Stale or phantom edits.** A drag started before a foreign change lands and silently overwrites it, a late response resurrects a deleted task, or rapid own drags conflict with themselves. *Mitigation:* baseline version at interaction start, own-ack chaining, tombstones, one `reconcile()`; unit tests on the pure sync module; AC6.
3. **Email harm.** Animators get one email per drag, duplicate digests or reminders, a failed reminder is never retried, or a public share leaks pay/emails. *Mitigation:* outbox per staff with generation + lease; Resend idempotency keys; retryable statuses; progress edits never notify; public DTO with explicit fields + AC14 payload check; E2E sends only to test recipients.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Root domain not verified in Resend → sends fail | `TRACKER_MAIL_FROM` env; `web.sinostudio.vn` until verified; `failed` status with the Resend error. |
| pg_cron / pg_net unavailable or the job calls the wrong URL | Row 4.3 checks `list_extensions` first; job URL = production; `cron.job_run_details` + `net._http_response` in observability; route can be called manually. |
| Project-level lock slows writes | ≤ 5 users; lock held only for the statement's transaction (ms). |
| Deadlock (task row lock vs project lock when a type delete races a task edit) | Rare; `40P01` retried once in `writeRow`. |
| Realtime event missed in the render→subscribe gap | Accepted (§3.8); version check refuses stale task writes; next refresh/navigation heals the view. |
| Email payload for a retry differs from the first attempt | Payload persisted before the first attempt; retries resend it byte-for-byte within 23 h. |
| Advisory lock key collision across projects | `hashtextextended` 64-bit; collisions only serialise two projects briefly. |
| Deferred unique on sort_order confuses PostgREST single-row reorders | Reorders go through the RPC; UI never issues single-row order updates. |
| PNG font not traced on Vercel | `outputFileTracingIncludes`; AC16 on the preview. |
| Share token leaks via Referer | `Referrer-Policy: no-referrer` header + `rel="noreferrer"`; revocation. |
| Secret key on Vercel widens blast radius | `server-only` in `admin.ts`; only `shareData.ts` and the cron route import it (grep in 4.2 / 5.1 review). |
| Realtime DELETE ids reach signed-in non-allow-listed users (v1 residual) | Accepted as in v1; DELETE payloads carry ids only, no amounts. |
| Legacy C10 rows uneditable | Owner fixes or deletes them (manual setup 5). |
| localStorage prefs → hydration mismatch | `useSyncExternalStore` with server defaults (AC8). |
| Rounding differs between views | Single `stagePay`; tests on .5 cases. |

## 9. ADR

- **Decision:** Option A — DB-authoritative cut/pipeline/pay model serialised per project (advisory xact lock): `tracker_cuts`, per-project work types with `pay_pct` and sparse unique order, `tasks.cut_id` + unique (cut, type) + order trigger on every write, integer `version` with interaction-start expected versions, deferred %-total trigger, append-only adjustments (helpers allowed, mixed-sign retry-safe batches, reversals validated against the original), actor stamping, trigger-written audit log; invoker RPCs for multi-row writes; derived pay in one TS module; public shares / ICS / PNG through one server-only DTO; emails via a DB outbox + pg_cron worker with persisted payloads, claim leases and idempotency keys.
- **Drivers:** correctness under concurrent manager edits; convenience for non-technical managers; wave-by-wave solo delivery.
- **Alternatives considered:** B action-enforced rules + pay snapshots; C Edge Functions service; anon definer RPC for public reads; `updated_at` compare; SQL pay view; `html-to-image`; Resend scheduled + cancel in `after()`; immediate per-change emails; Vercel Cron; `GanttBoard` readOnly for the public page.
- **Why chosen:** every owner rule holds regardless of which client writes; side effects are durable and retry-safe; smallest code that meets all decisions; no new npm dependencies.
- **Consequences:** more plpgsql; `SUPABASE_SECRET_KEY`, `CRON_SECRET` on Vercel and a Vault secret + pg_cron job in Supabase; `tasks.name` and global work types are gone; legacy C10 rows need owner cleanup; realtime DELETE ids for more tables visible to non-allow-listed domain users (accepted).
- **Follow-ups:** payouts / paid status; member logins; Drive Picker / auto-match; Resend delivery webhooks; role enforcement (e.g. money admin-only); bulk budget import.

## 10. Changelog

- exec W4–W5 (2026-09-30): 4.1 links, 4.3 email built + reviewed (fixes: archived staff skipped, 550 ms send pacing, maxDuration 60, 25 emails/run, payload integrity guard `rejected_payload` → retired, reminder window 08–10 ICT, chunked digest lookups). 5.1: types regenerated, CLAUDE.md Tracker section rewritten, gates green. 5.2 E2E: tester A (browser) + tester B (worker) + targeted re-run — all ACs pass (M6 time-gated N/A); results `.omc/e2e/v2/e2e-v2-results.md`. Defects found by E2E and fixed: amount "0" clamped to 1 in bulk/drawer (money bug), new-staff dialog silent no-op, board React key warning, bulk toggle clipping, selection checkbox overlap, slider keyboard saves (400 ms debounce). Final gates: lint 0 errors, tsc 0, 148 tests, build OK. **Status: built and verified locally; pending owner deploy + post-deploy steps (pg_cron schedule, Vercel preview PNG/header check, Resend root domain).**

- exec W2–W4 (2026-09-30): rows 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2 built; each passed a separate reviewer (fixes applied: board Enter double-commit, loader error throwing, keyset paging `Earnings/keyset.ts` for project-wide queries, snapshot removal limited to the month range, stageless adjustments visible, network-retry form lock, audit query filtered on `new/old->>project_id`, TrackerShell realtime mount removed (board refresh contract), share hardening). Extra migrations: `20260930072525_tracker_v2_shares_grant`, `20260930073842_tracker_v2_shares_token` (DB-generated token, insert limited to project_id/staff_ids/label, no delete, revoke is final). Decisions: shares of archived projects 404; dictionary serialised on public pages accepted (labels only; backlog); single-row bulk not tagged "hàng loạt"; `isValidMonth` limited to 2000–2099; ShareModal list refreshes via the board's realtime channel. 5.1 must regenerate `database.types.ts` + supazod (hand-edited for `token` optional).
- exec 2.1 / 2.2 + hardening (2026-09-30): review of 1.1 PASS (5 low) → `20260930070707_tracker_v2_hardening` (cut `project_id` immutable, deferrable unique type code, batch-project check on retry, email_log update limited to own rows). 2.1: pure helpers + taskSync (API: initTaskState / reconcile inputs refreshStart·snapshot·realtime·realtimeDelete·begin·ack·ownDelete / planCommit / visibleTasks / createCommitChain; foreign-after-baseline tracked by version). 2.2: actions per §3.3 except shares (4.2) and sends (4.3); `saveWorkTypes` rejects ids not in the project; work-types page/table/keys removed. Backlog for 4.2: `tracker_shares` full UPDATE grant lets a user rewrite `created_by` → restrict update to `(label, revoked_at)`. Backlog for 3.3: effective-month helper (§3.5) is not in §3.2 — add with tests.
- exec 1.1 (2026-09-30): applied `20260930065620_tracker_v2` + `20260930065653_tracker_v2_notice_queue_policy`; S1–S14, S5b, S10b, S11b pass; advisors clean for tracker objects (performance `unused_index` INFO only). Accepted deviations: adjustments table created in step (6) (needs the composite key); staff email index + strengths drop in (6); audit `_upd` WHEN on cuts/types ignores `updated_at`; deny-all select policy on `tracker_notice_queue` (advisor `rls_enabled_no_policy`; no grant, access unchanged); `tracker_normalize_cut` executable by authenticated + service_role (check constraint); private functions revoke from authenticated; `tracker_create_task` stores budget `coalesce(p_budget,0)`; pct trigger also takes the project lock. Notes: any update bumps `version`; `tracker_save_work_types` ignores ids not in the project. tsc: 34 errors in 7 v1 files (rows 2.x).

- r3 (2026-09-30): folded Critic round 2 (APPROVE WITH CHANGES: N-H1, N-M1–M4, N-L1–L5) and Codex round 2 (AGREE WITH CHANGES: 1–13; bootstrap resync rejected again with rationale in §3.8/§8); owner: bonuses and penalties mix freely in one bulk batch (per-row sign/amount, optional per-row reason). Changes: extensions + normaliser created first, exact-fixture pre-asserts, ≥ 1 type incl. project-insert deferred check; project lock inlined (no private helper calls from invoker code); split `_ins`/`_upd` triggers; `project_id` immutable on tasks/types; composite-FK indexes; `tracker_adjustment_batches` + `tracker_add_adjustments` RPC (client `op_id`, retry-safe); email log column UPDATE grant, persisted payload, claim tokens, 23 h retry window, service-role claim RPCs; notice queue `cycle_id` + `task_ids` + lease; reminders enqueued daily and retried every run; `net.http_post` timeout 60 s; task sync: provisional events while in flight, snapshot-start rule for refreshes, tombstones only for real deletes, baselines for slider/links/delete; studio earnings include archived projects; reversal effective month = original's; ICS DTO with version/updated_at; `tracker_shares` published; `40P01` retried once; proofs use `set constraints all immediate`; lock proof review-only.

- r2 (2026-09-30): folded Architect AR1–AR10, Critic H1–H3 / M1–M7 / L1–L8 and Codex 1–15 (verdicts in `.omc/drafts/tracker-v2-review-r1.md`); owner additions N1 (prototype values: 30/30/40, check badge, partial fill, badge in cell, earned at 100 %, comfortable, full names, date range), N2 (earnings list + profile, project and studio scope), N3 (bulk bonus/penalty incl. helpers); owner confirmed v1 not in use (single migration). Main changes: statement order + asserts; per-project advisory lock; sparse deferrable type order; `WHEN`-guarded type lock; ≥ 1 type rule; explicit grants; actor stamping; relaxed adjustment guard + original-based reversal validation; `tracker_create_task` / `tracker_ensure_cut` RPCs; `23514 → invalid`; explicit conflict result; task sync contract (interaction-start versions, own-ack chain, tombstones, `reconcile`); project-wide stage index; per-member ICS; public DTO + `ScheduleGrid` + 60 s refresh; share headers via `next.config`; PNG font tracing; email outbox + pg_cron worker + idempotency keys + retryable statuses (replaces `after()` + Resend scheduling); session PNG route removed; MusicPlayer hidden on share pages.
- r1 (2026-09-30): first draft from owner answers.
