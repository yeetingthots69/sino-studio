# Tracker v2.3 plan — review log r1

Snapshot reviewed: `.omc/plans/tracker-v2.3-board-ux.md` r1 (2026-10-02).

## Architect pass (orchestrator)

**Antithesis (steelman against O1(a), the move RPC):** the board already has a second reassign path. TaskPanel's assignee Select (TaskPanel.tsx:222-228) calls `update({staff_id})`, which goes through `updateTask` with no confirm and no adjustment handling. Adding a drag-only RPC creates two reassign paths with different pay results for the same user intent. A plain `updateTask` path for both would at least be consistent.
**Synthesis:** keep the RPC, and route the panel Select through the same flow: the Select opens `MoveDialog` with the current dates, then `moveTask`. One reassign path, one rule set. → plan change AR1.

**Tradeoff tension (D6 compact lanes):** cut blocks span [first stage, last stage] of that person, including gaps where another person works the middle stage. Compared with date-only packing this can add lanes (taller rows) for people who do LO and CL of a cut while someone else does AN. Accepted: the owner chose readability (one row per cut) over density; note it in Consequences. → AR2 (doc only).

**Findings**
- AR1 (major): second reassign path in TaskPanel, see above. Plan: B2 makes the panel Select open MoveDialog (dates unchanged) and confirm via `moveTask`; plain `staff_id` is removed from what `updateTask` is used for on the board (zod may keep it for CutsView create paths).
- AR2 (minor): add the lane-count consequence to the ADR.
- AR3 (minor): `commit()` already takes the server call as an argument (GanttBoard.tsx:270 passes `(expected_version) => updateTask(...)`). The B2 contract should say "reuse", not "generalise".
- AR4 (minor): F3 relies on `useTransition` + `router.push` keeping `isPending` true until the new RSC payload renders. The B2 executor must confirm this in `node_modules/next/dist/docs/` (CLAUDE.md rule) and fall back to clearing `pendingMonth` when the `month` prop changes.
- AR5 (minor): the Tooltip wraps the bar `<button>`; Mantine clones the child and attaches ref + mouse handlers. TaskBar must forward them without breaking the pointer handlers it spreads (useBarDrag). Name it in the A4 contract.
- AR6 (info): the move RPC changes `staff_id`, so the notice trigger fires for both people (new: changed, old: removed). Correct per D7c.

## Critic (fable-critic) — pending
## Codex — pending

## Critic (fable-critic) r1 — verdict APPROVE WITH CHANGES; orchestrator verdicts
| # | Finding | Verdict | Plan change |
|---|---------|---------|-------------|
| C1 | Autocomplete has `openOnFocus` (Autocomplete.mjs:21,100); controlled dropdown reopens after pick | CONFIRMED | A3(a): `openOnFocus={false}` + `maxDropdownHeight={180}`; track open state via onDropdownOpen/Close only for Esc |
| C2 | Wave A file conflicts: MonthNav (A1+A3), GanttBoard.module.css (A4 vs B2) | CONFIRMED | MonthNav → A3 only; A4 gets new `TaskBar.module.css` |
| C3 | `commit()` already takes `send` (GanttBoard.tsx:222-229) | CONFIRMED (= AR3) | B2 calls `commit(...)` directly |
| C4 | Phantom batch when move=true and 0 movable rows | CONFIRMED | Count first; batch only if count > 0; negative AC |
| C5 | "read project_id then lock first" wording | CONFIRMED | Clarified: plain SELECT before lock is safe |
| C6 | `staff_archived`→`invalid` shows generic error | CONFIRMED | New TrackerError `staff_archived` + `t.moveArchived` |
| C7 | `removed` is `Json` after regen; test fixture; tsc red until B2 | CONFIRMED | Parse guard in route; fixture; tsc gate after A5; new TaskBar/MonthNav props optional |
| C8 | shareShape already has cut_id (shareShape.ts:7-10) | CONFIRMED | Hedge removed |
| C9 | dayjs vi + dates CSS + DatesProvider already in TrackerShell.tsx:3-4,75 | CONFIRMED | Hedge removed |
| C10 | wasDrag thresholds inconsistent | CONFIRMED (= Codex 5) | ≥4 px either axis, latched per gesture; AC1.2b |
| C11 | Missing negative ACs | ACCEPTED | AC7.11-7.13 |
| C12 | isPending semantics unverified in Next docs | ACCEPTED | B2 spike + fallback (pendingMonth cleared by remount) |
| C13 | Combobox dropdown class | SUPERSEDED by Codex 8 (consumability, not class exclusion) | — |

## Codex r1 — verdict REVISE; orchestrator verdicts
| # | Finding | Verdict | Plan change |
|---|---------|---------|-------------|
| X1 | RPC updates task before batch; reused op skips money | PARTLY CONFIRMED (real path needs a buggy client: a retry hits the version check first) — fix is cheap | Batch insert first (when moving), existing batch id → raise `adjustment_invalid`, whole tx rolls back |
| X2 | Cut draft saves on blur before discard check (TaskPanel.tsx:83-94,148-151) | CONFIRMED (no data loss: it saves) | Documented: cut field keeps blur-save; prompt covers the links draft |
| X3 | Outer Popover handles Esc in capture (PopoverDropdown.mjs:57) | CONFIRMED | `closeOnEscape={!listOpen}` |
| X4 | onMove payload lacks staff_id | CONFIRMED | `{staff_id: dropStaffId, ...applyDrag(...)}` |
| X5 | Sub-day horizontal wobble counts as click | CONFIRMED | = C10 |
| X6 | 1000-row cap on adjustment preview | REJECTED — query filtered to one (project, cut, type, staff) stage; nowhere near 1000 rows | — |
| X7 | Repeated moves duplicate removed entries | CONFIRMED | planDigest dedupes by task_id (last wins) + test |
| X8 | Wheel exclusions contradict D5 | PARTLY CONFIRMED | Popovers/dropdowns use the consumability rule; only modal dialogs excluded |
| X9 | Ownership/tsc gate conflict | CONFIRMED (= C2, C7) | as above |
| X10 | AC4.1 cut mode; AC7.5 target net | CONFIRMED | AC4 board mode only; AC7.5 target net += transferred |

## Critic round 2 (r2) — APPROVE WITH CHANGES; all six minors ACCEPTED and applied in r3
1 Esc vs New Task popover · 2 MonthNav `pendingMonth ?? month` · 3 panel exit from `lastSelected` · 4 OLD-row insert omits `cycle_id` · 5 Tooltip handler merge · 6 AC4.3 asserts `onDropdownClose`.
