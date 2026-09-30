# E2E brief — tracker v2.1 board presence

Plan: `.omc/plans/tracker-v2.1-presence.md` (r2). Acceptance A1–A10 is the checklist.

## Setup
- Use the debug Chrome on :9222 (ClaudeProfile, already signed in). See the memory note on chrome-mcp-attach-mode. Do not launch a new profile.
- Dev server on :3300. If it is not running, start `npm run dev -- -p 3300` in the background.
- Open two tabs, A and B, on the same project board: `/vi/tracker/<projectId>`. Take the newest project with tasks.
- Only one Google account is on the allow-list. In **both** tabs, run `localStorage.setItem('tracker.presence.selfPeer','1')` and reload. Needed for A2, A4 and A5. Remove it for A3.
- Count frames by wrapping `WebSocket.prototype.send` in the tab before the action: count messages whose JSON has `"event":"broadcast"` and a `cell` payload. Also watch the network log for any `/realtime/v1/api/broadcast` HTTP POST, which is the fallback.
- Never edit code. Never write to the DB except through normal UI actions on test data. Clean up anything you create.

## Cases
- **A1** A and B each show the other's avatar within 3 s. Close B: A's avatar disappears within 3 s. Reopen B.
- **A2** Hover a cell in B: A highlights the same staff/day within 1 s (screenshot). Move out of the grid in B: the tag in A is gone.
- **A3** Remove `selfPeer` in both tabs and reload. Hover-sweep B for 10 s: 0 `cell` frames and 0 HTTP broadcast calls. Then re-enable the override.
- **A3b** With the override: a scripted 30 s sweep across cells in B (`mcp evaluate_script` dispatching pointermove events on the row tracks, e.g. every 50 ms). Report the total frames sent; it should be ≤ 120.
- **A4** Drag a bar in B, holding mid-drag if possible: A shows the outline and B's name chip. Then check after the drop. Type in the panel in B without saving: A shows the outline. Cancel or restore the field: the outline clears. Only selecting a bar: no outline.
- **A5** In A, change the sort and apply a strength filter; B stays default. Hover a staff row in B that is visible in A: the tag is on the correct row in A. Hover a row filtered out in A: no tag. Move B to the next month: no tag in A, and A's avatar title shows B's month.
- **A6** In B, click next month 5 times quickly, then back. Also switch to another project and return. Check `getChannels()` via script (the client is on `window`? if not, report counting via avatars): exactly one `tracker-board-*` per tab, no duplicate avatars in A.
- **A7** In the page console, create a client with the publishable key and no session, e.g. `supabase.createClient(url, key)` from an import if possible; otherwise note as N/A and run the SQL policy check. Join `tracker-board-<id>` with `private: true` and expect `CHANNEL_ERROR`.
- **A8** In B, run `supabase.auth.refreshSession()` if reachable, or wait. Then set the network offline for 10 s in B via emulate and restore it: presence recovers, and cells still arrive in A.
- **A9** Edit a task's progress in B: it appears in A within 2 s. Restore it.
- **F2** Hover a cell in B, then switch tabs with the keyboard (Ctrl+Tab, or `select_page` to another tab so B becomes hidden). Check that A's tag clears within 1 s and exactly one clear frame is sent.
- **F3** Close A. In B, rest the pointer on a cell with no movement. Reopen A on the same board. Check that A shows B's tag within 2 s without B moving.
- Also check the console for errors or warnings in both tabs, and the mobile width (390 px) top bar with avatars.

## Report
Return a table: case | PASS/FAIL/N/A | evidence (screenshot path under `.omc/e2e/v2.1/`, frame counts). Then list defects with repro steps. Do not fix anything.
