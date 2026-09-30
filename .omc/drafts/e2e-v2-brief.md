# E2E brief — tracker v2 (final, 2026-09-30)

Plan: `.omc/plans/tracker-v2.md` (§5 acceptance criteria are the source of truth; case IDs map to them).

## Setup
- Dev server: `npm run dev` in `D:\WORK\SINO STUDIO\sino-studio` (background). Note the port → `$BASE`.
- Browser: chrome-devtools MCP attaches to the debug Chrome on 127.0.0.1:9222 (ClaudeProfile). Launch it if `list_pages` fails:
  `"C:/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:/Users/admgn/AppData/Local/Google/Chrome/ClaudeProfile" --no-first-run $BASE/en/tracker`
  The owner is signed in there as `contact@sinostudio.vn`. Never attempt Google login; never sign out the real session. Use an isolated context page (incognito) only for public share cases.
- Test data (all created by the tests, removed at the end):
  - Project **`E2E-V2`** created through the UI (case P1) — every board/cuts case runs in it, never in "Demo".
  - Cut codes `C901`–`C930` only.
  - Staff **`E2E Mail`** with email `delivered@resend.dev` (Resend test inbox) created in P3; email cases send only to that address or to `contact@sinostudio.vn`.
  - Two browser pages on the same board for realtime cases (same context = same user; that is fine for R-cases).
- Evidence: `.omc/e2e/v2/<caseId>.png` saved via `take_screenshot` with `filePath` (do not view unless the case is visual). Behavioural checks: `evaluate_script`, `list_network_requests`, SQL via `mcp__supabase__execute_sql` (SELECT only, except cleanup).
- Viewport 1600×1000 unless the case says otherwise.

