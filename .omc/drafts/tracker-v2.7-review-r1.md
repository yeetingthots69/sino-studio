# Tracker v2.7 — review log r1

Snapshot reviewed: `.omc/plans/tracker-v2.7-members.md` r1 (2026-10-05).

## Architect pass (orchestrator)

**Antithesis (steelman against Option A).** With membership implied by link rows, "remove member" and "edit departments" are the same RPC, separated only by whether the array is empty. A client bug that sends `[]` from the edit modal (for example, a stale MultiSelect value) silently removes a member, and nothing in the schema can tell an intended removal from an accidental one. Option B's explicit member row would make removal a separate, deliberate write.

**Synthesis.** Keep Option A. Make removal explicit at the API level:
- `tracker_set_member_departments` raises `invalid` when `p_departments` is empty.
- Removal is its own action, `removeMember(projectId, staffId)`: a plain `delete from tracker_member_departments where project_id = … and staff_id = …` through `writeRow`. RLS already allows it.

This brings back Option B's safety without the second table or a deferred trigger.

**Tradeoff tension.** The project rule says "every rule trigger/RPC takes the per-project advisory lock". A direct-delete removal path takes no lock, so a removal can race a task insert, and a task can land on a member who was removed in the same instant. This is accepted: D5 already allows non-member owners, so the race cannot break an invariant. The membership trigger still takes the lock, to stay consistent with the other rule triggers.

**Findings to merge in r2**
- A1 (major) §3.4: `boardStaff` must only drive the rows. The board still needs the full staff list for name lookups (panel, MoveDialog, presence labels, the "Others" group in ShareModal, and realtime "unknown staff" detection). Contract: the page passes `staff` (all staff, as today) plus `rowStaff` and `assignable`.
- A2 (major) §3.2: per-project filter storage needs a hook. Generalise the `useBoardPrefs` store (useSyncExternalStore + memory fallback + `storage` event) to a keyed store, and add `useProjectFilter(projectId)`. Do not write a second copy of the store logic.
- A3 (minor) §3.1: the empty-array guard (above) and a new `removeMember` action. AC6 changes to match.
- A4 (minor) §3.3: Edit save is disabled when the selection is empty (UI). The guard in the RPC is the authority.
- A5 (minor) §3.4: `viewStaff` has a single caller (`GB/GanttBoard.tsx:296`), so the signature change is local. State that in the contract.

## Round 1 verdicts (orchestrator; Critic and Codex ran in parallel on the r1 snapshot, not cross-fed)

| # | Source | Sev | Finding | Verdict | Evidence / change in r2 |
|---|--------|-----|---------|---------|-------------------------|
| 1 | Critic 1 + Codex 3 | major | The copy RPC returns the integer 0, which `writeRow` reads as `not_found` | Confirmed | ACT:118 `if (!data)`. The RPC now returns jsonb `{added}`, and AC7 also tests the action |
| 2 | Critic 2 + Codex 1 | major | The grant contract does not revoke the default grants to anon/public | Confirmed | V1:66-69, V26:136-137. Grants are now revoked first, then granted explicitly; AC8 checks the effective privileges |
| 3 | Codex 2 | major | The backfill can race with live task inserts that land before the trigger exists | Confirmed | The migration locks `tracker_tasks` in share row exclusive mode before the backfill reads it (R8) |
| 4 | Codex 4 | major | `selectAll` needs an `id`, but the link table has a composite PK, and the counts query selects only `staff_id` | Confirmed | keyset.ts:14-24. Added a surrogate bigint `id` plus `unique(project, staff, dept)`; the counts query now selects `id, staff_id` |
| 5 | Codex 5 | major | Board rows computed on the server go stale when a former member's last task is deleted or moved | Confirmed | GanttBoard.tsx:229-235 refreshes only for unknown staff. `boardStaff` is now computed on the client from the synced store; AC13 extended |
| 6 | Codex 6 | major | The Cuts page has no realtime refresh for membership changes and shows a generic error for `staff_not_member` | Confirmed | cuts/page.tsx:9 `PAY_TABLES`, CutsView.tsx:100-120. Both added; AC16 extended |
| 7 | Critic 3 | minor | The plan invents a `department_in_use` key, and `staff_not_member` is missing from the `TrackerError` union | Confirmed | errors.ts:13-18, ACT:298-301. Reuses `in_use`; union updated |
| 8 | Critic 4 | minor | The earnings page title already reads "Thu nhập" | Confirmed | vi.json:771. The rename now touches only `views.people` |
| 9 | Critic 5 | minor | The archived-staff check is only in the RPC, so a direct insert bypasses it | Accepted, no change | Harmless; stated in §3.1 |
| 10 | Critic 6 | minor | The immutability trigger was never requested | Confirmed, changed | Replaced by a column-level UPDATE grant |
| 11 | Critic 7 | minor | The RLS acceptance criteria need role and JWT setup | Confirmed | Added AC8b |
| 12 | Critic 8 | info | Triggers fire in alphabetical order | Noted | R9 |
| 13 | Codex 7 | minor | AC18 contradicts D3/D5 | Confirmed | Split into AC18a and AC18b |
| 14 | Codex 8 | minor | The claim that every table has a single policy for all operations is false | Confirmed | §1 corrected |
| 15 | Architect A1–A5 | major/minor | See the Architect pass above | Applied | r2 §3.1–3.4 |

Critic verdict: APPROVE WITH CHANGES. Codex verdict: revise. Every confirmed item is merged into r2.

## Round 2 (r2 snapshot; Critic via SendMessage, Codex via SendMessage, parallel)

| # | Source | Sev | Finding | Verdict | Change in r3 |
|---|--------|-----|---------|---------|--------------|
| 1 | Critic r2-1 | minor | §3.3 still says `department_in_use` | Confirmed | Now reads `{fk: 'in_use'}` / `duplicate` |
| 2 | Codex r2 | major | `removeMember` is an unlocked DELETE that can race with a locked edit and leave a partial set of departments | Confirmed | A read-committed DELETE does not see uncommitted inserts. Removal is now the RPC `tracker_remove_member`, which takes the same advisory lock |

Critic r2: APPROVE WITH CHANGES (all r1 findings resolved). Codex r2: revise (1 major), resolved in r3. Consensus reached at r3.
