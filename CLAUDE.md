# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio website for **Sino Studio**, a Vietnamese 2D animation studio (live at sinostudio.vn, hosted on Vercel). Built with Next.js 16 (App Router), React 19.2, Mantine UI v9, and Framer Motion. Dark-themed, bilingual (en/vi). React Compiler is enabled (`reactCompiler: true` in next.config.ts).

An internal production tracker lives under `/tracker` (Supabase backend, access limited to allow-listed studio accounts) — see [Tracker (internal)](#tracker-internal).

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, core-web-vitals + typescript presets)
- `npx.cmd tsc --noEmit` — type-check (Windows)
- `npm test` — Vitest (`vitest run`, config in `vitest.config.ts`; tests live in `__tests__/` folders next to the code)

## Architecture

**Routing** — All pages live under `src/app/[locale]/` (`en` | `vi`, default `en`):
- `/` — landing page (hero, ticker, who-we-are, clients, projects, brand-service sections)
- `/about`, `/services`, `/brand-equity`, `/contact-us` — static content pages
- `/projects` — project grid
- `/projects/[id]` — project detail pages, statically generated from `PROJECTS` via `generateStaticParams`; `dynamicParams = false`

`src/app/page.tsx` redirects `/` to the locale from the `NEXT_LOCALE` cookie. `src/app/sitemap.ts` and `robots.ts` generate SEO files; new public routes must be added to `staticRoutes` in the sitemap.

**i18n** — Config in `src/i18n/config.ts` (`LOCALES`, `DEFAULT_LOCALE`, `isValidLocale`). UI strings live in `src/i18n/dictionaries/{en,vi}.json`; keep both files in sync (the `Dictionary` type is inferred from `vi.json`). Server components call `getDictionary(locale)` (server-only); client components use `useDictionary()` / `useLocale()` from `src/i18n/DictionaryProvider.tsx`. `LanguageSwitcher` swaps the path prefix and sets the `NEXT_LOCALE` cookie. Project copy in `project-data.ts` is Vietnamese-only and not in the dictionaries.

**Data layer** — The public site has no database (Supabase is used only by the tracker, see below). All project data lives in `src/data/project-data.ts` as a `Record<string, ProjectMetaData>` export (`PROJECTS`); keep it in code for fast builds. Other static data: `src/data/playlist.ts` (music player), `src/data/ip-data.ts` (brand-equity characters). Adding a project means adding an entry to `PROJECTS` and placing assets in `public/images/projects/<id>/` and `public/videos/projects/<id>/`.

**Contact form** — `src/services/mailServices.ts` is a server action that sends mail via Resend (`RESEND_API_KEY` in `.env`), rendered with `src/data/EmailTemplate.tsx`.

**Project detail pages** — Driven by a composable section system. Each project declares an ordered `sections` array (e.g. `['color-script', 'characters', 'background', 'credits']`). `ProjectShowcasePage` maps these to section components via a switch. Section types: `color-script`, `characters`, `background`, `credits`, `snippets`, `fanart`, `video`. Project types: `animation`, `mv`, `series`, `tvc`. MV projects can use `youtubeId`, `lyrics`, or time-synced `syncedLyrics`.

**Asset naming conventions** — Section components expect numbered files:
- Hero: `images/projects/<id>/hero.webp`, optional `videos/projects/<id>/hero.webm`
- Characters: `characters-1.webp`, ... (count = `characters.length`)
- Color scripts: `color-script-1.webp`, ... (count via `colorScriptCount`, default 12)
- Backgrounds: `images/projects/<id>/background-N.webp` or `videos/projects/<id>/background-N.webm` (driven by `backgrounds` array with `{type: 'image'|'video'}`)
- Snippets: `snippets-1.webp`, ... (count via `snippetsCount`, default 12)
- Fanart: `fanart-1.webp`, ... (count via `fanartCount`, default 12; `fanartDimensions` for the photo album)

