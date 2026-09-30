# Tracker v2.1 — board presence (who's here, who's editing, live cells)

Status: DONE 2026-09-30. Built, reviewed and E2E-verified locally (results in `.omc/e2e/v2.1/e2e-v2.1-results.md`); uncommitted. The migration `20260930102651_tracker_board_presence` is applied live. r2 went through consensus review (fable-critic APPROVE WITH CHANGES, Codex AGREE WITH CHANGES; verdicts in `.omc/drafts/tracker-v2.1-presence-review.md`), and the owner approved execution. Owner direction 2026-09-30: free Supabase plan, cell-level (not pixel) cursors, live cells off when alone.

## Requirements
1. **Who's here.** Show an avatar stack in the board top bar (`styles.topBar`, next to `Legend`) for every *other* presence key on the project board.
   - Group by email, one avatar per person. Your own other tabs show too.
   - The native `title` shows the name, plus the month when it differs from mine.
2. **Who's editing.** When another tab has a task in an editing state, draw that person's colour outline and name chip on the bar.
   - Editing means the task is being dragged or resized, or is open in `TaskPanel` with unsaved changes (panel dirty).
   - A task that is merely selected does not count, because `selectedId` is never cleared (`GanttBoard.tsx:79`, cleared only at L256).
3. **Live cells.** Highlight the hovered (staff row, day) cell of each other *person* in that person's colour, with a small name tag.
   - Draw it in *my* layout (my sort, filter and month).
   - If the row is filtered out, or the sender is on a different month, draw no tag. The avatar title shows their month.
   - Suspend live cells while the sender is drag-capturing (bar drag or drag-create). The editing outline covers that case, and captured pointer events report the wrong row (`useBarDrag.ts:41`, `useDragCreate.ts:30`).
   - Send hover on every staff row. Hover sending is independent of the `active`-gated `trackHandlers`.
4. **Quota guard (free plan: 2M messages/month).** Send a `cell` broadcast only when **all** of these hold, re-checked immediately before every send (clears included):
   - at least one presence entry with an email ≠ mine exists (own other tabs do not count);
   - the channel state is `joined` (never let realtime-js fall back to HTTP);
   - the tab is visible;
   - the pointer type is `mouse` or `pen`.

   Sending rules:
   - Send only on a cell change, with a 250 ms trailing throttle (≤ 4/s).
   - Send a clear (`cell: null`) only when a non-null cell was last advertised.
   - Cancel any pending trailing send on pointer leave, tab hidden, last other person leaving, disconnect, unmount, or month change.

   Presence `track` runs only on join, re-join, month change and editing change, debounced 300 ms.
