# Step 4 — Board contract (static render + panel; drag/realtime come in step 5)

Plan: `.omc/plans/tracker-v1.md` §3.1 (`[projectId]`), §3.3 (overlap query, archived semantics), §3.4 task actions, §3.5 (`GanttBoard`, `TaskBar`, `TaskPanel`, `AddTaskButton`, date rules), §5 AC6–8, AC11, AC13, AC17. Reference screenshot: `.omc/drafts/tracker-prototype.png` — match its layout.

## Files
- `src/components/tracker/dates.ts` + `src/components/tracker/__tests__/dates.test.ts` (vitest)
- `src/app/[locale]/tracker/(app)/[projectId]/page.tsx`
- `src/components/tracker/GanttBoard/GanttBoard.tsx` (+css), `TaskBar.tsx`, `TaskPanel.tsx`, `AddTaskButton.tsx`, `Legend.tsx`, `MonthNav.tsx` (same folder)
- `actions.ts`: append `createTask`, `updateTask`, `deleteTask`
- dictionaries: `tracker.board.*`

## dates.ts (pure; all dates are `YYYY-MM-DD` strings; UTC arithmetic only)
```ts
export type ISODate = string;                       // 'YYYY-MM-DD'
export function toUTC(d: ISODate): number;          // Date.UTC(y, m-1, day)
export function fromUTC(ms: number): ISODate;
export function addDays(d: ISODate, n: number): ISODate;
export function daysBetween(a: ISODate, b: ISODate): number;   // b - a, may be negative
export function monthRange(m: string): {start: ISODate; end: ISODate; days: number}; // m='YYYY-MM'
export function isValidMonth(m: unknown): m is string;         // /^\d{4}-(0[1-9]|1[0-2])$/
export function defaultMonth(now = new Date()): string;       // Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'})
export function weekdayIndex(d: ISODate): number;            // 0=Sun..6=Sat via getUTCDay
export function weekdayLabel(d: ISODate): 'T2'|'T3'|'T4'|'T5'|'T6'|'T7'|'CN';  // Mon=T2 … Sat=T7, Sun=CN
export function isWeekend(d: ISODate): boolean;
export function clampToMonth(task: {start_date: ISODate; end_date: ISODate}, m: string): {colStart: number; colEnd: number; clippedStart: boolean; clippedEnd: boolean}; // 1-based day columns inclusive
export function assignLanes<T extends {start_date: ISODate; end_date: ISODate}>(tasks: T[]): Map<T, number>; // greedy: sort by start_date then end_date; first lane whose last end < start
```
Tests: `monthRange('2026-09')` → 30 days, start `2026-09-01`; `weekdayLabel('2026-09-01')==='T3'`, `'2026-09-06'==='CN'`; `addDays('2026-09-30',1)==='2026-10-01'`; `clampToMonth({start:'2026-09-28',end:'2026-10-03'},'2026-09')` → `{colStart:28,colEnd:30,clippedStart:false,clippedEnd:true}`; `assignLanes` with 3 overlapping → lanes 0,1,0 for `[1–4],[3–6],[5–8]`; `isValidMonth('abc')===false`; `defaultMonth(new Date('2026-10-01T00:30:00Z'))==='2026-10'` (07:30 Vietnam).

## page.tsx (server)
- `params.projectId` → `z.uuid()` fail → `notFound()`. Load project `.eq('id').is('archived_at',null).maybeSingle()` → null → `notFound()`.
- `m = isValidMonth(searchParams.m) ? searchParams.m : defaultMonth()`.
- Loads: work types (non-archived, sorted) + ALL work types (for color lookup); staff (`archived_at is null`, ordered `sort_order,name`); tasks for project overlapping month: `.eq('project_id').lte('start_date', end).gte('end_date', start)`; plus archived staff that own any of those tasks (append after active, marked `archived`).
- Renders `<GanttBoard project month staff workTypes tasks locale/>`.

## GanttBoard ('use client')
- Props typed from `Tables<'tracker_tasks'>` etc (`@/types/database.types`).
- Local state: `selectedId`, `useOptimistic(tasks, reducer)` where reducer handles `{type:'update', id, patch}`, `{type:'create', task}`, `{type:'delete', id}`. Commits: `startTransition(async () => { addOptimistic(a); const r = await action(...); if (!r.ok) setError(r.error) })`.
- Layout (CSS grid, `grid-template-columns: 48px 160px 220px repeat(days, 40px)`; horizontal scroll container; first 3 columns `position: sticky; left` stacked offsets; header row sticky top):
  - Top bar: `MonthNav` (‹ `Tháng 9/2026` ›; pushes `?m=` via `router.push`, keeps path) + `Legend` (one dot per work type + red "Hoàn thành").
  - Header cells: weekday label over day number; weekend columns and header tinted `rgba(232,25,44,.08)`.
  - Staff row: STT, name (+ `AddTaskButton` "+" ghost icon at row end of name cell, `aria-label` "Thêm công việc cho {name}"), strengths (muted). Row height = `max(1, lanes) * 40px + 8px`.
  - Task bars rendered inside a per-row relative container spanning the day columns: `left = (colStart-1)*40px`, `width = (colEnd-colStart+1)*40px - 4px`, `top = lane*40px + 4px`.