## Cases (steps → expected → evidence)
### B — board (AC 2–6, 8)
- B1 Create C901 LO for Văn Phú 01/10–05/10 by dragging on the row in `?m=2026-10` → popover (cut, type, new-cut budget 2.000.000) → bar C901 · LO 5 days → SQL row + cut budget.
- B2 Click 05/10 on Minh Tuấn's row → popover C901 + GE → refused, message names "C901 · LO"; then click 06/10 → created. → screenshot of message + SQL.
- B3 Drag C901 LO right edge to 06/10 → refused, bar snaps back → SQL unchanged.
- B4 Create C902 DO + SH with no LO/GE → allowed.
- B5 Popover on another row for cut C901: LO chip disabled (also after moving to `?m=2026-11` where C901 LO isn't visible) → screenshot.
- B6 Type `c 903` in the cut box → shows `C903` new-cut hint → created; autocomplete lists C901, C902, C903 … in natural order (add C910 and check C903 < C910).
- B7 Click a bar → selects it (no popover); tap-to-create at 390×844 with touch emulation opens the popover; horizontal scroll by swipe still works → screenshots.
- B8 Staff tools: hide/show strengths; header cycle studio → A–Z → Z–A (STT renumbers); filter "Genga" shows Genga staff + all Toàn năng staff; reload keeps settings; console has no hydration warning → evaluate_script row names + console list.
- B9 Conflict: page A and page B on the board. In B start dragging C903 (pointerdown, hold via script), in A move C903 +1 day, then release in B → B shows "changed by someone else", A's dates remain → SQL.
- B10 Five quick successive drags of one bar in one page → no conflict notice; SQL = last position; `version` increased by 5.

### P — projects & staff (AC 7, 18)
- P1 Create project `E2E-V2` → types LO 30 / GE 30 / DO + SH 40, sort 10/20/30 → SQL.
- P2 Edit types: set GE to 35 → Save disabled (total 105); set DO + SH 35 → Save enabled → saved; audit list shows the % change.
- P3 Staff page: create `E2E Mail` with email `delivered@resend.dev`, strengths Genga + Sakkan; strengths manager: add `E2E-Str`, delete it.
- P4 After B1 (types used): LO row shows lock, no delete / move; insert new type `CL` between GE and DO + SH → saved with sort between.
- P5 `/en/tracker/work-types` → 404; nav shows Earnings, no Work types.

### R — realtime (AC 13)
- R1–R4 Page A edits (project rename, staff strengths, type label, cut budget, adjustment add) → page B (relevant page) updates ≤ 2 s without reload → timestamps.

### C — cuts view, pay, bulk (AC 9–11)
- C1 `/en/tracker/<E2E-V2>/cuts`: cell states — completed (set C901 LO progress 100) shows type color + check badge; in progress (C901 GE 40 %) partial fill width ≈ 40 %; empty dim "—"; C901 DO + SH none; "chờ" hint where applicable → computed-style checks + one screenshot (light/dark not applicable — tracker is dark-only).
- C2 Badges = round(budget × % / 100); change C901 budget to 3.000.000 → badges + footer totals update.
- C3 Drawer add: bonus +100.000 reason "E2E bonus" → row; empty reason → inline error; amount 0 → error.
- C4 Reverse it with reason → reversal −100.000 shown, original struck; second reverse not offered / fails.
- C5 Reassign C901 LO to another staff, then reverse an older adjustment of the previous assignee → succeeds.
- C6 Bulk: select 3 stages, rows: −200.000, −100.000, +50.000, plus helper row (E2E Mail on C901 GE) +200.000 with row reason "E2E helper"; batch reason "E2E batch" → 4 rows, one batch_id, reasons correct → SQL.
- C7 Bulk with one amount 0 → nothing inserted.
- C8 Retry safety: set DevTools network Offline right after clicking submit in BulkModal → form locks with "Thử lại"; go Online, click "Thử lại" → exactly one batch saved (SQL count by batch_id). If network emulation is not controllable, mark N/A ("covered by SQL proof S11b").
- C9 Bulk cut add C911–C915 with budget 1.000.000 → 5 cuts.
- C10 Delete an empty cut → ok; delete C901 → refused (in use).

### E — earnings (AC 12)
- E1 Project people list totals = SQL/`staffTotals` recomputation for E2E-V2 (orchestrator provides the SQL).
- E2 Studio list includes E2E-V2 and Demo; archive E2E-V2 → still counted (marked archived); unarchive.
- E3 Profiles in both scopes show the same rows for E2E-V2; month filter `?m=2026-10` vs `all`.
- E4 Reversal counted in the original's month.
- E5 Helper (E2E Mail) total includes the bulk bonus in both scopes.

### L — links (K1–K2)
- L1 Add project, cut and task links (https only; `http://` rejected); shown in the task panel; open in new tab with `rel` noreferrer.

### H — sharing (AC 14–16)
- H1 Share modal: share Văn Phú + E2E Mail → link, per-member calendar URLs.
- H2 Incognito `/vi/share/<token>` → only those 2 rows; read-only; month nav works.
- H3 Page HTML + RSC payload contain none of: budget values, "pay_pct", emails, other staff names (fetch via `evaluate_script` of `document.documentElement.outerHTML` and the RSC request bodies).
- H4 Response headers: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store`.
- H5 ICS for Văn Phú: `text/calendar`, all-day events with DTEND = end + 1; staffId not in share → 404.
- H6 PNG `?m=2026-10` → `image/png`, `Cache-Control: private, no-store`; view it once: diacritics render.
- H7 Revoke → open page 404s within 60 s; ICS + PNG 404.
- H8 `robots.txt` disallows `/en/share`, `/vi/share`.
- H9 MusicPlayer absent on the share page.
- H10 Archive E2E-V2 (Projects page) → its share page, ICS and PNG return 404; unarchive → 200 again. Revoked share cannot be un-revoked (ShareModal offers nothing; SQL update as authenticated → error).
- H3 note: dictionary label strings ("budget", "Ngân sách", "pay_pct") are expected in every page payload (layout serialises the dictionary); check for data VALUES only (budget numbers of E2E-V2 cuts, e-mail addresses, other staff names/ids).

### M — email (AC 17)
- M1 "Gửi tài liệu" on a task of E2E Mail → log row `accepted` with resend_id.
- M2 Send resources for a cut with one assignee lacking email and one archived assignee → confirm dialog lists both skip groups; result reports them; no error; only E2E Mail receives mail.
- M3 Send schedule from the share → one email per member with email.
- M4 Three task edits for E2E Mail within 1 min → one queue row, generation 3; call the worker (`POST $BASE/api/tracker/cron` with `Authorization: Bearer $CRON_SECRET`, after setting `due_at` to now via SQL) → one digest log row `assign-{cycle}-3` accepted; queue empty.
- M5 Worker without header → 401; wrong bearer → 401; GET → 405; responses contain counts only.
- M6 Reminder: task of E2E Mail ending tomorrow at 50 % → worker run → one reminder row; second run → no new send.
- M7 Forced failure: insert (SQL, service role) a `pending` email_log row whose `payload.to` is a malformed address Resend rejects (e.g. `not-an-email`) → worker run → row `failed`, attempts 1, error set; next run retries with the same idempotency key (attempts 2); delete the row afterwards.
- M8 Reassign the only changed task away from E2E Mail before the worker runs → digest dropped, no log row.
- M9 After a delivered digest, a new change → new `cycle_id`, key `assign-{new}-1`.

## Constraints
- Never touch Demo data except reading; never delete seed staff; never sign out.
- Emails only to `delivered@resend.dev` / `contact@sinostudio.vn`.
- Do not schedule the pg_cron job; call the worker route directly.
- Cleanup (SQL as service role): delete E2E-V2's adjustments, batches, tasks, cuts, shares, then the project; delete staff `E2E Mail` (after its adjustments are gone); delete strengths `E2E-Str`; leave `tracker_email_log` rows (history).

## As-built notes
- Worker call: `curl -s -X POST $BASE/api/tracker/cron -H "Authorization: Bearer <CRON_SECRET from .env>"`; never print the secret in the report.
- Reminders enqueue only when the ICT hour is 08–10. Outside that window mark M6 "time-gated" (unit-tested via reminderDue) unless the run happens in the window.
- Digests are due 10 min after the last change: set `due_at = now()` via SQL (service role) before calling the worker.
- Sends are paced ~0.55 s; a worker run can take several seconds.
- Share tokens are generated by the DB; copy them from ShareModal or SQL.
- The tracker is dark-only: no light/dark screenshot pairs.
- Rows rejected with `rejected_payload` stay `failed`.

## Return
Table: case ID · PASS/FAIL · one-line observation · evidence path. Plus unexpected behaviour seen outside the cases. No raw snapshots or logs.
