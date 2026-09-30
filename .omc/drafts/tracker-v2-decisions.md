# Tracker v2 — owner decisions (draft, 2026-09-30)

Source of truth for the decision page. First option of each = recommended (pre-selected).
`[multi]` = several options may be picked. Every decision has an optional free-text note.

Facts found in the code/DB that shape these questions:
- `tracker_staff` has no email column (id, name, strengths text, sort_order, archived_at). Emails and share links need one.
- `strengths` is free text, comma-separated: "LO", "Genga, Douga + Shiage", "Toàn năng" (all-rounder), "Sakkan" (not a work type).
- Tasks have a free-text `name` ("C10", "C11", default "C?"). There is no cut record, so there is nowhere to store a per-cut budget.
- Work types are one global list (LO 1, GE 2, DO + SH 3). `code` is globally unique.
- Resend already sends from `contact@web.sinostudio.vn` (contact form).
- The board has no per-day cells: each staff row is one track; clicks on empty days are not handled today.

---

## A. Delivery

A1. How do we ship v2?
1. In waves, each usable on its own: (1) data model — cuts, per-project work types, order rule, click/drag create, staff column tools; (2) realtime for all tables + edit conflicts; (3) Cuts view + pay; (4) Drive links, emails, member sharing.
2. One release with everything.

## B. Cuts (foundation for the order rule and pay)

Decided (owner, 2026-09-30): a cut becomes its own record per project (code like C12, budget, Drive links). The task name box becomes the cut box. It must stay easy for non-technical managers.

B1. How do cuts get created?
1. Type a code in the task's cut box: existing cuts autocomplete, a new code creates the cut on save. The Cuts view also has "Add cuts C1 to C40" for bulk setup. Budget can be filled in later.
2. Cuts must be created first (Cuts view, one by one or in bulk); the task form only picks from the list.

B2. Are there tasks that are not cuts (retakes, meetings, character design)?
1. Yes: they keep a free name, skip the order rule and have no pay.
2. No: every task must belong to a cut (placeholder "C?" allowed only until a cut is chosen).

B3. How are cut codes matched?
1. Normalised: trim, uppercase, no spaces, no leading zeros ("c 01" = "C1").
2. Exact text only.

## C. Pipeline order rule

C1. LO for C1 ends 9 Sep. When may GE for C1 start?
1. From 10 Sep (strictly after).
2. From 9 Sep (same day allowed).

C2. When does the rule apply?
1. On create and on every edit (drag, resize, date change, cut change, type change).
2. On create only.

