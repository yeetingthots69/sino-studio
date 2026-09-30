# Tracker v2.1 — board presence (who's here, who's editing, live cells)

Status: owner direction 2026-09-30 (chat): free Supabase plan, cell-level (not pixel) cursors, cursors auto-off when alone. Execution via /orchestrate-with-subagents.

## Requirements
1. **Who's here** — avatar stack in the board top bar (`styles.topBar`, next to `Legend`) for every *other* browser tab on the same project board. Grouped by email (one avatar per person even with 2 tabs; own other tabs do show). `title` shows name + month when it differs from mine.
2. **Who's editing** — a task bar that another tab is dragging/resizing or has open in `TaskPanel` gets that person's colour outline + name chip.
3. **Live cells** — the hovered (staff row, day) cell of each other tab is highlighted in that person's colour with a small name tag, drawn in *my* layout (my sort/filter/month). Rows filtered out or a different month → no tag (the avatar title shows their month).
4. **Quota guard (free plan)** — cell broadcasts are sent ONLY while ≥1 other presence key is on the channel; only on cell change; trailing throttle 250 ms (≤ 4/s); only `pointerType === 'mouse' | 'pen'`; one `null` on pointer leave / tab hidden; nothing while hidden. Presence `track` only on join, month change, editing change (debounced 300 ms).
5. **Security** — all tracker realtime channels become **private** (`config: { private: true }`), authorized by RLS on `realtime.messages`. Owner switches off "Allow public access" in Realtime Settings **after deploy** (flipping earlier breaks the currently deployed public channels).

## Contract
- Migration `supabase/migrations/<ts>_tracker_realtime_private.sql` (apply via MCP `apply_migration`, local file byte-identical):
  - `create policy tracker_realtime_read on realtime.messages for select to authenticated using ((select realtime.topic()) like 'tracker-%' and (select public.is_tracker_user()))`
  - `create policy tracker_realtime_write on realtime.messages for insert to authenticated with check (same expression and realtime.messages.extension in ('broadcast','presence'))`
  - `get_advisors` (security) stays empty.
- Every tracker channel (`useTaskRealtime`, `useRealtimeRefresh` / `RealtimeRefresh`, new presence channel) is created with `{ config: { private: true } }` and joins only after `await client.realtime.setAuth(session.access_token)`. Topics must start with `tracker-`. Reuse the existing getSession + setAuth pattern (extract one small shared helper if two+ call sites need it; no new abstraction beyond that).
- Presence channel topic `tracker-board-${projectId}` (not per month — one board room). Presence payload (≤ 6 keys): `{ email, name, avatar, month, editing: string|null }` from `session.user` (`user_metadata.full_name ?? email`, `user_metadata.avatar_url ?? null`) — no extra fetch, no prop threading.
- Broadcast event `cell`: `{ staffId: string, day: number } | null` (day = 0-based index in the sender's month; receiver draws it only if the sender's presence `month` equals its own). Receiver keys tags by presence key (`self: false`), drops a tag on its `null`, on presence leave, and after 20 s without update.
- Hover → cell: `onPointerMove` / `onPointerLeave` on the row track div in `GanttBoard.tsx` (~L407), merged with the existing `useDragCreate` `trackHandlers` (never replace them); `dayIndexFromX` from `dragMath.ts`.
- Editing id = task being dragged (from `useBarDrag` start/end) ?? `selectedId`.
- Colour: deterministic from email hash over a fixed palette of 8 Mantine colours; pure helper.
- Pure helpers + one unit test file (`GanttBoard/__tests__/presence.test.ts`): colour hash stable, grouping by email excluding own key, cell throttle/dedupe (same cell not re-sent, ≤ 1 per 250 ms, gated on others > 0).
- All strings via dictionaries (en + vi in sync). Existing board behaviour (drag/create, taskSync, realtime refresh) unchanged.

## Acceptance
- A1 Two tabs on one board: each shows the other's avatar within 3 s; closing a tab removes it within ~30 s.
- A2 Tab B hovers a cell: tab A highlights the same staff/day cell ≤ 1 s; B leaves the grid → tag gone.
- A3 Only one tab open: zero `cell` broadcasts sent (verify via websocket frames / a counter).
- A4 Tab B opens a task panel or drags a bar: tab A outlines that bar with B's name; clears when done.
- A5 Different filters/sort in A and B: tag lands on the correct staff row in A's own layout; a row filtered out in A shows no tag; B on another month → no tag, avatar title shows B's month.
- A6 Existing realtime still works on private channels (task edit in B appears in A ≤ 2 s; project/staff refresh).
- A7 SQL: signed-out/anon cannot join `tracker-board-*` privately; advisors clean.
- A9 Forced token refresh (`supabase.auth.refreshSession()` in the console) keeps all private channels joined; the task realtime and presence still work afterwards.
- A8 Gates: lint 0 errors, tsc 0, tests pass, build OK.

## Architect pass (orchestrator, r1)
- Own presence key must be known client-side: set `config.presence.key = crypto.randomUUID()` per channel instance; "others" = every key ≠ mine. Re-`track` the current payload after every re-SUBSCRIBED (reconnect drops presence).
- A pending trailing `cell` send is cancelled by leave/hidden, so a stale cell can never arrive after the `null`.
- Private channels are disconnected at JWT expiry unless a fresh token reaches Realtime. supabase-js re-sends it on `TOKEN_REFRESHED` for the same client; verify rather than assume (A9).
- Tradeoff: moving the existing postgres_changes channels to private adds an RLS check at every join (cheap: `is_tracker_user()` is one indexed lookup) and couples table realtime to the new policy. The alternative is to keep them public (table RLS already guards row data) and make only the presence channel private. That is rejected because, per the Supabase docs, private channels are only enforced once "Allow public access" is off, and turning it off requires every channel to be private.
- Steelman against live cells at all: avatars plus editing outlines already give most of the conflict avoidance at almost zero quota. Live cells are kept because the owner asked for them. They cost nothing when alone and stay small on the free plan, since meetings on the board are occasional.

## Owner steps (after deploy)
- Supabase Dashboard → Realtime → Settings → turn **off** "Allow public access".

## Changelog
- 2026-09-30 r1 written.