**Styling** — CSS Modules (`.module.css` co-located with components); no Tailwind. Global CSS variables in `globals.css` (`--color-red`, `--color-black`, `--color-dark`, `--color-white`). Mantine theme (in `src/app/[locale]/layout.tsx`): red primary color, `defaultRadius: 0`, Montserrat headings via `--font-heading` from `next/font`, Inter body. Mobile-first breakpoints at 768px (tablet) and 1024px (desktop).

**Global components** — `MusicPlayer` (audio player) and `ProgressBar` (route transition indicator via `@mantine/nprogress`) are rendered in the locale layout, outside page content. `Navbar` and `Footer` are included per-page, not in the layout.

**SEO** — `src/lib/seo.ts` (site URL, OG images) and `src/lib/json-ld.ts` (structured data). Each page exports `generateMetadata` with canonical + `en`/`vi` alternates.

**Path alias** — `@/*` maps to `./src/*`.

## Key Conventions

- Components are organized by feature/page under `src/components/` (e.g. `landing/`, `project-details/`, `about/`, `services/`, `brand-equity/`, `contact/`), one component per folder with its `.module.css`
- Client components use `'use client'`; page-level components are server components by default
- Use `next/image` for images and `next/link` for internal links
- All user-facing strings go through the dictionaries, never hardcoded in components
- YouTube IFrame API is loaded globally via `<Script>` in the locale layout; video playback uses the YouTube IFrame Player API with types in `src/types/youtube.d.ts`

## Tracker (internal)

Gantt-style production tracker for managers (v2: cuts, pay, earnings, sharing, email; v2.7: project members + departments; v2.8: project phases + per-phase budgets). Not linked from the public site, `noindex`, disallowed in `robots.ts`, not in the sitemap (the public share page is token-gated).

**Routes**
- `/[locale]/tracker` — redirects to the newest non-archived project, else to `projects`
- `/[locale]/tracker/login` — Google sign-in (`?error=domain` / `?error=auth` show a message)
- `/[locale]/tracker/(app)/[projectId]` — board with tabs Lịch (Gantt) | Cut | Công việc | Thành viên | Thu nhập; `[projectId]/cuts` (cuts grid, pay, bulk), `[projectId]/tasks` (read-only task list, staff / work type / cut filters), `[projectId]/members` (departments + members), `[projectId]/people` + `/people/[staffId]` (Thu nhập, was "Nhân sự": project-scope earnings / profile)
- `/[locale]/tracker/(app)/people` + `/people/[staffId]` — studio-scope earnings / profile (archived projects included)
- `/[locale]/tracker/(app)/projects`, `staff` — CRUD tables (archive instead of delete). The work-types page is gone: types are per project, edited in the project modal (`WorkTypesEditor`); defaults in `src/components/tracker/defaults.ts`. v2.8: the project modal holds `PhasesEditor` (create mode: a "columns by level" editor, phase cards in columns by dependency level, drag connectors for prerequisites; edit mode: phases/stages/order locked, only label, colour, pay % and overlaps editable). The Cut page shows phase squares (per cut) and a phase switcher (hidden for one phase); the active phase is kept in localStorage `tracker.cuts.phase.<projectId>`
- Public (no login): `/[locale]/share/[token]` (read-only `ScheduleGrid`, 60 s refresh), `/api/tracker/ics/[token]/[staffId]`, `/api/tracker/share/[token]/png`; worker `POST /api/tracker/cron` (Bearer `CRON_SECRET`)
- `/auth/callback` — OAuth code exchange (outside `[locale]`); only a `next` matching `/(en|vi)/tracker...` is honoured

The `(app)` layout renders `TrackerShell` (header, project switcher, nav) and shows `NotAuthorized` when the signed-in user is not on the allow-list. Server actions live in `src/app/[locale]/tracker/actions.ts` (Zod-validated, return `ActionResult`); components in `src/components/tracker/`.

**Auth** — Google OAuth via Supabase, `hd=sinostudio.vn`; the callback rejects any email not ending in `@sinostudio.vn`, and data access additionally requires a row in `tracker_users`. That table has no write path through the API — add people with SQL only:

```sql
insert into public.tracker_users (email, display_name)
values ('someone@sinostudio.vn', 'Someone');  -- email must be lowercase
```