- Right side: `TaskPanel` fixed-width 320px column (page is a 2-column flex: board grows, panel fixed; on `< 1024px` panel stacks below).
- `dragging`/`panelDirty` refs exist but drag handlers are step 5 — leave `TaskBar` static now with `onClick` select.

## TaskBar
- `background: color + '33'` fill with a progress overlay `width: progress%` at `color + 'aa'`; border 1px `color`; when `progress===100` use `#ef4444` for all three. Label: `<b>{name}</b> {code}` (or "Hoàn thành" when 100). Left grip icon `⋮⋮` (decorative). `aria-label` `${name} – ${label}, ngày ${startDay} đến ${endDay}`. Clipped edges: no border-radius on that side.

## TaskPanel
- Per §3.5 (r4): `key={task.id}`; discrete controls commit on change (`SegmentedControl`/chip group for type, `Select` staff [active only + current if archived], `DateInput` ×2 with `valueFormat="DD/MM/YYYY"` and string values, `Slider` `onChangeEnd`), name `TextInput` local draft commit on blur/Enter; `panelDirty.current` while dirty; delete button `Xoá công việc` (confirm via Mantine `Modal` yes/no); summary line `{staff} · Tháng {M}/{YYYY} · ngày {s} – {e} ({n} ngày)`; empty state text. Date validation: end < start → set end = start.
- Header text "CHI TIẾT CÔNG VIỆC".

## AddTaskButton
- Calls `createTask({project_id, staff_id, work_type_id: firstActiveType.id, name: 'C?', start_date: monthStart, end_date: monthStart, progress: 0})`; on `ok` → select returned id.

## Actions (append to actions.ts)
```ts
createTask(input: {project_id; staff_id; work_type_id; name; start_date; end_date; progress?}): ActionResult<Task>
updateTask(input: {id} & Partial<Pick<Task,'name'|'staff_id'|'work_type_id'|'start_date'|'end_date'|'progress'>>): ActionResult<Task>
deleteTask(input: {id}): ActionResult<{id: string}>
```
Zod: uuid ids, `name` trim 1–80, dates `^\d{4}-\d{2}-\d{2}$`, `progress` int 0–100, refine `end_date >= start_date`. `.select().single()`; `revalidatePath('/[locale]/tracker','layout')`.

## Dictionary keys (`tracker.board.*`, vi verbatim from prototype)
`kicker` "Lịch sản xuất", `title` "Lịch phân công Animator", `hint` "Kéo thanh công việc để dời ngày, kéo hai mép để đổi độ dài, chọn một ô để đổi loại việc và tiến độ.", `prevMonth` "Tháng trước", `nextMonth` "Tháng sau", `month` "Tháng {m}/{y}", `stt` "STT", `staff` "NHÂN SỰ", `strengths` "ĐIỂM MẠNH", `done` "Hoàn thành", `addTask` "Thêm công việc cho {name}", `panel.title` "CHI TIẾT CÔNG VIỆC", `panel.name` "Tên cắt / công việc", `panel.type` "Loại công việc", `panel.progress` "Tiến độ", `panel.start` "Ngày bắt đầu", `panel.end` "Ngày kết thúc", `panel.assignee` "Nhân sự phụ trách", `panel.delete` "Xoá công việc", `panel.confirmDelete`, `panel.empty`, `panel.days` "{n} ngày", `panel.summary` "ngày {s} – {e}". English equivalents in `en.json`.

## Acceptance (reviewer + later E2E)
- `npm test` includes dates tests green; tsc/lint/build clean.
- `/en/tracker/<demo id>?m=2026-09` renders 13 rows, `T3` over day 1, `CN` over 6/13/20/27 tinted; legend 3 types + Hoàn thành.
- `?m=abc` → default month; `/en/tracker/abc` → 404.
- Creating via "+" adds a bar and selects it; panel edits persist after reload; delete removes.
- Two overlapping tasks on one staff → 2 lanes.
