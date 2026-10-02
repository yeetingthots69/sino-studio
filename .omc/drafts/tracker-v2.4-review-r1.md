# Tracker v2.4 undo/redo — review round 1 (plan r1)

Critic (`fable-critic`) and Codex reviewed the same r1 snapshot in parallel, not cross-fed. The orchestrator checked every finding against the code. Plan r2 applies them.

## Codex (verdict REVISE)

| # | Sev | Finding | Verdict | Evidence / resolution |
|---|-----|---------|---------|-----------------------|
| X1 | blocker | After a re-create, the new row restarts at version 1. A remapped older entry (v10) lets a foreign edit at v3 pass `planCommit` and get overwritten | CONFIRMED | `accept` own sets `foreignVersion` 0 or keeps it (taskSync.ts:86). The r2 version invariant (§4.1 `rebase`) sets every entry of the task to the latest own version. Undo sends that version, and the server checks it |
| X2 | major | Month remount rebuilds the store. Off-month tasks are missing (conflict-local), and loaded rows start as foreign, so older own entries conflict falsely | CONFIRMED | GanttBoard.tsx:95, taskSync.ts:74. r2: undo sends `expected_version = entry.version` and skips `planCommit` (server is the authority, per the invariant). The stack lives in a module map per project |
| X3 | major | No serialization: Ctrl+Z during a pending write undoes an older entry over it; a new action clears redo before an in-flight undo settles | CONFIRMED | r2: undo/redo blocked while `pending.length > 0`. `gen` counter: `settled` drops the push if a `record` happened since `take` |
| X4 | major | Two-step re-create inside one `writeRow`: a deadlock retry re-runs the insert, giving `duplicate`; partial success loses the mapping | CONFIRMED | `retryDeadlock` retries the whole callback. r2 drops the A2 action change: the client calls `createTask`, then a normal versioned `updateTask` for progress/links. Partial success keeps the new id, recorded at its real version |
| X5 | major | Move undo also transfers adjustments added or reversed after the move (no task version bump) | CONFIRMED | v23 sql:69-92 moves all current movable rows. r2: a pre-check refuses unless the current movable set equals the recorded batch's copies (`batch_id = op_id`). The tiny race window is accepted (ponytail) |
| X6 | minor | Shortcuts act while the discard prompt / dirty panel is open | CONFIRMED | TaskPanel.tsx:55-56,137. r2: blocked while `panelDirtyRef.current`, `pendingNav`, `moveDraft`, or the create popover is open |

## Critic (verdict APPROVE WITH CHANGES)

| # | Sev | Finding | Verdict | Resolution |
|---|-----|---------|---------|-----------|
| F1 | major | Month navigation: an off-month entry gets conflict-local and the wrong "changed by someone" text | CONFIRMED (same as X2) | Server-authority undo. The toast names the month when the task is off-screen |
| F2 | major | Ctrl+Z during an in-flight drag undoes #1 over #2 | CONFIRMED (same as X3) | Pending barrier |
| F3 | minor | Re-create enqueues an "assigned" notice, so the digest shows lose + regain | CONFIRMED | Stated in §3 |
| F4 | minor | Snapshot lacks the cut budget; if the empty cut was deleted, re-create makes a budget-0 cut | CONFIRMED | Snapshot `budget` from `cuts`, pass it to `createTask` |
| F5 | minor | Key matching with Shift; use the Escape listener's capture phase + full `closest` list | CONFIRMED | §3 keyboard |
| F6 | minor | Clear selection before an inverse delete | CONFIRMED | §4.3 |
| F7 | minor | B1 acceptance is build-only | CONFIRMED | Behaviour checks added to B1 |

## Critic round 2 (plan r2; verdict APPROVE WITH CHANGES)

| # | Sev | Finding | Verdict | Resolution (r3) |
|---|-----|---------|---------|-----------------|
| N1 | major | `create` and the undo re-create bypass `pending`, so the barrier has holes; `take` doesn't bump `gen` | CONFIRMED (GanttBoard.tsx:361-377 has no `setPending`) | `undoBusyRef` covers the whole `runUndo`; `createBusy` wraps `create` |
| N2 | minor | A skipped record still bumps the version, so other entries go stale | CONFIRMED (`tracker_bump_version`) | Unconditional `rebase` in every `onOk` |
| N3 | minor | The MoveDialog query lacks `batch_id` | CONFIRMED | Query adds `batch_id` |
| N4 | minor | Misleading "changed since" text when the holder had pre-existing rows | CONFIRMED | Softer wording |