**Tables** (`supabase/migrations/`) — `tracker_users` (allow-list), `tracker_projects`, `tracker_staff` (+ `email`), `tracker_cuts` (`pay_split` jsonb: null = project default, else `{work_type_id: pct}`, validated per phase; v2.8: `budgets` jsonb `{phase_id: amount}` replaces `budget`, which the contract migration drops), `tracker_work_types` (per project; `pay_pct` = default split within its phase, `sort_order` sparse 10/20/30; v2.8: `phase_id`, locked), `tracker_tasks` (`cut_id`, `version`, `links`, `is_fix` (v2.6: a fix task, same cut + work type as the stage it fixes; immutable after insert; the one-task-per-cut+type rule is the partial unique index `tracker_tasks_cut_type_key ... where not is_fix`); no name; `start_date`..`end_date`, `progress` 0–100), `tracker_strengths` + `tracker_staff_strengths`, `tracker_adjustment_batches` + `tracker_pay_adjustments` (append-only; corrections are reversals), `tracker_audit_log` (trigger-written), `tracker_shares` (DB-generated `token`; revoke is final), `tracker_pay_presets` (studio-wide; `pcts` by work-type position, `codes` display only; create/delete only), `tracker_notice_queue` (`removed` jsonb: snapshots (carry `is_fix`; cron `parseRemoved` reads it separately, `REMOVED_FIELDS` stays string-only) of tasks moved away from that staff in the cycle; on a `staff_id` change the enqueue trigger also queues the OLD staff with a snapshot), `tracker_email_log`, v2.7: `tracker_departments` (per project; name unique case/space-insensitive, colour, `sort_order`; `project_id` immutable via a column UPDATE grant on name/color/sort_order only), `tracker_member_departments` (surrogate bigint `id` for keyset paging; unique (project, staff, department); a MEMBER = staff with ≥ 1 row; composite FK to departments with NO ACTION, so a department with members can't be deleted: 23503 → `in_use`; the migration backfills, per project that has tasks, a department "Chung" holding every task owner). v2.8: `tracker_phases` (per project; `name` unique ignoring case/spaces, `sort_order`, `after uuid[]` = prerequisite phases; immutable (insert/select only); not in the realtime publication, phases only appear with a new project). Projects and staff are soft-archived via `archived_at`; work types cannot be added or deleted after project creation.

**DB rules (authoritative, enforced in SQL; the client only mirrors them)** — every rule trigger/RPC takes the per-project advisory lock; pipeline order trigger (strict before/after per cut, checked on every edit; v2.5: a type with `overlaps_prev` may start on/after the start of its direct predecessor by `sort_order`, with any end. Mirrored in `pipeline.ts` `typeRule`/`orderConflict`. The deferred constraint trigger `tracker_type_order` refuses type changes that would leave tasks breaking the rule and raises `overlap_in_use` with detail = the cut code); one task per cut + type (stages only; v2.6: a fix is exempt from the pipeline order and stage tasks ignore fixes, `tracker_type_order_check` ignores fixes; a fix needs a non-fix task of the same cut+type on insert or when its cut/type changes, else `fix_no_stage`; changing `is_fix` raises `fix_immutable`; fixes still count as "in use" for the type guard; deleting/retyping the stage task leaves "orphan" fixes, which stay editable); pay % total = 100 per phase (v2.8; deferred trigger, ≥ 1 phase, ≥ 1 type per phase) and per phase of a cut split when set (`tracker_cut_split` trigger: keys must be the project's types, every phase with ≥ 1 key sums to 100, raises `pct_total`); v2.8 phase lock: phases and types can only be inserted in the project's creation transaction (`created_at = now()`; `projects.created_at` is immutable), type `id`, `code`, `phase_id` and `sort_order` are locked, types cannot be added or deleted afterwards (`phase_locked`); v2.8 order rule across phases: same phase = the rule above with predecessor/successor taken per phase; an ancestor phase's task must end before the candidate starts; a descendant phase's task must start after the candidate ends; unrelated phases have no rule; fixes are exempt; mirrored in `typeRule(types, phases)`/`orderConflict` (reasons `phaseBefore`/`phaseAfter`); `tracker_cut_budgets` trigger validates `budgets` (keys = project phases, integer values, total ≤ 1e10, else `invalid`); `project_id` is immutable on tasks/types/cuts. `project_id` is immutable on tasks/types/cuts. Error keys raised from SQL (`order_conflict`, `overlap_in_use`, `type_in_use`, `pct_total`, `adjustment_invalid`, `project_immutable`, `share_revoked`, `staff_archived`, `fix_no_stage`, `fix_immutable`, `staff_not_member`, `phase_locked`, `phase_invalid`, `invalid` (P0001 from the member RPCs and `tracker_set_cut_budget`)) are mapped to messages in `src/components/tracker/errors.ts`. RPCs (SECURITY INVOKER, authenticated): `tracker_create_project(p_name, p_color, p_phases)` (v2.8: `p_phases` = `[{name, after: [index], types: [...]}]`, inserted phase by phase in the creation transaction), `tracker_save_work_types` (v2.8: updates label, colour, pay % and overlaps only, for exactly the project's type id set, else `phase_locked`), `tracker_create_task` (v2.6: optional `p_is_fix`; the 7-arg overload is dropped; v2.8: `p_budgets` jsonb, used only when the call creates the cut), `tracker_ensure_cut`, `tracker_set_cut_budget(p_cut, p_phase, p_budget)` (v2.8: one atomic `budgets ||` update), `tracker_set_cut_splits(p_project, p_cuts, p_split, p_phase)` (one split for many cuts, atomic; v2.8: replaces only that phase's keys and drops keys of types no longer in the project), `tracker_add_adjustments` (`op_id`/batch id makes retries safe), `tracker_move_task` (versioned reassign + date change; optionally moves the old person's open bonus/penalty for that stage: a reversal for the old staff plus a copy for the new staff, in one batch = `op_id`; the batch is written only when movable rows exist, an existing batch id raises `adjustment_invalid`; raises `staff_archived`). v2.7 members: trigger `tracker_task_member` (BEFORE INSERT OR UPDATE OF `staff_id` on `tracker_tasks`; advisory lock; raises `staff_not_member`; existing tasks of removed members stay editable). RPCs: `tracker_set_member_departments(p_project, p_staff[], p_departments[], p_mode 'set'|'add')` ('add' = union, used by Add members; 'set' = exact replace, staff must already be members, used by Edit), `tracker_remove_member` (returns `{removed}`), `tracker_copy_members(p_from, p_to)` (returns `{added}`; departments matched by name or created, non-archived staff only, only source departments with a non-archived member); all take the per-project advisory lock. Service-role only (EXECUTE revoked from authenticated): `tracker_claim_notices`, `tracker_claim_emails`.

**RLS** — every tracker table is `authenticated`-only; policies call `public.is_tracker_user()` (SECURITY INVOKER, checks the JWT email against `tracker_users`; EXECUTE revoked from `anon`/`public`). `tracker_users` has a self-row select policy that must not call the helper (recursion). `tracker_notice_queue` has a deny-all select policy and no grants. Keep `get_advisors` (security) empty after schema changes.

**Realtime** — the `supabase_realtime` publication holds `tracker_tasks`, `tracker_projects`, `tracker_staff`, `tracker_cuts`, `tracker_work_types`, `tracker_strengths`, `tracker_staff_strengths`, `tracker_pay_adjustments`, `tracker_shares`, `tracker_departments`, `tracker_member_departments`. `GanttBoard/useTaskRealtime.ts` authorizes the socket (`realtime.setAuth(session.access_token)`) before joining, subscribes without a filter (DELETE events can't be filtered), and feeds payloads to `taskSync`. Other tables (projects, work types, staff, strengths, shares, cuts, departments, members…; the board's `BOARD_TABLES`, the Cut page and the Members page refresh on the two v2.7 tables) use `useRealtimeRefresh` / `RealtimeRefresh` (any event → scheduled `router.refresh()`; `useRealtimeBusy` defers refresh while a form/edit is busy). Board presence (`GanttBoard/useBoardPresence.ts`, pure helpers in `presence.ts`) uses one **private** channel `tracker-board-<projectId>` (the only private channel; authorized by the `tracker_board_read`/`tracker_board_write` policies on `realtime.messages`): presence payload `{email, name, avatar, month, editing}` (avatar stack, editing outline) plus `cell` broadcasts (live hovered cells). Quota gate: `cell` is sent only while another email is present, the channel is `joined`, the tab is visible and the pointer is mouse/pen (250 ms trailing throttle). Test override for the single-account E2E: `localStorage['tracker.presence.selfPeer'] = '1'` makes own other tabs count as peers.

**Client sync** — `GanttBoard/taskSync.ts` is the single source of truth for board tasks: a synchronous store; `planCommit` runs inside the commit chain (`createCommitChain`), never before it; `refreshStart` must be called before every board refresh; conflicts are decided by `version` (stale writes are refused by the DB version check; foreign changes after baseline are tracked by version).

**Undo / redo (v2.4)** — Board only (plan `.omc/plans/tracker-v2.4-undo.md`). The pure stack is `GanttBoard/undoStack.ts`. State is a module-level map per project id, so it survives the per-month remount and is cleared on reload; own changes only, max 20. Shortcuts: Ctrl/Cmd+Z, Ctrl+Y or Ctrl+Shift+Z; there are also toolbar buttons and an `UndoToast`.
- Conflict rule: undo/redo sends `commit(..., {expected: entry.version})`, skipping `planCommit`, so the server version check alone decides. This is exact only because **every own confirmed task write calls `rebase(id, row.version)`**; keep that true for any new board write path.
- Undoing a delete re-creates the task (`createTask`, then a versioned update for progress/links) and `remap`s the old id. v2.8: snapshots carry `budgets` (not `budget`); the re-create passes the full map as `p_budgets`, which applies only if the cut has to be re-created.
- Undoing a move with moved bonus/penalty runs the `payUnchanged` pre-check (by `batch_id`) and refuses if pay changed.
- Barrier: undo is ignored while anything is in flight (a module-level counter per project), or while the panel is dirty, a dialog is open, the create popover is open, or a drag is running.

**Board behaviour (v2.3)** — Lanes are grouped by cut: `assignLanes` packs per-cut blocks (board, share page, PNG). v2.5: overlapping tasks inside one cut get sub-lanes, so a block can be several lanes tall. One reassign path: a vertical drag or the panel assignee Select opens `MoveDialog`, then `moveTask` through `commit()`. Wheel hand-off: `GanttBoard/wheelHandoff.ts` sends wheel input nothing else can consume to the grid; only modal dialogs and Ctrl are excluded. The panel closes on re-click, Esc and the X button, with a discard prompt for the links draft. Month jump: `MonthNav` popover with `parseMonthInput`. A skeleton shows while a month loads. The digest shows a "Đã chuyển khỏi bạn" table; `planDigest` dedupes by `task_id` and drops tasks the recipient owns again.

**Board members (v2.7)** — Rows = non-archived members ∪ owners of tasks in the synced month (`members.ts` `boardStaff`, computed client-side from `shown`); non-members/archived rows are greyed (no drop, no "+", no drag-create); department chips beside names. Toolbar filters: name (accent-insensitive `foldName`, not saved) + department; strengths filter in the strengths header. Department + strength filters are saved per project in localStorage `tracker.board.filter.<projectId>` via `useProjectFilter` (keyed store in `useBoardPrefs.ts`; global `tracker.board.v1` keeps sort/hideStrengths only). Empty state links to Thành viên; the heading shows the project name. Pickers: TaskPanel and cut-mode create list members only (`pickerStaff`), ShareModal groups members first (`shareGroups`), bonus/penalty pickers unchanged. Plan `.omc/plans/tracker-v2.7-members.md`.

**Server actions** — all data actions go through `writeRow` in `tracker/actions.ts`: `getUser()` guard (retried once on network errors; never `getClaims`), zod validation, `.select().single()`, never throw. Task actions pass `{revalidate: 'none'}` (the board applies the returned row itself); project/staff/work-type actions call `refresh()`. The proxy skips `getUser` on server-action POSTs because each action authenticates itself. The proxy only sets `NEXT_LOCALE` when it changes — a `Set-Cookie` on an action response invalidates the client router cache.

**Pay** — stage pay = `cutBudget(cut, type.phase_id)` × `stagePct` (v2.8: budgets are per phase; `cutTotal` = sum over phases). A per-phase override is present when the cut's `pay_split` holds any key of that phase: then `split[type.id] ?? 0`, else the type's default `pay_pct` (`phaseSplit`, `typeIdsByPhase`, `budgetValues` in `pay.ts`). Splits are edited per phase in `CutsView/SplitModal.tsx` (many cuts at once; presets map by position within one phase via `presetToDraft`, mismatches are flagged for the user to fix). The Cut page footer shows assigned pay (active phase per stage, plus phase and all-phase totals). Computed only in `src/components/tracker/pay.ts` (effective months via `earnings.ts`); never re-derive amounts elsewhere. Project-wide queries page with the keyset helper `Earnings/keyset.ts` (PostgREST `max_rows` is 1000). v2.6 fixes pay nothing (`payLines` skips them); managers use bonus/penalty on the fixed stage; the adjustment month (`effectiveMonths`) = end month of that staff's latest fix on the stage, else the stage task's month, else `created_at`.

**Fix tasks (v2.6)** — Board: the create popover has a "Fix" switch (not in cut mode; only stages that have a stage task are pickable; no order pre-check); fix bars are striped in the stage colour and labelled "LO · Fix"; the panel shows cut/type read-only for fixes; undo snapshots carry `is_fix`. The cuts page shows a read-only fix count per stage cell. Share page/PNG/ICS/emails label fixes " · Fix". Every explicit `tracker_tasks` select and hand-picked task type must carry `is_fix` (required boolean, so tsc catches omissions).

**Admin client** — `src/utils/supabase/admin.ts` (service role, `SUPABASE_SECRET_KEY`) is used only by `src/lib/tracker/shareData.ts` (public share DTOs) and the cron route.

**Email** — `src/services/trackerMail.ts` (Resend), templates in `src/components/tracker/emails/`. Outbox-first: a row in `tracker_email_log` (payload persisted before the first attempt), then the worker `POST /api/tracker/cron` claims and delivers (`tracker_claim_notices` digests, reminder enqueue, `tracker_claim_emails` deliver/retry, max 5 attempts). Sender `tracker@web.sinostudio.vn` (verified Resend domain; `TRACKER_MAIL_FROM`, same fallback in code). Env: `TRACKER_MAIL_FROM`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`. The pg_cron job is scheduled after deploy (secret in Vault as `cron_secret`, same value as `CRON_SECRET`), via `execute_sql`, not a migration:

```sql
select cron.schedule('tracker-mail', '*/5 * * * *', $$ select net.http_post(url := 'https://sinostudio.vn/api/tracker/cron', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 60000) $$);
```

"Gửi lỗi" (failed sends) query: `select * from tracker_email_log where status <> 'accepted' and (attempts >= 5 or created_at < now() - interval '23 hours')`.

**Migrations (v2)** — `20260930065620_tracker_v2`, `20260930065653_tracker_v2_notice_queue_policy`, `20260930070707_tracker_v2_hardening`, `20260930072525_tracker_v2_shares_grant`, `20260930073842_tracker_v2_shares_token`; v2.1: `20260930102651_tracker_board_presence`; v2.2: `20261001032517_tracker_cut_pay_split`, `20261001053228_tracker_pay_presets`; v2.3: `20261002034325_tracker_v23_move_task`; v2.5: `20261002125744_tracker_v25_overlap`; v2.6: `20261004081552_tracker_v26_fix`; v2.7: `20261005070024_tracker_v27_members`, `20261005072447_tracker_v27b_member_mode`; v2.8: `20261006130134_tracker_v28a_phases` (expand: additive, keeps `budget` in sync with `budgets` so the old code keeps working), then `tracker_v28b_contract` (contract, applied after the deploy; timestamp pending: drops `tracker_cuts.budget` and `tracker_users.role`, removes the old RPC params, makes `p_phase` required) (v1: `20260927090805_tracker`, `20260927090827_tracker_users_self_initplan`, `20260927093702_revoke_helper_execute`).

**404s** — `app/global-not-found.tsx` (enabled by `experimental.globalNotFound`, needed because the root layout is `[locale]`) handles unmatched URLs; `[locale]/not-found.tsx` handles `notFound()` inside localized pages.

**Session** — `src/proxy.ts` (Next 16 proxy, formerly middleware) calls `updateSession` from `src/utils/supabase/proxy.ts`, which refreshes the Supabase cookie and redirects unauthenticated `/[locale]/tracker/*` requests to the login page (with `next`). Supabase clients: `src/utils/supabase/{client,server,admin}.ts`.

**Types regen** after a schema change:
1. Supabase MCP `generate_typescript_types` → write to `src/types/database.types.ts`
2. `npx supazod -i src/types/database.types.ts -o src/schemas/generated/index.ts -s public` (Zod schemas used by the actions)

**Tests** — `npm test` (Vitest) covers the proxy/session logic and the pure tracker modules: `dates`, `cuts`, `pipeline`, `pay`, `earnings`, `errors`, `ics`, `links`, `staffView`, `useRealtimeRefresh`, `GanttBoard/taskSync` + `dragMath` + `boardHelpers` + `presence` + `wheelHandoff` + `undoStack`, `lib/tracker/mailPlan` + `shareShape`, `services/trackerMail`. v2.3 cases: `dates` (lanes by cut, month parsing), `dragMath` (targetStaff, drag latch), `pay` (`movableAdjustments`), `mailPlan` (removed digest). v2.6 cases: `pipeline`/`pay`/`earnings`/`errors` fix cases, `shareShape` (ICS mapping), `mailPlan` (`parseRemoved`/`toMailTask`/digest render). v2.7: new `members`, `taskList`; cases in `staffView` (`foldName`, AND filters), `boardHelpers` (`parseProjectFilter`), `errors` (`staff_not_member`). v2.8: new `phases`, `PhasesEditor/phaseDraft`; cases in `pay` (per-phase budgets/splits), `pipeline` (phase rule), `cutsViewHelpers`, `undoStack` (`budgets`), `errors` (`phase_locked`, `phase_invalid`). SQL acceptance scripts `.omc/e2e/v2.7/sql-tests.sql`, `.omc/e2e/v2.8/sql-tests.sql` (+ the contract checks).

**Next agent rules** — the `nextjs-agent-rules` block at the end of this file is auto-added by `next dev`; it is kept on purpose, do not remove it.

## Claude Working Patterns

- **HTML artifacts are the owner-facing view layer, never the record.** Plans, backlogs, changelogs and any briefs for subagents or review tools stay markdown (agents grep, diff and read them; HTML costs tokens and wrecks diffs). Publish a private HTML artifact (load `artifact-design` first) only when the owner is the reader:
  1. **Plan approval** — for plans over ~300 lines, after the review round: decisions table, owner-decision list, phase/wave diagram, collapsible sections. Generated from the `.md`; edits go to the `.md` and the page is regenerated.
  2. **Owner decisions** — when 3+ decisions are pending, or one needs comparing options side by side, build an interactive decision page ending in a "Copy answers" button that exports plain text to paste back, instead of long question rounds. Record the answers in the `.md` plan.
  3. **Review findings and E2E reports** — findings sorted by severity with the verified verdict (confirmed / rejected + evidence) per row; E2E runs with pass/fail per acceptance criterion and screenshots.
  4. **UI tuning** — ONLY when the task is UI work (motion, spacing, visual parameters) or a UI design has multiple candidate options to choose between; never for non-UI tasks. A throwaway prototype with sliders/toggles and a "Copy values" export; apply the exported values in code. The prototype never ships.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
