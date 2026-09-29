# Step 5 — Drag/resize + Realtime contract

Plan §3.5 (`GanttBoard` realtime + refresh scheduler, `TaskBar` drag), §6 risks, AC7, AC9, AC10. Builds on step 4's `GanttBoard`/`TaskBar`/`dates.ts`.

## Files
- `src/components/tracker/GanttBoard/useRefreshScheduler.ts` (new)
- `src/components/tracker/GanttBoard/useTaskRealtime.ts` (new)
- `src/components/tracker/GanttBoard/useBarDrag.ts` (new) + `dragMath.ts` (pure) + `__tests__/dragMath.test.ts`
- modify `GanttBoard.tsx`, `TaskBar.tsx`
- `src/utils/supabase/client.ts`: add `export const browserClient = /* lazily created singleton */` (getter `getBrowserClient()`; create once per module).

## Refresh scheduler (`useRefreshScheduler`)
```ts
export function useRefreshScheduler(): {
  dragging: MutableRefObject<boolean>;
  panelDirty: MutableRefObject<boolean>;
  requestRefresh(): void;   // starts/restarts a 300 ms timer
  settle(): void;           // call after pointer-up and after every commit transition resolves
}
```
- Timer callback: if `dragging.current || panelDirty.current` → `pending = true`, return; else `router.refresh()`.
- `settle()`: if `pending` and not busy → `pending = false; router.refresh()`.
- Cleanup timer on unmount.

## Realtime (`useTaskRealtime(projectId, requestRefresh)`)
- `getBrowserClient().channel(`tracker-tasks`)` `.on('postgres_changes', {event:'*', schema:'public', table:'tracker_tasks'}, () => requestRefresh())` — NO `filter` (DELETE not filterable).
- `.subscribe((status) => { if (status === 'SUBSCRIBED' && wasDisconnected) requestRefresh(); })` — track a `hadFirstSubscribe` ref so the very first subscribe does not refresh; any later `SUBSCRIBED` (reconnect) does.
- `useEffect` cleanup: `client.removeChannel(channel)`.

## Drag math (`dragMath.ts`, pure, tested)
```ts
export type DragMode = 'move' | 'resize-start' | 'resize-end';
export interface DragBaseline {start_date: ISODate; end_date: ISODate}   // captured at pointerdown from the STORED task, not the clamped display
export function applyDrag(base: DragBaseline, mode: DragMode, deltaDays: number): DragBaseline;
// move: both += delta. resize-start: start = min(start+delta, end). resize-end: end = max(end+delta, start). Min duration 1 day (start<=end).
export function deltaFromPointer(startX: number, currentX: number, dayWidth: number): number; // Math.round((currentX-startX)/dayWidth)
```
Tests: move +2 on 09-28..10-03 → 09-30..10-05; resize-end −10 on 09-05..09-08 → end clamps to 09-05; resize-start +10 → start clamps to end; delta rounding at ±0.5 day.

## `useBarDrag` (in TaskBar)
- `onPointerDown` on body → mode `move`; on left/right handle (8 px zones) → resize; handles are NOT rendered on an edge where `clippedStart`/`clippedEnd` is true.
- `setPointerCapture`; `dragging.current = true`; capture baseline from `task` props at that moment; `preview` state = `applyDrag(baseline, mode, delta)` on `pointermove` (bar re-renders from preview via `clampToMonth(preview, month)`).
- `pointerup`: if delta ≠ 0 → commit via the board's `startTransition(async () => { addOptimistic({type:'update', id, patch: preview}); const r = await updateTask({id, ...preview}); if (!r.ok) setError(r.error) })`, then `settle()`; clear preview; `dragging.current = false`.
- `pointercancel` / `lostpointercapture` before `pointerup` → discard preview, no commit, `dragging.current=false`, `settle()`.
- Click without movement (delta 0, < 4 px travel) → select only.
- Cursor: `grab`/`grabbing` on body, `ew-resize` on handles. `touch-action: none` on the bar.

## GanttBoard wiring
- Instantiate scheduler + realtime; pass `dragging`, `settle`, `commit` down to `TaskBar`; `TaskPanel` sets `panelDirty` while the name draft is dirty and calls `settle()` after each commit resolves.
- All existing commit paths (panel, add, delete) call `settle()` after their transition resolves.

## Acceptance (E2E later)
- AC9: two tabs; move/resize/delete in A → B updates ≤ 2 s.
- AC10: task 09-28..10-03 in September: right edge has no handle; drag +2 → stored 09-30..10-05 (verify via `execute_sql`).
- AC7 addendum: typing in name for 3 s while B edits another task → no lost characters.
- `npm test` includes dragMath tests; tsc/lint/build clean.
