# Tracker v2.8 owner decisions (2026-10-06)

Decision page: https://claude.ai/artifact/CojDaihgZoqr12F9XxVUxj

- D1: Date rule per cut (phase dependency enforced on dates, in SQL; stage order rule scoped to each phase).
- D2: Phase structure locked after creation (phases, order, dependencies, type membership, type order); type label / colour / default pay % / overlaps_prev stay editable.
- D3: "Starts after" per phase. Note: make the UI intuitive; the order and how to adjust it should be visible from how the options are arranged.
- D4: New projects start with one phase "Animation" holding LO, GE, DO, SH. Note: phase names are user data, never translated ("Animation" stays "Animation" in vi).
- D5: Existing projects: wrap all current types in one phase "Animation" (not translated, see D4).
- D6: 100% per phase. Note: the purpose of phases is to give each phase its own budget and a better overall view for project managers.
  - D6a: budget is per cut per phase; the budget input edits the phase picked in the switcher; cut total = sum of its phase budgets; existing cut budgets move into the Animation phase.
  - D6b: per-cut split overrides are per phase (each totals 100 within the phase); the split button edits the switcher's phase; presets apply to one phase's stages by position.
  - D6c: footer shows the visible phase's per-stage totals plus the phase total and the all-phase project total.
- D7: Phase square has three states: lit (every stage of the phase has a task at 100%), half-tone (some stage task exists), empty (no stage task).
- D8: Squares on the same line as the cut code. Screenshot `empty-space.png`: the cut code is right-aligned in the sticky cell (delete button hidden when the cut has tasks), so the empty space is LEFT of the code. Squares go there.
- D9: Segmented control, one tab per phase.
- D10: Other views unchanged except the order rule.
- D11: Drop the `tracker_users.role` column.
- C0 (prototype https://claude.ai/artifact/93322Zahw3poSRPjSCeieu): owner picked layout A (columns by level). Feedback: phases are draggable cards; a new phase must be selectable as a prerequisite of any phase (not only earlier ones), e.g. a new phase as Compositing's prerequisite; dragging a connector from a left phase onto a right phase sets the prerequisite. Plan O3 revised: free DAG with cycle prevention, client sends topological order.
- C0 v2 approved by the owner 2026-10-06 as the C1 reference (free prerequisites, connector drag, in-column card drag). Known quirk accepted: a card that changes column lands at the end of it. Iterate later from user feedback.
- Preflight 1b (2026-10-06): LINH_TẬP 0 cuts C36, C40 have a stale 5% split key (live keys sum 95%). Owner: keep as today (pay stays 95%); the migration skips 1b cuts (no strip) and strips stale keys only from 1a cuts (29 cuts).