5. **Security.** Only the new presence channel is **private** (`config: { private: true }`), authorized by RLS on `realtime.messages`.
   - The existing `postgres_changes` channels stay as they are. Table RLS already guards their row data.
   - Supabase treats a public and a private channel with the same topic as separate rooms ("If you have a private channel and a public channel with the same topic name, Realtime sees them as unique channels", https://supabase.com/docs/guides/realtime/concepts).
   - So a public join of `tracker-board-*` sees nothing. There is no "Allow public access" flip.

## Traffic budget
Each broadcast counts once for the send plus once per receiving tab. Sustained worst case: 2 people each moving at the 4/s cap = 2 × 4 × (1 + 1) = 16 msg/s ≈ 58k msg/hour. So 2M ≈ 34 hours of *continuous* pointer motion by 2 people per month. Real hover changes cells far less than the cap.

Each extra tab multiplies the fan-out:

| People / tabs | Worst case |
|---|---|
| 3 | 36 msg/s |
| 5 | 100 msg/s |

Presence traffic is a few messages per join, leave, month change or edit. It is negligible.

Measurement: the E2E counts sent `cell` frames over a scripted 30 s hover session (A3b) and checks them against the cap.

## Contract
- **Migration** `supabase/migrations/<ts>_tracker_board_presence.sql`, applied via MCP `apply_migration` (local file byte-identical):
  - `create policy tracker_board_read on realtime.messages for select to authenticated using ((select realtime.topic()) like 'tracker-board-%' and realtime.messages.extension in ('broadcast','presence') and (select public.is_tracker_user()))`
  - `create policy tracker_board_write on realtime.messages for insert to authenticated with check (same expression)`
  - `get_advisors` (security) stays empty.
  - Rollback: drop the two policies (harmless).
- **Presence hook** `GanttBoard/useBoardPresence.ts`.
  - Topic `tracker-board-${projectId}`, one per project (not per month).
  - Config `{ private: true, presence: { key: crypto.randomUUID() }, broadcast: { self: false } }`.
  - Join only after `await client.realtime.setAuth(session.access_token)`, following the existing getSession + setAuth pattern in `useTaskRealtime.ts`.
  - Bind `.on('presence', { event: 'sync' })` and `.on('broadcast', { event: 'cell' })` **before** `subscribe()`.
- **Serialized lifecycle (shared topic).** The board remounts on every month change (`[projectId]/page.tsx:58` key), and `client.channel(topic)` returns an existing, possibly still-leaving channel (`useTaskRealtime.ts:51`, `useRealtimeRefresh.ts:61`).
  - Keep a module-level `Map<topic, Promise<unknown>>` of pending `removeChannel` results.
  - The mount effect awaits it before `client.channel(topic)` and honours `cancelled`.
  - The unmount sets the entry and removes it when settled.
  - On SUBSCRIBED after a reconnect, re-`track` the current payload.
  - On `CHANNEL_ERROR` / `TIMED_OUT` / an unexpected `CLOSED`, tear down and recreate with the latest token after backoff (1 s, 2 s, 4 s… max 30 s). This also covers a token rotated during an in-flight join (Codex #6, plausible).
- **Presence payload** (≤ 6 keys): `{ email, name, avatar, month, editing: string|null }`, from `session.user` (`user_metadata.full_name ?? email`, `user_metadata.avatar_url ?? null`).
- **Membership state.** Rebuild React state from `channel.presenceState()` on every `sync`; never mutate on raw join/leave (a `leave` fires on metadata replacement too).
  - Remove a cell tag only when its key is absent after sync, or on its own clear.
  - No time-based expiry: a resting pointer keeps its tag.
- **Broadcast `cell` payload**: `{ key: string, month: 'YYYY-MM', cell: { staffId: string, day: number } | null }`. `day` is the 0-based index in `month`.
  - The receiver draws only if `month` equals its own month and `staffId` is among its visible rows.
- **Refs vs state (React Compiler).**
  - Rendered data is React state: the others list, tags, and each person's editing id.
  - Pointer handlers and the throttle read ref mirrors: the other-person count, channel state, timers, last advertised cell. This follows the handlersRef pattern in `useTaskRealtime.ts:22-25`.
- **Hover to cell.** Use `onPointerMove` / `onPointerLeave` on the row track div (`GanttBoard.tsx` ~L407), merged with the existing `useDragCreate` `trackHandlers`, which must not be replaced or broken.
  - Compute the day with `dayIndexFromX` from `dragMath.ts`.
  - Ignore events while `e.currentTarget.hasPointerCapture(e.pointerId)` or a bar drag is active.
- **Editing id**: dragged task id ?? (panel dirty ? `selectedId` : null). Mirror the `panelDirty` ref transition into state, or call an `onDirtyChange` hook.
- **Colour**: deterministic from an email hash over a fixed palette of 8 Mantine colours; pure helper.
- **Tests**: pure helpers plus one unit test file, `GanttBoard/__tests__/presence.test.ts`. It covers:
  - colour hash stable;
  - grouping by email, excluding own key;
  - gate: own other tabs don't enable sends, another email does;
  - throttle and dedupe: same cell not re-sent, ≤ 1 per 250 ms, clear only after a non-null cell, pending send cancelled.
- **Misc**: all strings via dictionaries (en and vi in sync); styles in CSS Modules with `pointer-events: none` on tags and outlines. Existing board behaviour (drag and create, taskSync, refresh scheduler `settle()`, task realtime) is unchanged.

## Acceptance
- **A1** Two tabs on one board: each shows the other's avatar within 3 s. Closing a tab removes it within 3 s (socket close); killing the browser process removes it within ~30 s.
- **A2** With the gate satisfied (see A-test note), B hovers a cell and A highlights the same staff/day cell within 1 s. When B leaves the grid, the tag is gone.
- **A3** With only one person present (including two tabs of the same account without the test override), zero `cell` frames are sent. Verify on WebSocket frames and on the network log (no HTTP broadcast fallback).
- **A3b** Scripted 30 s continuous hover sweep with a peer present: the number of sent `cell` frames is ≤ 4/s. Report the count.
- **A4** B drags a bar, or types unsaved changes in the panel: A outlines that bar with B's name. The outline clears on drop, save or cancel. Merely selecting a bar shows no outline.
- **A5** A and B use different filters and sort: the tag lands on the correct staff row in A's own layout. A row filtered out in A shows no tag. With B on another month there is no tag, and the avatar title shows B's month.
- **A6** Rapid month navigation (5 clicks within 2 s) and switching project and back: presence re-joins, with no duplicate avatars and no stuck channel (`client.getChannels()` shows exactly one `tracker-board-*`).
- **A7** Anon or unlisted access fails. A script uses the publishable key and `private: true` on `tracker-board-<id>` and expects `CHANNEL_ERROR`. A SQL check confirms the policies exist. Advisors are clean.
- **A8** A forced token refresh (`supabase.auth.refreshSession()` in the console) keeps presence working. So does killing the network for 10 s and restoring it.
- **A9** Existing task realtime is unaffected: an edit in B appears in A within 2 s.
- **A10** Gates: lint 0 errors, tsc 0, tests pass, build OK.

A-test note: only one Google account is on the allow-list, so the E2E cannot supply "another email". A client-only override, `localStorage['tracker.presence.selfPeer'] = '1'`, makes own other tabs count as peers for the send gate. It affects only that browser's own quota and is documented in CLAUDE.md. Unit tests cover the real gate.

## Owner steps
1. The migration is applied to the live DB during execution (before deploy). Deploying code without it only means presence fails to join: the board works, with no avatars.
2. Deploy. No dashboard settings change.

## Changelog
- 2026-09-30 r1 written, with the Architect pass.
- 2026-09-30 r2 after consensus review:
  - Private scope cut to the presence channel only (Codex #8, docs-verified); there is no "Allow public access" flip.
  - Sender key and month added to the `cell` payload (C1, C6, X1).
  - Serialized shared-topic lifecycle (C2, X2).
  - Editing is now dirty-or-dragging (C3).
  - The gate counts other people, not tabs (C4), and is re-checked before every send, with no HTTP fallback (X3).
  - Traffic budget and A3b (X4).
  - Sync-based membership, and listeners bound before subscribe (X5, C7).
  - Reconnect/backoff (X6).
  - Pointer-capture suspension (X7).
  - Refs vs state (C8), acceptance methods (C9), no tag expiry (C10).
  - Test override for the single-account E2E.
- 2026-09-30 exec: migration `20260930102651_tracker_board_presence` applied (local file md5-identical, both policies confirmed, security advisors: only the pre-existing auth `leaked_password_protection` warning); `useBoardPresence.ts` + `presence.ts` + TaskBar outline/chip + live cells + avatar stack; `useBarDrag` `onDrag`; `presence.test.ts` (8 tests); lint/tsc/test/build green. E2E pending.
- 2026-09-30 exec fix: tab hidden sends one immediate clear for an advertised cell (joined + peer only; the sole exception to the visible check), then nothing; a peer arriving (gate false→true) gets my resting hovered cell once via the throttled sender (`hoverRef` tracked while gated). Tests 10/10 in `presence.test.ts`.
- 2026-09-30 exec review fixes: send gate and hidden-clear also require `client.realtime.isConnected()` (no HTTP fallback window); pointer type gates only non-null cells (`advertisesCell`; touch clears hoverRef and sends a clear), clears pass for any pointer; hoverRef cleared on hide; `track` skipped when `editing` is unchanged (SUBSCRIBED always re-tracks); `.liveCell` width = `DAY_W` inline; `sender.cancel()` removed. Removal race (reviewer MINOR 4) accepted. Tests 11 in `presence.test.ts`; lint/tsc/test green (build not re-run: dev server busy).
- 2026-09-30 exec E2E fix: resting cell reaches a reloaded peer or a newcomer — every sync diffs the gate keys (`peerKeys`, replaces `hasPeer`) against the previous set (reset on teardown); on a new key with `hoverRef` set and `live()`, `sender.set(hover)` + `sender.resend()` (re-queues the advertised cell once through throttle + gate, bypassing dedupe; covers the false→true path too). Tests 14 in `presence.test.ts`; lint/tsc/test green (no build).
