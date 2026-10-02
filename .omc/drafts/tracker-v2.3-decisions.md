# Tracker v2.3 (board UX) — owner decisions

Recorded 2026-10-02 from the decision page (https://claude.ai/artifact/QKF9NrrQdDN3b6N8kaQFVd). The owner asked to call this round **v2.3** ("v2.2" already names the per-cut pay split + presets work).

| ID | Topic | Answer |
|----|-------|--------|
| D1 | Clicking the selected task again | A — the panel collapses; the board takes the full width until a task is selected. Esc also closes. A drag/resize on the selected bar never counts as a click. |
| D1b | Unsaved panel edits on close | A — inline "Discard changes?" prompt (Discard / Keep editing). |
| D2 | Jump to a month | A — clicking the month label opens a popover: focused text field (accepts `10/2026`, `10 2026`, `2026-10`, `10/26`; Enter jumps) + month grid with year arrows + "This month". Arrows stay. |
| D3 | Loading on month change | A — header switches to the new month at once, staff names stay, the bar area shows shimmering skeleton bars until data arrives. |
| D4 | Cut field in New Task | A — Cut field keeps focus on open, but its list opens only on typing, click on the field, or ArrowDown. List capped at about 5 rows. |
| D5 | Wheel outside the grid | A — any wheel input on the board page that nothing else can consume scrolls the grid (desktop + tablet). Panel, popovers and dropdowns still scroll themselves when they can. |
| D6 | Same cut on one row | A — compact: inside a staff group each cut keeps one row (stages left to right in work-type order); different cuts share a row when they don't overlap. |
| D7a | Bonus/penalty on cross-person move | C — ask only when the stage has non-zero adjustments for the old person: "Move with task" / "Keep with old person". Needs a migration (atomic RPC). |
| D7b | Confirm cross-person moves | B — confirm dialog on every cross-person drop. |
| D7c | Tell the previous person | B — yes, a "removed" line in the previous person's digest. Needs a migration + template work. |
| D8 | 1-day tasks | A + B — compact two-line bar for bars under 2 days (no grip, handles on hover) and a hover card on every bar. |

Browser repro evidence: `.omc/e2e/v2.2-repro/` (A-1440x900.png, A-900x800.png, B-1-open.png, B-2-stillomatic-open.png).
