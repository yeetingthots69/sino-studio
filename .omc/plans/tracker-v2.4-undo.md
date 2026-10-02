# Tracker v2.4 — board undo / redo

Status: **DONE 2026-10-02** — built, reviewed, E2E-verified (`.omc/e2e/v2.4/e2e-v2.4-results.md`); no migration; uncommitted. r3 approved by owner (consensus planning, interactive). Review log (Critic + Codex + verdicts): `.omc/drafts/tracker-v2.4-review-r1.md`. Execution after approval: `/orchestrate-with-subagents`, max 4 subagents at a time. No git writes (owner commits). Every brief says "do not commit". No migration.

Paths: `GB/` = `src/components/tracker/GanttBoard/`, `TR/` = `src/components/tracker/`, `ACT` = `src/app/[locale]/tracker/actions.ts`.

---

## 1. Requirements summary

User feedback (no detail given): "add an undo in case admins/managers press or move things wrong".

Owner decisions (2026-10-02):

| # | Question | Answer |
|---|----------|--------|
| U1 | Mistakes users make | Accidental drag/resize; wrong person / wrong dates; deleted by mistake |
| U2 | Scope | Board only: task edits (dates, resize, progress, links, cut, type), create/delete, **reassign** (incl. moved bonus/penalty). NOT cuts/pay pages |
| U3 | UX | Toast with an Undo button after each change + Ctrl+Z; own last ~20 changes in this tab; cleared on reload. **Redo too: Ctrl+Y or Ctrl+Shift+Z** (owner add-on) |
| U4 | Conflict | If anyone else changed the task after the change being undone/redone: refuse and explain; never overwrite |
| U5 | Delete undo | Re-create the task (same cut, type, person, dates, progress, links; new id). No DB change |
| U6 | Process | Full pipeline (Critic + Codex review, approval, orchestrated build, review, E2E) |

