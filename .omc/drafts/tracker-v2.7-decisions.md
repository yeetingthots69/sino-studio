# Tracker v2.7 — owner decisions (2026-10-05)

Decision page: https://claude.ai/artifact/VnMib6viVKgs6cD9EZFHje

- D1: A staff member can belong to one or more departments within a project.
- D2: Departments are a free list per project (name + colour), not tied to work types.
- D3: Board shows members only, plus non-members who still own a task in the loaded month (greyed, not drop targets).
- D4: DB enforces membership for new writes (create task, reassign/move, staff change); existing tasks stay valid.
- D5: Removing a member who owns tasks is allowed; tasks stay.
- D6: Migration backfill: per project, a department "Chung" with every staff who owns any task there.
- D7: New in-project tab "Thành viên" (departments + member table, multi-add, edit, remove). Owner note: rename the "Nhân sự" (earnings) tab to something clearer, e.g. "Thu nhập"; same for English.
- D8: No row grouping on the board; department tags beside the staff name.
- D9: Filters combine name AND department AND strength (any-of inside department/strength); department + strength filters saved per project; name search not saved; name match ignores diacritics.
- D10: Task pickers members only; share modal lists members first, others below; bonus/penalty pickers open to anyone.
- D11: A department can be deleted only when it has no members.
- D12: Admins and managers have the same rights.
- D13: New projects start with no members; a "Copy members from project…" action exists.
- D14: Share page / PNG unchanged.

## Added scope (owner, 2026-10-05)

- S1: New in-project view, layout like the Cut page: filters staff, work type (default all), cut (default all); result table below with columns cut code, work type, staff name, date range (start – deadline), progress.

## Owner process rule

- All plan/report output in English; Vietnamese only in code and the vi dictionary.
- S2 (2026-10-05, mid-execution): the board title "Lịch phân công Animator" / "Animator assignments" (`tracker.board.title`) shows the project's name instead.
