# E2E brief — tracker v1

## Setup
- Dev server: `npm run dev` from `D:\WORK\SINO STUDIO\sino-studio` (background). Note the port it prints (3000 may be occupied → 3001). Call it `$BASE`.
- Browser: the chrome-devtools MCP is attached to the user's Chrome. **The user has already signed in** to `$BASE/en/tracker` with `contact@sinostudio.vn` (Google) in that Chrome — reuse that session; never attempt Google login yourself; never sign out except in case A3 (which is done in a fresh isolated context page, not the signed-in one).
- Demo project id: query via `mcp__supabase__execute_sql`: `select id from tracker_projects where name='Demo'`.
- Seed month for cases: `?m=2026-09`. Create test tasks named `E2E-*` only; delete them at the end (SQL `delete from tracker_tasks where name like 'E2E-%'`).
- Evidence dir: `.omc/e2e/` (screenshots `caseId.png`, 1600×1000 viewport). Board prototype for visual comparison: `.omc/drafts/tracker-prototype.png`.

## Cases
| ID | Steps | Expected | Evidence |
|---|---|---|---|
| A1 | New isolated-context page → `$BASE/en/tracker` | 307 → `/en/tracker/login?next=%2Fen%2Ftracker`; login page shows Google button | screenshot + `list_network_requests` status |
| A2 | Isolated page → `$BASE/en/tracker/login?error=domain` | localized domain error text visible | screenshot |
| A3 | Isolated page → `$BASE/auth/callback?next=//evil.com` (no code) | redirect stays on `$BASE` (login with `error=auth`), never off-site | network log |
| A4 | Signed-in page → `$BASE/en/about` | 200; public page unaffected; Navbar/MusicPlayer present | screenshot |
| A5 | `$BASE/en/tracker/abc` and `$BASE/en/tracker/<random uuid>` | 404 page, not 500 | screenshots |
| A6 | `$BASE/robots.txt` | contains `Disallow: /en/tracker` and `/vi/tracker` | body text |
| B1 | `$BASE/en/tracker/<demo>?m=2026-09` | 13 staff rows in seed order; day 1 header `T3`; days 6/13/20/27 `CN` tinted; legend LO/GE/DO + SH + Hoàn thành; header shows avatar/name/sign-out; no MusicPlayer | screenshot (compare with prototype: same 3 sticky columns, headers, weekend tint, bar palette) |
| B2 | `?m=abc` | renders current month (Vietnam time) | screenshot + title |
| B3 | Click "+" on row 2 (Văn Phú) | new 1-day bar day 1, panel opens with it | screenshot |
| B4 | In panel: name `E2E-1`, type GE, start 5, end 8, progress 40; reload page | bar shows `E2E-1 GE` days 5–8 with 40% fill after reload | screenshot + SQL row |
| B5 | Drag `E2E-1` body +3 days; reload | stored `start_date=2026-09-08,end_date=2026-09-11` | SQL |
| B6 | Drag right edge −1 day; reload | end `2026-09-10`; left edge −10 → start clamps ≤ end, never < end | SQL |
| B7 | Set progress 100 | bar red, label Hoàn thành | screenshot |
| B8 | Create `E2E-2` on same row days 9–12 (overlaps E2E-1) | two lanes, both clickable | screenshot |
| B9 | Create `E2E-3` days 28–30 then set end via panel to `2026-10-03`; view September | bar clipped at 30, right edge has no resize handle; drag body +2 → SQL `09-30 → 10-05` | screenshot + SQL |
| B10 | Language toggle on `/vi/tracker/<demo>?m=2026-08` | URL becomes `/en/…?m=2026-08`; labels switch | screenshot |
| C1 | Open a second page (same context) on the same board. In page 1 move `E2E-2` +1 day; in page 2 wait ≤ 2 s | page 2 shows the move without reload; then delete `E2E-2` in page 1 → disappears in page 2 ≤ 2 s | timestamps + screenshots |
| C2 | Page 1: focus name input of `E2E-1`, type `abcdefghij` slowly over 3 s while page 2 changes `E2E-3`'s progress | page 1 field keeps all 10 chars; blur → saved | screenshot + SQL |
| D1 | `/en/tracker/projects`: create `E2E-P`, rename, archive; switcher no longer lists it; unarchive | rows update; SQL `archived_at` toggles | screenshots |
| D2 | `/en/tracker/staff`: create `E2E-S` order 99, edit strengths, archive | row hidden until "Archived" toggle | screenshot |
| D3 | `/en/tracker/work-types`: create code `E2E`, then create `E2E` again | second shows duplicate error | screenshot |
| D4 | Resize viewport 375×800 on board | header does not overflow; sign-out reachable | screenshot |

## Constraints
- Never touch rows not named `E2E-*`; never delete seed staff/work types/Demo project.
- Never sign out the user's real session. Isolated-context pages only for A1–A3.
- No production URL; dev server only.
- Cleanup at end: delete `E2E-*` tasks, archive-then-delete `E2E-P` project, `E2E-S` staff, `E2E` work type via SQL.

## Return format
Table: case ID · PASS/FAIL · one-line observation · evidence path. Then "Unexpected" list. No raw snapshots/logs.