Current state (evidence):
- Every board write goes through `commit(id, baseline, optimistic, send, onOk, ctx)` (GB/GanttBoard.tsx:291-332), with `planCommit` (GB/taskSync.ts:161-166). The server re-checks the version (`writeVersioned`, ACT:437-459, 517-538). Own acks keep `foreignVersion` (taskSync.ts:86); loaded rows start with `foreignVersion = version` (taskSync.ts:74).
- The board remounts per month (`key={projectId-month}`, `[projectId]/page.tsx:60`); its store holds only that month's tasks (GanttBoard.tsx:95).
- Write call sites: `update` (GanttBoard.tsx:334-346; bar drag/resize :614, panel :673 → TaskPanel.tsx:88 dates/type, :98 cut, :107 links, :218 progress), `remove` (:348-358, after the panel's confirm), `create` (:361-377, `createTask` RPC, not via `commit`), `confirmMove` (:424-443, from `MoveDialog`).
- `tracker_create_task` inserts at version 1. It enqueues an "assigned" notice. It creates a missing cut with `coalesce(p_budget, 0)` (v2.sql:449, 502-503). `progress`/`links` changes do not enqueue a notice (v2.sql:452).
- `tracker_move_task` moves the current holder's movable adjustment rows of that stage (reversal + copy in batch `op_id`). It raises `adjustment_invalid` only on batch-id reuse (v23 sql:68-93). Adjustment rows carry `batch_id`; `movableAdjustments` lives in TR/pay.ts:97-107.
- No `@mantine/notifications`. Errors show in the `.notice` banner.

Out of scope: cuts/pay/people/projects/staff pages; undo across reloads or tabs; undoing other people's changes (no history panel); jumping to the month of an off-screen undone task.

---

## 2. RALPLAN-DR summary

**Principles**
1. Undo/redo is an ordinary new write through the same chain and server actions. **The DB version check is the conflict authority.** The client never decides "no conflict" from its month-scoped store.
2. Record only confirmed changes (in `onOk`).
3. Pure stack logic in a pure module with Vitest tests; GanttBoard only wires it.
4. No new dependencies, no migration.
5. Never overwrite a foreign change (U4), task or pay.

**Decision drivers**
1. No silent overwrite of a colleague's edit, and no pay double-move.
2. No regression of the commit chain / taskSync / realtime.
3. Small diff in `GanttBoard.tsx`.

**Options considered**

*O1 — Where undo state lives*
- **(a) Client stack per board tab, kept in a module-level map keyed by project id (chosen).** It survives the per-month remount and clears on reload. Version invariant (§4.1): every entry of task X carries X's latest **own** confirmed version, so "server version == entry.version" means exactly "nobody else touched it".
- (b) Server history from `tracker_audit_log`. Supports undoing anyone's change. Needs a restore RPC per table plus permissions; owner chose U3. Follow-up.

*O2 — Conflict check*
- **(a) Send `expected_version = entry.version` and skip `planCommit` (chosen).** Works for off-month tasks and remounted stores; the server refuses any foreign change.
- (b) `planCommit` with `baseline = entry.version` (r1). Wrong after a remount: loaded rows count as foreign, off-month tasks are missing, and re-created rows restart at v1 (Critic F1, Codex X1/X2). Rejected.

*O3 — Delete undo*
- **(a) Client two-step (chosen):** `createTask` (with the snapshot's cut budget), then, if progress or links differ from the defaults, a normal versioned `updateTask`. Each step is independently safe on retry; a partial success keeps the new id. No action change.
- (b) Follow-up update inside the `createTask` action (r1). A deadlock retry re-runs the insert and fails with `duplicate` (Codex X4). Rejected.
- (c) Exact-restore RPC: needs a migration; owner chose re-create.

*O4 — Reassign undo with moved bonus/penalty*
- **(a) Inverse `moveTask` with the same flag, after a client pre-check (chosen):** proceed only if the holder's current movable rows for that stage are exactly the copies the recorded batch created. Otherwise refuse with "pay changed since". Ponytail: check-then-act race window of one round trip. The upgrade path is a server-side `p_expected_ids` on the RPC (migration).
- (b) Reverse the batch rows one by one. Not atomic, more code. Rejected.

*O5 — Toast*: own small component (Mantine core `Notification`) — chosen over adding `@mantine/notifications`.

---

## 3. Behaviour spec

- **Recorded actions** (own, successful): bar drag/resize, panel dates/type/cut/progress/links, create (New Task popover), delete (panel), move/reassign (MoveDialog). One user action = one entry. Every own confirmed write calls `rebase(id, row.version)` first (a no-op change still bumps the version); recording is skipped only when before equals after.
- **Stack:** `undo` and `redo` lists, max 20 each (oldest dropped). A new recorded action clears `redo`. Stored per project in a module-level map, so it survives month navigation and clears on reload.
- **Undo** takes the top entry and sends its inverse. On success the entry goes to `redo` with the new version, and a toast shows "Undone: <label>" with **Redo**. Redo is symmetric ("Redone: <label>" with **Undo**). When the task is outside the viewed month, the label ends with the month (e.g. "· 11/2026").
- **Barrier:** undo/redo (keys, toolbar buttons, toast buttons) do nothing while any of these hold:
  - a board write is pending: `pending.length > 0`, `undoBusyRef.current` (held for the whole `runUndo`, incl. the two-step re-create and the pay pre-check), or `createBusy` (set around the New Task `create`, which bypasses `commit`);
  - the panel has an unsaved draft (`panelDirtyRef.current`) or the discard prompt is showing;
  - MoveDialog or the New Task popover is open;
  - a bar drag is in progress.

  Buttons are disabled in the same state.
- **Generation:** `record` bumps `gen`. If a `record` happened between `take` and success, `settled` does not push the entry to the opposite list, so a stale redo cannot overwrite the new action.
- **Refusal:** server `conflict` / `not_found` → the entry is dropped and the banner shows `undo.conflict` ("This task was changed since — can't undo"). Pay pre-check fail → dropped + `undo.payChanged` ("Can't move the bonus/penalty back automatically — fix it on the Cuts page"; also shown when the holder had their own open rows for that stage before the move). Any other error → dropped + the normal `failText`.
- **Delete ↔ create:** undo of delete and redo of create = re-create (O3a). Every entry in both lists with the old id is remapped to the new id and rebased to its version. Undo of create and redo of delete = versioned delete; clear the selection first if it is that task. Re-create errors (`duplicate`: the slot was refilled; `order_conflict`) → dropped + normal message. If the follow-up progress/links update fails, the re-created task stays recorded (new id, its real version) and the banner shows the error.
- **Toast after a normal action:** "<label> · Undo", 6 s, replaced by the next toast, closable.
- **Keyboard:** a window `keydown` listener in the capture phase (like the Escape listener, GanttBoard.tsx:408-419). Match `e.code === 'KeyZ'` (undo; with Shift = redo) or `e.code === 'KeyY'` (redo), with `e.ctrlKey || e.metaKey`, no Alt. Ignore when:
  - `e.repeat`, `e.isComposing` or `e.defaultPrevented`;
  - the target is contenteditable or matches the Escape listener's `closest('input, textarea, select, [aria-modal="true"], [role=listbox], .mantine-Popover-dropdown')`;
  - the barrier holds.

  `preventDefault()` when handled.
- **Buttons:** undo/redo ActionIcons in the board top bar, with `aria-label` + a Tooltip showing the shortcut.
- **Labels** (en + vi), e.g. `{cut} {type}: dates`, `… progress`, `… links`, `… cut`, `… type`, `{cut} {type} → {name}`, `{cut} {type} created`, `{cut} {type} deleted`.
- **Emails:** re-create enqueues a new "assigned" notice, so the digest may show the stage removed and assigned again. An undone move may still send its digest lines if the 5-min mail job ran in between. Accepted, owner informed.

---

## 4. Contracts

### 4.1 `GB/undoStack.ts` (new, pure) + `GB/__tests__/undoStack.test.ts`

```ts
type Task = Tables<'tracker_tasks'>;
export type Fields = Partial<Pick<Task, 'start_date' | 'end_date' | 'progress' | 'links' | 'work_type_id'>> & {cut_code?: string};
export type Placement = {staff_id: string; start_date: string; end_date: string};
export type TaskSnapshot = {project_id: string; staff_id: string; work_type_id: string; cut_code: string; budget: number | null;
  start_date: string; end_date: string; progress: number; links: Task['links']};

export type UndoEntry =
  | {kind: 'update'; id: string; version: number; before: Fields; after: Fields; label: string}
  | {kind: 'move'; id: string; version: number; before: Placement; after: Placement; moveAdjustments: boolean;
     opId: string; cut_id: string; work_type_id: string; label: string} // opId = batch of the last settled move
  // exists = the task exists after the recorded change (create: true, delete: false)
  | {kind: 'presence'; id: string; version: number; exists: boolean; snapshot: TaskSnapshot; label: string};

export type UndoState = {undo: UndoEntry[]; redo: UndoEntry[]; gen: number};
export const UNDO_LIMIT = 20;
export const EMPTY_UNDO: UndoState;
export function record(s: UndoState, e: UndoEntry): UndoState;   // push undo (cap), clear redo, gen+1
export function take(s: UndoState, dir: 'undo' | 'redo'): {state: UndoState; entry: UndoEntry; gen: number} | null;
export function settled(s: UndoState, dir: 'undo' | 'redo', e: UndoEntry, gen: number): UndoState; // push to the OPPOSITE list only if s.gen === gen; always rebase(e.id, e.version)
export function rebase(s: UndoState, id: string, version: number): UndoState;  // every entry with `id`, both lists
export function remap(s: UndoState, from: string, to: string, version: number): UndoState; // id rewrite + rebase
export function inverse(e: UndoEntry, dir: 'undo' | 'redo'):
  | {op: 'update'; fields: Fields}
  | {op: 'move'; placement: Placement; moveAdjustments: boolean; holder: string} // holder = staff who has the task now
  | {op: 'create'; snapshot: TaskSnapshot}
  | {op: 'delete'};
/** Pay pre-check: current movable rows of the holder must equal the batch's unreversed copies. */
export function payUnchanged(rows: AdjRow[], key: {staff_id: string; cut_id: string; work_type_id: string}, opId: string): boolean;
```
**Version invariant:** after any own confirmed write to task X (recorded, undo, redo, re-create, follow-up update), every entry of X in both lists carries X's returned version. GanttBoard calls `rebase` for confirmed writes that don't go through `record`/`settled`, such as the re-create follow-up.

`inverse`: update/move undo → `before`, redo → `after`. Presence: undo of `exists:true` → delete, undo of `exists:false` → create; redo is the opposite.

`payUnchanged`: `movableAdjustments(rows, key)` id set === set of rows with `batch_id === opId && staff_id === key.staff_id && reverses_id === null`. Both empty → true.

Tests:
- cap 20 on both lists, and redo cleared on `record`;
- the gen guard;
- `rebase` and `remap` across both lists;
- the `inverse` table for every kind × direction;
- `take` on an empty list → null;
- `payUnchanged`: equal, extra row added, copy reversed, both empty.

### 4.2 `GanttBoard.tsx` wiring (one owner, B1)
- **State:** `const undoStore = new Map<string, UndoState>()` at module level. The component reads `undoStore.get(project.id) ?? EMPTY_UNDO` into state, with a `undoRef` mirror updated synchronously; every change writes back to the map.
- **`commit`** gains an optional `ctx.expected?: number`. When set, it skips `planCommit` and sends that version. It must work for ids not in the store: no `begin`; `ack` with the row inserts the row.
- **Recording:** `update`, `remove`, `create` and `confirmMove` record in their `onOk`, built from the displayed task at action start plus the returned row:
  - update: before-values from the displayed task (`cut_code` from `cutCodes`);
  - presence: snapshot `budget` from `cuts.get(task.cut_id)?.budget ?? null`;
  - move: `opId` = the confirm's `op_id`.
- **`runUndo(dir)`:** barrier check → `take` → `inverse`:
  - **update / move:** `commit(id, entry.version, display, send, onOk, {expected: entry.version, undo: true})`. A move with `moveAdjustments` first fetches the stage's rows (same query as MoveDialog.tsx:49-52 plus `batch_id`) and runs `payUnchanged(rows, {staff_id: holder, …}, entry.opId)`. On fail: drop the entry and show `undo.payChanged`. The move send uses a new `op_id`; on success the entry's `opId` is set to it.
  - **delete:** clear the selection if `selectedId === id`, then `commit` with `hide: true` and `expected`.
  - **create:** `createTask({project_id, staff_id, work_type_id, cut_code, start_date, end_date, budget})`, then `store.apply ack` + `setCuts`, then `remap(old, new, row.version)`. If progress or links differ from the defaults, call `update` via `commit(new, row.version, …, {expected})`. Its `onOk` → `rebase`; failure → banner only.
  - **Success:** `settled(…, gen)` + toast.
  - **Failure:** the entry is dropped; with `ctx.undo`, `commit` shows `undo.conflict` for `conflict` / `not_found`.
- **Keyboard effect, toolbar buttons, `<UndoToast>`:** as in §3.

### 4.3 `GB/UndoToast.tsx` (new)
Props `{toast: {text: string; action?: {label: string; onClick(): void}} | null; onClose(): void}`. Fixed bottom-left, auto-close after 6 s (timer reset per toast), Mantine core `Notification` + a subtle `Button`. Make sure screen readers announce it (polite live region), whatever Mantine's default is.

### 4.4 Dictionaries `tracker.board.undo.*` (en + vi)
`undo`, `redo`, `undoHint` ("Undo (Ctrl+Z)"), `redoHint` ("Redo (Ctrl+Y)"), `undone`, `redone`, `conflict`, `payChanged`, `offMonth` ("· {m}/{y}"), labels per kind, `moveReason` (≥ 3 chars).

---

## 5. Risks and mitigations

| # | Risk | Mitigation |
|---|------|-----------|
| R1 | Month remount wipes the stack or breaks the check | Module map per project; server-authority check (O2a); E2E row |
| R2 | Ctrl+Z during an in-flight write undoes the wrong change | Pending barrier + gen guard; E2E row with a throttled network |
| R3 | Ctrl+Z in a text field / MonthNav input undoes the board | Same `closest` filter as Esc; E2E row |
| R4 | Re-created task's new id / version 1 bypasses the conflict check | `remap` + `rebase`; unit test; E2E foreign edit after restore |
| R5 | Move undo carries pay that changed after the move | `payUnchanged` pre-check (race window of one round trip; upgrade = RPC `p_expected_ids`) |
| R6 | Re-create into a deleted cut loses its budget | Snapshot `budget` |
| R7 | Toast noise | One at a time, 6 s |

---

## 6. Implementation steps (waves)

### Wave A (parallel; disjoint files)
| ID | Files | Deps | Task | Contract | Acceptance |
|----|-------|------|------|----------|-----------|
| A1 | `GB/undoStack.ts`, `GB/__tests__/undoStack.test.ts` | — | Pure stack + pay check | §4.1 | All §4.1 test cases pass; tsc |
| A2 | `GB/UndoToast.tsx`, `en.json`, `vi.json` | — | Toast + keys | §4.3, §4.4 | tsc, lint; keys present in both files |

### Wave B
| ID | Files | Deps | Task | Contract | Acceptance |
|----|-------|------|------|----------|-----------|
| B1 | `GanttBoard.tsx` (+ `TaskPanel.tsx` only if needed) | A1, A2 | Wiring, keyboard, buttons, barrier | §4.2, §3 | tsc, tests, lint, build; the executor's own browser smoke test (own tab): drag → Ctrl+Z → Ctrl+Y; Ctrl+Z in the links textarea leaves the board alone; buttons disabled while a write is pending |

Each row gets a separate `opus-executor` reviewer.

### Wave C — E2E (`sonnet-executor`)
Run in its own Chrome tab: no global resize/emulate, never touch other sessions' tabs, never call `/api/tracker/cron`. Clean up test data afterwards. Pass/fail per row:
1. Every recorded action × undo × redo (dates, resize, progress, links, cut, type, create, delete, move with and without pay).
2. Conflict: a second tab of the same account edits the task after the change. Undo is refused with the conflict text, and no overwrite happens.
3. Delete → undo re-creates with the same progress and links → redo deletes → undo again works (remap).
4. Delete → undo → second tab edits the re-created task → undo of an older entry for that task is refused (R4).
5. Move with bonus/penalty → undo: Earnings totals are back to the original. Move → add a bonus for the new person → undo is refused with `payChanged`.
6. Ctrl+Z inside the links textarea, the Cut field and the MonthNav input does not touch the board.
7. Change dates → navigate to another month → Ctrl+Z works, and the toast shows the month. Reload clears the stack.
8. Shortcuts and buttons do nothing during a pending write (slow network) and while the discard prompt shows.

---

## 7. Verification steps
`npx.cmd tsc --noEmit`, `npm test`, `npm run lint` (0 errors), `npm run build`; E2E table per §6 C.

## ADR
- **Decision:**
  - a per-tab client undo/redo stack, kept per project across month remounts;
  - inverse writes through the existing commit chain, with the server version check as the only conflict authority, made exact by the version invariant;
  - delete undo re-creates the task in two client-side steps;
  - move undo runs a client-side pay pre-check.
- **Drivers:** no silent overwrite, no pay double-move, small diff.
- **Alternatives:**
  - audit-log history restore (rejected: scope, owner choice);
  - `planCommit` baseline (rejected: breaks across remounts and re-creates);
  - follow-up update inside `createTask` (rejected: deadlock retry duplicates the insert);
  - exact-restore RPC (rejected: migration, owner choice);
  - `@mantine/notifications` (rejected: new dependency).
- **Why chosen:** zero DB change; every guard reduces to a server-checked version or a narrow pre-check.
- **Consequences:**
  - undo is lost on reload;
  - re-created tasks get new ids, so the audit log shows a delete + insert and the digest may show removed + assigned;
  - the pay pre-check has a small race window.
- **Follow-ups:**
  - a history panel from `tracker_audit_log`;
  - jump to the month of an off-screen undone task;
  - an RPC-level `p_expected_ids` on `tracker_move_task`.

## Changelog
- r1 (2026-10-02): draft.
- r2 (2026-10-02): applied Codex X1–X6 and Critic F1–F7 (all confirmed; see the review log):
  - server-authority conflict check plus the version invariant;
  - a module-level stack per project;
  - the pending barrier and gen guard;
  - client-side two-step re-create (the r1 A2 action change is dropped);
  - the pay pre-check;
  - the budget in the snapshot;
  - keyboard matching in the capture phase;
  - clearing the selection before an inverse delete;
  - behaviour checks in B1 acceptance and E2E rows 2–8.
- r3 (2026-10-02): Critic round 2 (APPROVE WITH CHANGES), all confirmed:
  - N1: the barrier also covers `undoBusyRef` (whole `runUndo`) and `createBusy` (New Task create);
  - N2: unconditional `rebase` on every own confirmed write;
  - N3: the pre-check query adds `batch_id`;
  - N4: softer `payChanged` wording.
- Execution (2026-10-02):
  - A1, A2 and B1 were each reviewed PASS by a separate reviewer.
  - B1 deviation, accepted: the undo state lives only in the module map, via `useSyncExternalStore`, with no ref+state mirror.
  - B1 fix round:
    - a module-level in-flight counter per project, so the barrier works across month remounts;
    - the tooltip wrapper on the disabled buttons;
    - the delete-confirm copy now mentions undo.
  - E2E: 21 pass, 1 partial (8a: delay simulated with a fetch wrapper; no network throttle, to keep the shared Chrome untouched), 0 fail.
  - Leftover: cut `E2E-U2` (net-0 adjustment rows block its delete). Follow-up: the Cuts page shows no error when a cut delete is blocked.