C3. An edit would break the order (LO dragged past GE's start). What happens?
1. Blocked, with a message naming the conflicting task.
2. Later stages shift by the same number of days.
3. Allowed, but the cut shows a warning.

C4. GE for C5 is created, but C5 has no LO task yet.
1. Allowed: the rule only compares stages that exist.
2. Blocked until LO exists.

C5. Can one cut + stage be split across several people (two LO tasks for C1)?
1. Yes. The next stage waits for the latest end among them.
2. No: one task per cut per stage.

## D. Per-project work types

D1. Where does the default set for new projects come from?
1. A "default types" list you can edit (today's Work types page becomes this template).
2. Copy from an existing project chosen at creation.
3. Fixed in code (LO, GE, DO + SH).

D2. Once tasks use a work type, which changes are locked?
1. Delete and reorder are locked; label, color and pay % stay editable (changes are logged).
2. Everything is locked except label and color.
3. Nothing is locked; show a warning.

D3. Pay percentages across a project's work types:
1. Must add up to exactly 100%.
2. May be below 100% (the rest is not paid out as stage pay).
3. No rule.

## E. Staff column on the board

E1. Which tables get hide/sort/filter?
1. The board's staff columns only.
2. The board and the Staff page.

E2. Sorting the Staff column:
1. Click the header to cycle: studio order → A–Z → Z–A.
2. Drag rows to set a studio-wide order (saved for everyone).
3. Both.

E3. Strength values:
1. A fixed list managed on the Staff page (LO, Genga, Douga + Shiage, Sakkan, Toàn năng); staff get chips.
2. Free tags typed per staff.

E4. Filtering by "Genga": should "Toàn năng" (all-rounder) staff appear?
1. Yes, all-rounders match every strength.
2. Only when "Toàn năng" itself is picked.

E5. Where are hide/sort/filter choices remembered?
1. In this browser, per person.
2. In the URL (a link reproduces the view).

## F. Click and drag to create

F1. After clicking (1 day) or dragging (n days) on an empty part of a staff row:
1. A small popover asks for cut, work type (and budget if the cut is new), then creates the task.
2. The task is created at once as "C?" with the first work type, and the side panel opens.

## G. Realtime and edit conflicts

G1. Two managers edit the same task at once:
1. The later save is rejected if the task changed since it was opened; the person sees "Changed by someone else" and the fresh values.
2. Only the changed fields are saved, so edits to different fields both survive; same field = last save wins.
3. A "being edited by …" badge; others can only view that task until it is closed.

## H. Pay (see the Cut Pay Board prototype to tune the look)

H1. Several people on one cut + stage share the stage amount:
1. Equally.
2. By working days of each person's task.
3. The manager types each share.

H2. When does stage pay count as earned for a person?
1. When the stage task reaches 100% (before that it shows as pending).
2. As soon as the person is assigned.

H3. The budget or a % changes after work is done:
1. Amounts recalculate; the change is written to the audit log.
2. Amounts freeze when the task reaches 100%.

H4. Who can see money?
1. Everyone on the tracker (admins and managers).
2. Admins only.

H5. Removing a bonus/penalty:
1. Adds a reversing entry with its own reason; nothing is ever deleted.
2. Deletes it, but the deletion is logged.

H6. Tracking payouts (marking a month as paid):
1. Not in v2 (earnings only).
2. In v2.

## I. Staff contact

I1. Staff email address:
1. Optional field; features that email a person are disabled until it is filled.
2. Required for every active staff member.

## J. Sharing a schedule with members

J1. Which ways should members see their schedule?
1. Share link: a secret read-only URL, no login, shows the chosen members' rows, updates live, can be revoked.
2. Calendar feed: a per-member URL that Google Calendar subscribes to; each task shows as an all-day event.
3. Member login: members sign in with their @sinostudio.vn Google account and see only their own tasks.
4. Image download: a PNG snapshot of the filtered board to send by Zalo (goes stale).

J2. What does a share link show?
1. Only the chosen members' rows, for the chosen month(s).
2. The whole project, with the chosen members highlighted.
3. The chosen members' rows plus the other stages of the same cuts (who works before/after them).

J3. Does a share link show pay?
1. No.
2. Yes, each member's own amounts.

J4. How long does a share link work?
1. Until revoked.
2. 30 days, renewable.

## K. Google Drive

K1. How do Drive resources get into the tracker?
1. Paste links: one Drive folder per project and one or more links per cut; shown as buttons, copyable, included in emails. No Google setup.
2. Google Picker: browse your Drive inside the tracker and pick files (needs a Google Cloud API key and Drive consent per manager).
3. Auto-match: the tracker reads the project folder and links sub-folders named C1, C2… to cuts (needs a service account added to the folder).

K2. What do links attach to?
1. Project and cut.
2. Project, cut and each task (stage-specific files).

K3. How is the Drive organised today? (free text — e.g. "Project / C01 / LO, GE")

K4. Access: Drive sharing stays managed in Drive. The tracker only stores links.
1. Fine.
2. The tracker should also grant access (needs Drive API write scope).

## L. Emails (Resend)

L1. Which emails in v2?
1. Send resources: a cut's Drive links to the people on it (manual button).
2. Send schedule: a member's tasks for a month + their share link (manual button).
3. Assignment notice: automatic when a person is assigned a task or dates change.
4. Deadline reminder: daily, for tasks ending tomorrow below 100%.
5. Monthly pay statement per member.
6. Free-form message to chosen members.

L2. Email language:
1. Vietnamese only.
2. Choice per staff member (vi/en).

L3. Sender address:
1. tracker@web.sinostudio.vn (same verified domain as the contact form), replies to the sending manager.
2. Other (write it in the note).

L4. Keep a log of sent emails (who, to whom, what, when, delivery status)?
1. Yes.
2. No.

---

## Owner answers (2026-09-30)

A1 1 waves · B1 1 type-to-create + bulk add · B2 **2 every task belongs to a cut** · B3 1 normalised · C1 1 strictly after · C2 1 create + every edit · C3 1 block with message · C4 1 missing stages allowed · C5 **2 one task per cut per stage** · D1 **3 defaults fixed in code (LO, GE, DO + SH)** · D2 1 delete+reorder locked when used, label/color/% editable + logged · D3 1 must total 100% · E1 1 board only — note: the Strengths column must be filterable by strength type (as in the original brief) · E2 1 header cycles studio order → A–Z → Z–A · E3 1 fixed strength list managed on Staff page · E4 1 all-rounders match every filter · E5 1 per browser · F1 1 popover (cut, type, budget if new) · G1 1 reject stale save · H1 1 equal — note: in practice one person per stage; a person's pay = sum over all their stages across cuts · H2 1 earned at 100% · H3 1 recalc + audit · H4 1 all tracker users see money · H5 1 reversing entry · H6 1 no payouts in v2 · I1 1 optional email · J1 **1, 2, 4 share link + calendar feed + PNG download** · J2 1 chosen members' rows · J3 1 no pay in shares · J4 1 until revoked · K1 1 paste links · K2 **2 project + cut + task** · K3 unknown, irrelevant for pasted links · K4 1 Drive sharing stays in Drive · L1 **1, 2, 3, 4 resources, schedule, assignment notice, deadline reminder** · L2 1 Vietnamese only · L3 **other: contact@sinostudio.vn for now (will change later)** · L4 1 keep a send log
