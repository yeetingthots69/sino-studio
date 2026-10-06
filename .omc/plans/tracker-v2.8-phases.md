# Tracker v2.8: project phases, per-phase budgets, cut phase squares + switcher, no roles

Status: **r3 APPROVED by the owner 2026-10-06** (fable-critic APPROVE r2 + fixes; Codex r2 findings merged; summary page https://claude.ai/artifact/DgenuowT6QDkDmtLQNT2h5). **DONE 2026-10-06.** Expand `20261006130134_tracker_v28a_phases` + contract `20261006151359_tracker_v28b_contract` applied live with owner OK (Gate A, Gate B); code deployed (74d34fe, 1.2.8); A2 + contract SQL tests ALL PASS live; E2E E1–E6 + S12h (old code, then new code) ALL PASS; types regenerated after contract (tsc/test/lint clean). Post-contract type regen + CLAUDE.md migration name are uncommitted.

Paths: `TR/` = `src/components/tracker/`, `GB/` = `TR/GanttBoard/`, `CV/` = `TR/CutsView/`, `APP/` = `src/app/[locale]/tracker/(app)/`, `PID/` = `APP/[projectId]/`, `ACT` = `src/app/[locale]/tracker/actions.ts`, `MIG/` = `supabase/migrations/`, `V1` = `MIG/20260927090805_tracker.sql`, `V2` = `MIG/20260930065620_tracker_v2.sql`, `V25` = `MIG/20261002125744_tracker_v25_overlap.sql`, `V26` = `MIG/20261004081552_tracker_v26_fix.sql`, `SPLIT` = `MIG/20261001032517_tracker_cut_pay_split.sql`, `PRESET` = `MIG/20261001053228_tracker_pay_presets.sql`, `DICT` = `src/i18n/dictionaries/{en,vi}.json`.

---

## 1. Requirements summary

**Owner request (2026-10-06).**
1. A project's work types are grouped into **phases** (e.g. Background: sketch, colour, final; Animation: LO, GE, DO, SH; Compositing: pre, prod, post). A phase may wait for other phases (Compositing waits for Background **and** Animation; Background and Animation run in parallel). Defined at project creation, **not editable afterwards**. Every cut has every phase and every type.
2. Cut × payment view: small **phase squares** in the empty space of the cut cell (lit when done), and a **phase switcher** that shows the stage columns of one phase.
3. Remove the admin / manager roles; everyone has the same rights.

**Owner decisions** (`.omc/drafts/tracker-v2.8-decisions.md`):

| # | Answer |
|---|--------|
| D1 | Dependencies are a **date rule per cut**, enforced in SQL: every stage task of a phase must start after every stage task of each ancestor phase has ended (same cut). The existing stage order rule (strict, `overlaps_prev`) applies **inside a phase only**. |
| D2 | Locked after creation: phases, their order, dependencies, which types are in which phase, type order (and type `code`, see O9). Editable: type label, colour, default pay %, `overlaps_prev`. Types can no longer be added or removed after creation. |
| D3 | Each phase picks the earlier phases it "starts after". The editor must make order and dependencies readable from the layout. |
| D4 | Create form starts with one phase **"Animation"** = LO, GE, DO, SH. Phase names are user data, **never translated**. |
| D5 | Migration wraps each existing project's types into one phase "Animation". |
| D6 | **100% per phase**: default `pay_pct` sums to 100 inside each phase. **Budget per cut per phase** (D6a); cut total = sum. Per-cut split override **per phase** (D6b); presets apply to one phase by position. Footer: visible phase per-stage totals + phase total + all-phase total (D6c). Existing cut budgets move to the Animation phase. |
| D7 | Square states: **done** (every type of the phase has a stage task at 100%), **started** (≥ 1 stage task, not all done), **empty** (no stage task). Fix tasks ignored. |
| D8 | Squares go **left of the cut code** on the same line (the code is right-aligned; screenshot). |
| D9 | Segmented control, one tab per phase. |
| D10 | Board, task list, share page, PNG, ICS, emails unchanged except the order rule. |
| D11 | Drop `tracker_users.role`. |
| D12 | **Two-step rollout** (expand / contract), because dev and production share one Supabase DB: the expand migration keeps the deployed code working; the contract migration runs after the owner deploys. |

**Orchestrator decisions** (owner may override at the approval gate):
- O1 Phase has `name` (1–40 chars, unique per project ignoring case/spaces) and no colour. Squares: done = filled `--color-red`, started = 40% fill, empty = 1 px outline. Max 8 phases, max 50 types per project.
- O2 The switcher is hidden when the project has one phase (squares still show). Last chosen phase is remembered per project in localStorage `tracker.cuts.phase.<projectId>` (fallback: first phase). Switching phase clears a bulk selection.
- O3 (revised after C0, owner feedback 2026-10-06) In the editor a phase may start after **any** other phase as long as no cycle results (cycle-creating choices are disabled). The client sends phases in **topological order** (ties broken by the in-column order the user drags), with `after` as indexes of earlier entries; the RPC stores that order as `sort_order`. So the DB invariant "after ⊆ lower sort_order" (§4.2 `tracker_phase_guard`) is unchanged and the graph stays acyclic.
- O4 In a phase, the first type has no predecessor; `overlaps_prev` on it has no effect (editor hides the toggle there).
- O5 `AddCutsModal` budget goes to the switcher's phase; the board create-popover budget (new cut) goes to the chosen type's phase.
- O6 Global `tracker_work_types.sort_order` stays unique per project and is assigned in phase order (phase 1 types 10, 20, …; phase 2 continues). So `order by w.sort_order` already means (phase order, type order) in both SQL and TS; no two-key sort is needed.
- O7 Role text: `en.json:680` → "This account does not have access to the tracker. Ask a teammate to add you."; `vi.json:684` "Hãy nhờ quản trị viên thêm bạn." → "Hãy nhờ đồng nghiệp thêm bạn." (verify the key path when editing).
- O8 Footer totals keep today's meaning: **assigned stage pay** (sum of `payLines` of existing stage tasks), not budgets. Per-stage cells = active phase; first cell = active phase total and all-phase total.
- O9 Type `code` is locked after creation (it appears in presets' `codes`, task labels, ICS, emails). The editor shows it read-only in edit mode.

## 2. RALPLAN-DR summary

**Principles**
1. SQL is the authority for every rule (D1 dates, D2 lock, D6 totals); the client mirrors, never decides.
2. Pay is computed only in `TR/pay.ts`; every consumer goes through it.
3. Smallest schema that holds the rules: prefer columns on existing, already-audited, already-realtime tables over new tables.
4. Old projects behave exactly as before after migration (one phase = today's behaviour), and the deployed code keeps working between the two migrations.
5. Generated types make omissions fail `tsc` (the contract step drops columns rather than keeping dead ones).

**Decision drivers**
1. Correctness of the cross-phase date rule and per-phase pay under concurrency (advisory lock, deferred checks).
2. Blast radius on existing code (board undo snapshots, realtime payloads, earnings paging, audit history) and on the live site during development.
3. The "locked after creation" guarantee must hold against direct PostgREST writes, not just the UI.

**Option A — columns on existing tables (favoured).**
- `tracker_phases` (new, immutable) with `after uuid[]`; `tracker_work_types.phase_id`; `tracker_cuts.budgets jsonb` `{phase_id: amount}` replacing `budget`; `pay_split` stays one flat `{type_id: pct}` map, validated per phase.
- Pros: cut budgets/splits stay on the cut row, so audit (`tracker_audit` on cuts, `V2:411-434`), realtime payloads (`GB/useTaskRealtime.ts`, `PAY_TABLES`), `select('*')` loaders and keyset paging keep working; atomic single-statement RPC writes.
- Cons: jsonb needs trigger validation; per-phase writes must merge server-side (`budgets || jsonb_build_object(...)` in one UPDATE), never client read-modify-write.

**Option B — `tracker_cut_phases` table (row per cut × phase: budget, pay_split).**
- Pros: plain columns, FK integrity.
- Cons: new RLS, grants, audit triggers, realtime publication, CutDrawer filter, keyset paging in `loadEarnings`, row creation in 3 cut-creation paths + backfill, board undo snapshots/restores N rows, and an extra sync path for the expand step. Roughly double the touched surface for the same behaviour.

**Option C — `tracker_phase_deps` join table instead of `after uuid[]`.** FK checks instead of a trigger, but phases are written once by one RPC and never updated; a second immutable table + grants buys nothing at runtime. Rejected.

**Why A:** drivers 2 and 3; B's integrity gain comes from one validation trigger in A.

## 3. Architect review (orchestrator)

- **Antithesis (steelman for B):** jsonb budgets hide a per-phase money value in a blob; a bad key from a direct PATCH would create money silently. *Answer:* the `tracker_cut_budgets` trigger rejects unknown keys and non-integer / out-of-range values on every write path (column grants cannot be used: the RPCs are SECURITY INVOKER and need UPDATE on the columns they set, review B1). Reporting by phase is `jsonb_each` over ≤ 8 keys.
- **Tension:** D2 lock vs today's free type editing; the owner chose the lock. The old `type_in_use` delete/reorder paths become unreachable; keep them (harmless).
- **Tension:** strict cross-phase date rule (D1) vs early compositing pre-prod. Owner chose strict. Follow-up only if asked.
- **Lock boundary:** "created in this transaction" = `project.created_at = now()` (`now()` is the transaction start; `created_at default now()`, `V1:12`). Made tamper-proof by a BEFORE UPDATE trigger that keeps `created_at` immutable (review Codex 4).
- **Transitivity:** the rule uses the ancestor closure, else C could start before A ends when B has no task in that cut yet.
- **Rollout tension (D12):** expand/contract costs a sync trigger and two-version RPC bodies for a few days; it buys a live tracker throughout development.
- **Synthesis:** Option A + closure rule inlined in the trigger + creation-transaction lock + two-step migration.

## 4. Design

### 4.0 Rollout (D12)

| Step | When | Content | Deployed (old) code |
|---|---|---|---|
| **Expand** `MIG/<ts>_tracker_v28a_phases.sql` | Gate A, before the new code | Everything additive: `tracker_phases`, `phase_id`, `budgets` (kept in sync with `budget`), new rules, RPCs with **added optional params** (old named-arg calls keep resolving), `created_at` immutability. `budget`, `role`, old params stay. | Works for existing (one-phase) projects: reads `budget` (kept = sum of `budgets`), writes `budget` (mirrored into `budgets`), old RPC calls resolve. Adding/removing/reordering types or changing a code in the old project modal is refused (`phase_locked`, shown as the generic error). **Creating a project with customised stages in the old modal half-succeeds** (old `ProjectsTable.tsx:55,70-82` creates with defaults, then the follow-up save of id-less rows is refused): the project exists with default stages and the UI shows an error. Accepted for the window; the owner tells users not to create projects between Gate A and the deploy. |
| **Contract** `MIG/<ts>_tracker_v28b_contract.sql` | Gate B, right after the owner deploys | Drop the sync part of the budgets trigger, drop `tracker_cuts.budget`, drop `tracker_users.role`, recreate RPCs without the old params (`p_types`, `p_budget`), make `p_phase` required. Regenerate types. | n/a (new code is live) |

Rule for all new code: **never read or write the `tracker_cuts.budget` column or `tracker_users.role`; never pass `p_types` to `tracker_create_project` or `p_budget` to `tracker_create_task`** — they disappear at Gate B. (`tracker_save_work_types(p_types)` and `tracker_set_cut_budget(p_budget)` are legitimate params; the historic `budget` key in audit JSON stays handled in `CutDrawer`.) The reviewer checks these specific uses, not a blanket grep.

### 4.1 Schema

```
tracker_phases(
  id uuid pk default gen_random_uuid(),
  project_id uuid not null references tracker_projects on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order int not null,
  after uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (project_id, sort_order), unique (id, project_id))
unique index tracker_phases_name_key on (project_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g')))

tracker_work_types + phase_id uuid  (nullable → backfill → NOT NULL + FK (phase_id, project_id) → tracker_phases(id, project_id))
tracker_cuts + budgets jsonb not null default '{}' check (jsonb_typeof(budgets) = 'object')
contract: tracker_cuts drop budget; tracker_users drop role
```

- `tracker_phases`: RLS on; policies `is_tracker_user()` for select and insert; grant select, insert to authenticated (no update/delete grant). Not in the realtime publication (`ponytail:` phases only appear together with a new project, which already fires `tracker_projects`; add it if phases ever become editable).
- No column-grant changes anywhere (review B1, Codex 5): locks are triggers.

### 4.2 Triggers / rules

All rule triggers take the per-project advisory lock, as today. **No calls into `private` helpers from invoker trigger bodies** (`V2:9` revokes schema usage; Codex 3): recursive CTEs are inlined.

| Name | When | Rule | Error key |
|---|---|---|---|
| `tracker_project_created_lock` (new) | BEFORE UPDATE on projects | raise `phase_locked` when `created_at` changes (explicit error, so S2 can test it) | `phase_locked` |
| `tracker_phase_guard` (new) | BEFORE INSERT on phases | project `created_at = now()` else `phase_locked`; every id in `after` is a same-project phase with lower `sort_order` already inserted, no duplicates, else `phase_invalid` | `phase_locked`, `phase_invalid` |
| `tracker_type_guard` (extend `V2:292-316`) | BEFORE INSERT/UPDATE/DELETE on types | INSERT: project `created_at = now()` else `phase_locked`. UPDATE of `id`, `code`, `phase_id`, `sort_order` → `phase_locked` (`project_id` keeps `project_immutable`). DELETE: `phase_locked` unless the project row no longer exists (cascade). Existing `type_in_use` checks stay. | `phase_locked` |
| `tracker_pct_total` (rewrite `V2:319-347`) | deferred; types I/U/D, phases insert, projects insert | project has ≥ 1 phase; every phase has ≥ 1 type and `sum(pay_pct) = 100` | `pct_total` |
| `tracker_task_order` (rewrite `V26:14-68`) | BEFORE INSERT/UPDATE on tasks | Candidate phase = phase of `new.work_type_id`. For every other non-fix task `t` of the same cut (`t.id <> new.id`): **same phase** → today's rule with predecessor/successor = `lag/lead() over (partition by phase_id order by sort_order)`; **t's phase ∈ ancestors(candidate phase)** → conflict if `t.end_date >= new.start_date`; **candidate phase ∈ ancestors(t's phase)** (t is in a descendant phase) → conflict if `t.start_date <= new.end_date`; unrelated phases → no rule. Fix candidates and fix peers exempt (as V26). Detail = conflicting task id; pick `order by w.sort_order limit 1` (O6). | `order_conflict` |
| `tracker_type_order_check` (rewrite `V26:71-114`) | deferred on types | pairs only inside one phase, predecessor partitioned by phase | `overlap_in_use` |
| `tracker_cut_split` (rewrite `SPLIT:7-28`) | BEFORE INSERT/UPDATE OF pay_split | keys ⊆ project type ids; values 0..100, 2 decimals; for each phase with ≥ 1 key, its keys sum to 100 | `pct_total` |
| `tracker_cut_budgets` (new) | BEFORE INSERT/UPDATE OF budget, budgets on cuts (contract: OF budgets only) | Validate `budgets`: keys ⊆ project phase ids, values integers 0..1e10, and `coalesce(sum(values), 0) <= 1e10` (the per-cut total keeps today's bound, `V2:46`), else `invalid`. **Expand only (sync):** (INSERT with `budgets = '{}'` and `budget > 0`) or (UPDATE where `budgets` unchanged and `budget` changed) → single-phase project: `budgets = {phase: budget}`; multi-phase project: raise `invalid`. Then always `budget := coalesce(sum(budgets values), 0)`. | `invalid` |

Ancestors (inline, schema-qualified because the trigger runs with `search_path = ''`, `V26:17`): `with recursive anc(id) as (select unnest(after) from public.tracker_phases where id = v_phase union select unnest(p.after) from public.tracker_phases p join anc on p.id = anc.id) select id from anc` (`v_phase` a PL/pgSQL variable; ≤ 8 rows).

### 4.3 RPCs (all SECURITY INVOKER; every drop/recreate re-applies `revoke execute … from public, anon; grant execute … to authenticated`, pattern `V2:584-597`)

Expand (old named-arg calls keep resolving because the new params have defaults; changed signatures are **drop + create**, not `create or replace`):
- `tracker_create_project(p_name text, p_color text, p_types jsonb default null, p_phases jsonb default null)`. `p_phases` = `[{name, after: [int index], types: [{code,label,color,pay_pct,overlaps_prev}]}]`. If `p_phases` is null, `p_types` is wrapped as one phase "Animation" (old callers). Inserts the project, then **one phase per statement in a loop** (`sort_order` 10, 20…; `after` mapped from indexes to the ids already inserted), then types with global `sort_order` per O6. Takes the lock. Contract: drop `p_types`.
- `tracker_save_work_types(p_project, p_types jsonb)` (same signature, `create or replace`): payload rows `{id, code?, label, color, pay_pct, overlaps_prev}`. Raises `phase_locked` if the payload id set ≠ the project's type ids, or a row has no id, or a given `code` or `sort_order` differs from the stored one. Otherwise updates only `label, color, pay_pct, overlaps_prev`. Returns all types by `sort_order`.
- `tracker_set_cut_budget(p_cut uuid, p_phase uuid, p_budget bigint)` (new): lock on the cut's project; one `update … set budgets = budgets || jsonb_build_object(p_phase::text, p_budget)` (atomic under the row lock); `p_phase` must belong to the cut's project else `invalid`; returns the cut.
- `tracker_set_cut_splits(p_project, p_cuts uuid[], p_split jsonb, p_phase uuid default null)` (drop + create): `p_phase` null = today's whole-split replace (old callers). With `p_phase`: keys of `p_split` must be `p_phase`'s types; for each cut remove `p_phase`'s type keys **and keys of types no longer in the project**, merge `p_split` (`null` = default for that phase); empty → `pay_split = null`. Contract: `p_phase` required, whole-replace branch removed.
- `tracker_create_task(…, p_budget bigint default null, p_is_fix …, p_budgets jsonb default null)` (drop + create, `V26:115-127`): used only when it creates the cut: `budgets = p_budgets` if given, else `{phase of p_work_type: p_budget}` **only when `p_budget is not null`**, else `'{}'` (never a JSON null value). Contract: drop `p_budget`.
- Every migration (expand and contract) ends with `notify pgrst, 'reload schema';`.

### 4.4 Expand migration order (Codex 8, critic M1)

1. Preflight (also run as a dry run before Gate A, results to the owner): (a) cuts whose `pay_split` has keys not in the project's types; (b) of those, cuts whose live keys do not sum to 100 or have no live key. If (b) is non-empty, those cuts are **left untouched** (owner decision 2026-10-06: C36, C40 keep their 95% split as today). (a)-only rows are stripped in step 4 (pay unchanged: `stagePct` reads only live type ids).
2. Create `tracker_phases` (+ RLS, policies, grants), no guard trigger yet. Add `phase_id` (nullable) and `budgets`.
3. Backfill: per project insert phase "Animation" (`sort_order 10`); set `phase_id` on every type; `budgets = jsonb_build_object(phase_id, budget)` where `budget > 0` else `'{}'`; strip stale split keys (step 1a). Disable the audit UPDATE triggers on `tracker_cuts` and `tracker_work_types` around these UPDATEs (`alter table … disable trigger <audit upd trigger>` / enable; exact names from `V2:411-434`) so history is not flooded.
4. `set constraints all immediate;` then asserts: every type has a phase; every phase sums to 100; per cut `budget = sum(budgets values)`; per cut × live type the effective pct is unchanged (compare a temp snapshot of `case when pay_split is null then pay_pct else coalesce((pay_split->>id)::numeric, 0) end` before/after).
5. `phase_id set not null` + FK; create/replace triggers (§4.2) and RPCs (§4.3); ACLs.

Contract (Gate B), in this order: `drop trigger tracker_cut_budgets on tracker_cuts` (its `UPDATE OF budget` column list depends on the column); `create or replace` the function without sync; `create trigger … before insert or update of budgets`; then drop `budget`; drop `role`; recreate `tracker_create_project(p_name, p_color, p_phases jsonb)` with **no defaults** (all required), `tracker_set_cut_splits` with `p_phase` required, `tracker_create_task` without `p_budget`; re-apply ACLs; `notify pgrst, 'reload schema'`; assert advisors (security) empty.

### 4.5 TypeScript contracts

`TR/phases.ts` (new, pure):
```ts
export type Phase = Pick<Tables<'tracker_phases'>, 'id' | 'name' | 'sort_order' | 'after'>;
export function sortPhases(phases: Phase[]): Phase[];
export function ancestors(phases: Phase[], id: string): Set<string>;          // closure over after
export function phaseLevels(phases: Phase[]): Map<string, number>;          // 0 = no deps; 1 + max(level of after)
export type PhaseState = 'done' | 'started' | 'empty';
export function phaseState(typeIds: string[], stage: (typeId: string) => {progress: number} | undefined): PhaseState;
```

`TR/pay.ts`:
- `cutBudget(cut, phaseId): number` = `cut.budgets[phaseId] ?? 0`; `cutTotal(cut): number` (sum).
- `phaseSplit(cut, phaseTypeIds): Record<string, number> | null` — the cut's override for one phase, or null.
- `stagePct(cut, type, phaseTypeIds)`: override for the type's phase present → `split[type.id] ?? 0`, else `type.pay_pct`.
- `payLines(tasks, cuts, types)` keeps its signature; amount = `stagePay(cutBudget(cut, type.phase_id), stagePct(…))`. The picked cut/type types require `budgets` / `phase_id` so `tsc` catches loaders that omit them.

`TR/pipeline.ts`:
- `typeRule(types, phases)` adds `phaseOf`, `anc` (`ancestors` per phase); `prev` per phase.
- `orderConflict` adds reasons `'phaseBefore' | 'phaseAfter'`, same branches and pick order as §4.2 `tracker_task_order`. `orderConflictText` messages in DICT.
- `waitingFor` (`CV/cutsViewHelpers.ts:14`) scoped to the type's phase.

Actions (`ACT`):
- `createProject({name, color, phases})` — zod: 1–8 phases, names unique (case/space-insensitive), each ≥ 1 type, ≤ 50 types total, codes unique project-wide, each phase sums to 100, `after` indexes < own index, unique; calls the RPC with `p_phases` only.
- `saveWorkTypes({project_id, types: {id, label, color, pay_pct, overlaps_prev}[]})` — reads `id, phase_id` server-side (extend the existing select at `ACT:218`) and checks per-phase sums before the RPC.
- `setCutBudget({cut_id, phase_id, budget})` (new); `setCutSplits({project_id, cut_ids, phase_id, pay_split | null})`; `createCuts({project_id, from, to, phase_id?, budget?})` inserts `budgets` `{phase_id: budget}`; `createTask` sends `p_budgets`; `updateCut` patch drops `budget`.
- `TR/errors.ts`: `phase_locked`, `phase_invalid` + DICT.

### 4.6 UI

**Project modal (`TR/ProjectsTable/`, loader `APP/projects/page.tsx`)**
- Loader adds `tracker_phases` (`id, project_id, name, sort_order, after`); types already carry `phase_id`.
- Create mode: new `TR/PhasesEditor/` (owner picked layout A, "columns by level"; reference prototype https://claude.ai/artifact/93322Zahw3poSRPjSCeieu v2). Phases laid out as **columns by dependency level** (`phaseLevels`) left → right; phases in one column run in parallel; SVG connectors from each prerequisite to its dependent. Each phase card: drag grip, name input, its stages (the `WorkTypesEditor` rows scoped to the phase, add/remove/reorder allowed while creating), a per-phase pay total badge (must be 100), a "Starts after" toggle-chip group listing **all other phases** (cycle-creating chips disabled with a reason), and a connector handle on its right edge.
  - **Drag a connector** from a card's handle onto another card → adds the prerequisite (source → target); invalid targets (cycle, duplicate) shown muted. Click a connector to select it; Delete/Backspace or its midpoint "×" removes it.
  - **Drag a card** within its column to reorder parallel phases (tie-break for squares/tabs); a drop in another column snaps back with a hint ("columns follow prerequisites").
  - Pointer events, no new dependency (same approach as `GB/dragMath.ts`); chips are the keyboard path.
  - Pure helpers in `TR/phases.ts`: `wouldCycle(phases, from, to)`, `topoOrder(phases, tieBreak)`.
- C0 prototype: done; owner chose layout A with free prerequisites, draggable cards and draggable connectors (O3 revised).
- Edit mode: phases read-only (names, columns, connectors); stages: code read-only (O9), label / colour / pay % / overlaps toggle editable; no add/remove/reorder; a line "Phases, stages and their order are fixed after creation."

**Cut × payment (`CV/`, loader `PID/cuts/page.tsx`)**
- Loader adds `tracker_phases`; passes `phases`.
- `PhaseSquares`: 10 × 10 px squares, gap 3 px, in phase `sort_order`, first child of `.cutHead`; code + trash stay right (`.cutHead` justify so squares sit at the left edge). States per D7 / O1; Mantine `Tooltip` "<phase name> · <state>"; the active phase's square has an underline.
- Switcher: Mantine `SegmentedControl`, first child of `.toolbar`; hidden for one phase (O2).
- Columns, header %, `cellState`, fix counts, bulk cells: active phase's types only. `typeRule(workTypes, phases)` at `CutsView.tsx:80,108,368,371` gets the **full** type list and phase graph (conflict text must see other phases even when hidden; review m1, Codex 10).
- Budget cell: `BudgetInput` edits `budgets[activePhase]` via `setCutBudget`; a grey line under it shows the all-phase cut total when > 1 phase.
- Split button: shows the active phase's split; "custom" detection uses `phaseSplit` (not "pay_split non-null", `CutsView.tsx:282`). `SplitModal` gets `phase` + phase types; presets by position within the phase (`presetToDraft(pcts, phaseTypes)`); calls `setCutSplits` with `phase_id`.
- Footer (O8): active phase per-stage assigned totals; first cell: phase total + all-phase total.
- `AddCutsModal`: budget label "Budget (<phase name>)", sends `phase_id` = active phase.
- `CutDrawer`: audit `budgets` diff shown per phase name; `pay_split` diff grouped by phase; the legacy scalar `budget` branch (`CutDrawer.tsx:151,176`) stays for historic rows.

**Board (`GB/`, loader `PID/page.tsx`)** (D10: only the rule)
- Loader adds phases; every `typeRule(` call site passes phases (grep).
- Undo snapshots: `budget: number | null` → `budgets: Record<string, number> | null` (`GB/undoStack.ts:10`, `GanttBoard.tsx:442,489`). Undo of a delete passes the **full** `budgets` map as `p_budgets`, which applies only if the cut has to be re-created (`GanttBoard.tsx:641`); an existing cut is left alone.
- `CreateTaskPopover` budget (new cut, `:61,103,211`) → `p_budgets = {phase of chosen type: n}`.

**Earnings**: `TR/Earnings/loadEarnings.ts:19-20` selects `budgets` instead of `budget`, and `phase_id` on types. No UI change.

**Roles** (contract-safe order): B3 changes `APP/layout.tsx:23` to select `email, display_name` (works before and after Gate B); DICT per O7; `CLAUDE.md` overview line and the `insert into tracker_users` snippet without `role`.

## 5. Acceptance criteria

SQL acceptance script `.omc/e2e/v2.8/sql-tests.sql`, run by the main session via `execute_sql` **after Gate A** on the live DB (the A1 dry run checks only the §4.4 asserts). Shape: one outer `begin; set local role authenticated; set local request.jwt.claims …;`, a `savepoint` per case with `rollback to savepoint` after it, and a final `rollback`. Fixtures are created inside the outer transaction with constraints left deferred, then `set constraints all immediate` flushes them once before the cases (a project needs its phases and types before the deferred `pct_total` runs). Shared fixtures: the S1 project, its members (via `tracker_set_member_departments`, v2.7 membership trigger) and cut C1. Cases that need deferred checks call `set constraints all immediate` inside their savepoint. "Older project" cases use a committed existing project (e.g. the test project in the screenshot).
- S1 `tracker_create_project` with `p_phases` = BG (sketch, colour, final), Animation (LO, GE, DO, SH), Comp (pre, prod, post; after [0,1]) → 3 phases; Comp `after` = both ids; 10 types with phase ids and strictly increasing `sort_order` in phase order.
- S2 On an older project: insert into `tracker_phases` → `phase_locked`; insert into `tracker_work_types` → `phase_locked`; update a type's `code` / `phase_id` / `sort_order` → `phase_locked`; delete a type → `phase_locked`; update the project's `created_at` → `phase_locked`.
- S3 `p_phases` with `after` pointing to itself or a later index → `phase_invalid`.
- S4 A phase whose types sum to 90 → `pct_total`; a phase with no types → `pct_total`.
- S5 Cut C1 of the S1 project: SH ends 10/10, Comp pre starts 10/10 → `order_conflict`; starts 11/10 → ok. Then BG final ending 12/10 → `order_conflict` (Comp is a descendant of BG); BG final ending 10/10 → ok.
- S6 Transitive: phases A → B → C (C after B, B after A); cut has an A task and a C task only; C starting on/before A's end → `order_conflict`.
- S7 BG and Animation tasks with overlapping dates in one cut → ok.
- S8 Intra-phase unchanged: GE starting on/before LO's end → `order_conflict`; SH (`overlaps_prev`) starting on DO's start → ok. Comp's first type with `overlaps_prev = true`: Comp pre starting on SH's end → still `order_conflict` (overlap never crosses phases).
- S9 Fix tasks exempt from both rules.
- S10 `pay_split` = Animation keys summing 100, no BG keys → ok; Animation keys summing 90 → `pct_total`; a key of another project's type → `pct_total`.
- S11 `tracker_set_cut_budget(BG, 500000)` then `(Animation, 800000)` on one cut → `budgets` holds both, `budget` (expand) = 1300000. `budgets` with an unknown key, `-1`, or two phases at 6e9 (total > 1e10) → `invalid`; `budgets = '{}'` → `budget = 0`. Old-style `update tracker_cuts set budget = 900000` on a one-phase project → `budgets = {Animation: 900000}`; on a multi-phase project → `invalid`. (`ponytail:` no two-connection race test; atomicity comes from the single-statement row-locked UPDATE.)
- S12 Old-call compatibility (expand), SQL level: `tracker_create_project` with `p_types` only → one phase "Animation"; `tracker_set_cut_splits` without `p_phase` → whole replace still works; `tracker_create_task` with `p_budget` on a new cut → `budgets = {phase: p_budget}`; with `p_budget` omitted / null → `budgets = '{}'`; with `0` → `{phase: 0}`; on an existing cut its budgets are unchanged. `pg_proc` has exactly one row per changed RPC name.
- S12h Old-call compatibility, HTTP level (PostgREST resolver + schema cache): right after Gate A, an E2E run on the **deployed** site (old code) on a test project: create a task with a budget on a new cut, edit a cut budget, apply a split, open the earnings page → all succeed. Repeated with the new code after the deploy, and after Gate B.
- S13 Migration asserts (§4.4 step 4) pass on live; every project has exactly one phase "Animation"; per-cut `budget = sum(budgets)`; effective pct per cut × type unchanged; advisors (security) empty.
- S14 (Gate B) After contract: `budget` / `role` columns gone; old-param calls fail; S1, S5, S10, S11 (minus the sync lines) re-run green; advisors empty.

Unit (Vitest; `npm test` green):
- U1 `phases.test.ts`: `ancestors` (chain, diamond); `phaseLevels` (BG 0, Animation 0, Comp 1; chain 0/1/2); `phaseState` (done / started / empty).
- U2 `pay.test.ts` numeric fixtures: cut budgets `{BG: 1_000_000, AN: 2_000_000}`, BG types 20/30/50, AN 30/30/30/10 → BG sketch 200 000, AN SH 200 000; AN override `{LO:40, GE:40, DO:20, SH:0}` → SH 0, BG unchanged; override omits a type → 0; no budget for a phase → 0; fix task → no line; rounding case `1 000 001 × 33.33%` matches `stagePay`.
- U3 `pipeline.test.ts`: per-phase `prev`; `phaseBefore` / `phaseAfter` mirror S5–S8; fixes exempt.
- U4 `cutsViewHelpers.test.ts`: `presetToDraft` on phase types; `waitingFor` stays in phase.
- U5 `errors.test.ts`: `phase_locked`, `phase_invalid` in en and vi.
- U6 `undoStack.test.ts`: snapshot carries `budgets`; restore payload passes the full map.

Build: `npx.cmd tsc --noEmit`, `npm run lint`, `npm run build` clean. Reviewer check (§4.0 rule): no `tracker_cuts` select / insert / update / patch type uses the `budget` column (the CutDrawer legacy audit branch is allowed), no `tracker_users` select of `role`, no `p_types` in the `tracker_create_project` call, no `p_budget` in the `tracker_create_task` call. After Gate B the regenerated types make any leftover fail `tsc`.

E2E (browser, `sonnet-executor`; brief after Wave C; screenshots light + dark only for E3):
- E1 Create a 3-phase project (S1 shape) in the editor: BG and Animation shown in column 1, Comp in column 2; save; reopen → phases read-only, stage code read-only, no add/remove/reorder; label/colour/% edit saves.
- E2 Cut view: 3 tabs; columns change per tab; choice survives reload; no switcher on a one-phase project.
- E3 Squares: empty → started after one BG task → done after all BG stages at 100%; tooltip text; squares left of the code.
- E4 Per-phase budget: set BG 1 000 000 and AN 2 000 000 on one cut; switch tabs; each input shows its own value; a BG sketch task with default 20% shows 200 000 ₫; footer first cell shows phase total and all-phase total of assigned pay.
- E5 SplitModal on AN with a preset: AN cells change, BG cells unchanged.
- E6 Board: creating a Comp task that starts before the cut's SH ends → refused with the phase order message; on an existing one-phase project: creating GE before LO ends is refused, moving and undo still work (named regressions).
- E7 Allow-listed user still reaches the tracker after Gate B; a non-listed `@sinostudio.vn` user still sees NotAuthorized.

## 6. Implementation waves (max 3 subagents at a time)

| ID | Deps | Task | Contract | Acceptance |
|----|------|------|----------|-----------|
| A1 | — | Expand migration `tracker_v28a_phases` (§4.0–4.4), written to `MIG/`, not applied | §4.1–4.4 | Main-session dry run `begin; … rollback;` on live; preflight report |
| A2 | A1 | SQL acceptance script `.omc/e2e/v2.8/sql-tests.sql` (harness shape in §5) | S1–S12 | Written; reviewed |
| C0 | — | PhasesEditor prototype artifact (2 layouts) | — | Owner choice recorded in the decisions file |
| **Gate A** | A1, A2 | Owner OK (and users told not to create projects until the deploy) → apply expand, run A2 (S1–S13), `get_advisors`, then E2E S12h on the deployed site | — | S1–S13, S12h pass |
| A3 | Gate A | Regenerate `database.types.ts` + `supazod` | — | Regenerated |
| B1 | A3 | `TR/phases.ts`, `pay.ts`, `loadEarnings` + tests | §4.5 phases / pay | U1, U2 |
| B2 | A3 | `pipeline.ts`, `waitingFor` + tests | §4.5 pipeline | U3, U4 |
| B3 | A3 | Roles (layout select, DICT O7, CLAUDE.md role lines), error keys + DICT | — | U5 |
| C1 | B1, C0 | `PhasesEditor`, project modal create/edit, `APP/projects/page.tsx` loader, `createProject` / `saveWorkTypes` actions | §4.3, §4.5 actions, §4.6 project modal | E1 locally; tsc |
| C2 | B1, B2 | Cut view: loader, squares, switcher, `typeRule` call sites, budget / split / footer, `AddCutsModal`, `SplitModal`, `CutDrawer`; actions `setCutBudget`, `setCutSplits`, `createCuts`, `updateCut` | §4.5 actions, §4.6 cut view | E2–E5 locally; tsc |
| C3 | B1, B2 | Board loader, `typeRule` call sites, undo `budgets`, create popover, `createTask` action | §4.6 board | U6; E6 locally |
| R1–R3 | C1–C3 | Fresh reviewer per C row (`opus-executor`), incl. the §5 grep | — | Findings verified by the orchestrator |
| E | R | E2E E1–E6 (`sonnet-executor`) | brief | Pass table + screenshots `.omc/e2e/v2.8/` |
| **Gate B** | E, owner deploy | Owner deploys; S12h with new code; then main session applies contract `tracker_v28b_contract`, regenerates types, `tsc`, S12h again | §4.0, §4.4 contract | S14; E7; S12h |
| D | Gate B | Docs: `CLAUDE.md` tracker section (phases, budgets, rules, migrations, tests), memory | — | Updated |

Waves: W1 = A1 + C0; W2 = A2; Gate A; W3 = A3 → B1, B2, B3; W4 = C1, C2, C3; W5 = R1–R3; W6 = E; Gate B; W7 = D.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Live tracker breaks during development (shared DB) | Expand/contract (D12); S12 proves old calls work; owner spot-checks after Gate A. |
| Lock bypass via direct PATCH | Triggers on types/phases/projects (S2), not grants; `created_at` immutable. |
| Stale split keys make migration change pay | Preflight; stop if any cut would change; per-cut effective-pct assert (§4.4). |
| Old code writes `budget` on a multi-phase test project | Sync raises `invalid`; only dev test projects can be multi-phase before deploy. |
| Dropping `budget` / `role` misses a reader | New code never uses them (§4.0 rule + grep in review); contract + regen makes `tsc` fail on any leftover. |
| Cross-phase rule rejects existing data | All existing projects are one phase: no cross-phase pairs. |
| Undo restores the wrong budgets | Full map via `p_budgets`, only on cut re-creation; U6. |
| Presets made for 4 stages on a 3-stage phase | `presetToDraft` flags missing/extra (unchanged). |
| PhasesEditor hard to read | C0 prototype, owner picks. |

## 8. Verification steps

1. A1 dry run + preflight report (main session, `execute_sql`, rolled back).
2. Gate A: apply expand; S1–S13; advisors; owner spot check of the live tracker.
3. Per C row: `npx.cmd tsc --noEmit`, `npm test`, `npm run lint` (background).
4. Reviewer per C row; orchestrator verifies findings.
5. E2E E1–E6.
6. `npm run build`. Owner deploys.
7. Gate B: contract; regen; `tsc`; S14; E7.

## 9. ADR

- **Decision:** immutable `tracker_phases` (`after uuid[]`); `phase_id` on work types; per-phase budgets in `tracker_cuts.budgets jsonb`; per-phase validation of the flat `pay_split`; cross-phase date rule via an inlined ancestor CTE in the existing order trigger; lock = "inserted in the project's creation transaction" with immutable `created_at`; `role` dropped; expand/contract rollout.
- **Drivers:** SQL-authoritative rules; minimum new surface; lock holds against direct API writes; live tracker stays up.
- **Alternatives considered:** `tracker_cut_phases` table (B); `tracker_phase_deps` join table (C); column-grant locks (rejected: invoker RPCs need the grants, table grants override column revokes); a `private` ancestor helper (rejected: no schema usage for authenticated); levels instead of "starts after", done-gated / display-only dependencies, one 100% across all types (owner rejected); one destructive migration with downtime, or a paid Supabase branch (owner chose two-step).
- **Why chosen:** same guarantees as B with half the touched surface; cut-level data stays on the row every consumer already loads; the rollout keeps the live tracker working.
- **Consequences:** types can't be added/removed/recoded after creation; jsonb validation triggers to maintain; `updateCut` no longer writes budget; RPC signatures change twice (expand adds params, contract drops old ones); between the gates the old UI refuses type edits.
- **Follow-ups:** earnings by phase if wanted; optional soft cross-phase overlap.

## Changelog
- r1 (2026-10-06): initial draft.
- r2 (2026-10-06): review round 1 merged (`.omc/drafts/tracker-v2.8-review-r1.md`): no column-grant locks (B1/Codex 2); trigger locks incl. `code`, `id`, `created_at` (M3, Codex 4/5); inlined ancestor CTE (Codex 3); order rule restated by phase relation (M4, Codex 7); migration order, preflight, per-cut asserts, audit off during backfill (M1, Codex 6/8); RPCs as drop + create with added optional params (M2); two-step rollout D12 (Codex 1, owner); undo full `budgets` (Codex 11); loaders and action owners per row (Codex 9, m1); phase-scoped override/audit (Codex 10, m3); test harness and numeric fixtures, footer = assigned pay O8 (Codex 12/13, m2); O7 strings, O9 code lock.
- r3 (2026-10-06): review round 2 merged (log `.omc/drafts/tracker-v2.8-review-r1.md`, round-2 section): contract drops the budgets trigger before the column (critic M5); per-cut total ≤ 1e10 and `coalesce(sum)` (critic m7, Codex 2); save_work_types refuses `sort_order` changes (m8); INSERT sync same rule as UPDATE (m9); S8 cross-phase overlap case (m10); work-types audit off during backfill (m11); contract `p_phases` required (m12); `notify pgrst` (m13); `p_budget` null never becomes a JSON null (Codex 1); old-modal custom create documented + users told (Codex 3); SQL harness = one outer tx with savepoints, run after Gate A (Codex 4); S12h HTTP check on the deployed site (Codex 5); scoped reviewer check instead of a blanket grep (Codex 6); schema-qualified CTE (Codex 7).

## Follow-ups (found during execution)
- `APP/projects/page.tsx` loads work types + phases of all projects unpaged (PostgREST max_rows 1000); page with the keyset helper or load per edited project (R1 minor 3, pre-existing pattern).
- Phase / type count limits (≤ 8 / ≤ 50) are enforced by zod + client only, not SQL (O1, accepted).
- Members page did not refresh after adding a department (E2E note; v2.7 area, not investigated).
