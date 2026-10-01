# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio website for **Sino Studio**, a Vietnamese 2D animation studio (live at sinostudio.vn, hosted on Vercel). Built with Next.js 16 (App Router), React 19.2, Mantine UI v9, and Framer Motion. Dark-themed, bilingual (en/vi). React Compiler is enabled (`reactCompiler: true` in next.config.ts).

An internal production tracker lives under `/tracker` (Supabase backend, access limited to managers/admins/dev) — see [Tracker (internal)](#tracker-internal).

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

Gantt-style production tracker for managers (v2: cuts, pay, earnings, sharing, email). Not linked from the public site, `noindex`, disallowed in `robots.ts`, not in the sitemap (the public share page is token-gated).

**Routes**
- `/[locale]/tracker` — redirects to the newest non-archived project, else to `projects`
- `/[locale]/tracker/login` — Google sign-in (`?error=domain` / `?error=auth` show a message)
- `/[locale]/tracker/(app)/[projectId]` — board with tabs Lịch (Gantt) | Cut | Nhân sự; `[projectId]/cuts` (cuts grid, pay, bulk), `[projectId]/people` + `/people/[staffId]` (project-scope earnings / profile)
- `/[locale]/tracker/(app)/people` + `/people/[staffId]` — studio-scope earnings / profile (archived projects included)
- `/[locale]/tracker/(app)/projects`, `staff` — CRUD tables (archive instead of delete). The work-types page is gone: types are per project, edited in the project modal (`WorkTypesEditor`); defaults in `src/components/tracker/defaults.ts`
- Public (no login): `/[locale]/share/[token]` (read-only `ScheduleGrid`, 60 s refresh), `/api/tracker/ics/[token]/[staffId]`, `/api/tracker/share/[token]/png`; worker `POST /api/tracker/cron` (Bearer `CRON_SECRET`)
- `/auth/callback` — OAuth code exchange (outside `[locale]`); only a `next` matching `/(en|vi)/tracker...` is honoured

The `(app)` layout renders `TrackerShell` (header, project switcher, nav) and shows `NotAuthorized` when the signed-in user is not on the allow-list. Server actions live in `src/app/[locale]/tracker/actions.ts` (Zod-validated, return `ActionResult`); components in `src/components/tracker/`.

**Auth** — Google OAuth via Supabase, `hd=sinostudio.vn`; the callback rejects any email not ending in `@sinostudio.vn`, and data access additionally requires a row in `tracker_users`. That table has no write path through the API — add people with SQL only:

```sql
insert into public.tracker_users (email, role, display_name)
values ('someone@sinostudio.vn', 'manager', 'Someone');  -- email must be lowercase; role: admin | manager
```

**Tables** (`supabase/migrations/`) — `tracker_users` (allow-list), `tracker_projects`, `tracker_staff` (+ `email`), `tracker_cuts` (`pay_split` jsonb: null = project default, else `{work_type_id: pct}`), `tracker_work_types` (per project; `pay_pct` = default split, `sort_order` sparse 10/20/30), `tracker_tasks` (`cut_id`, `version`, `links`; no name; `start_date`..`end_date`, `progress` 0–100), `tracker_strengths` + `tracker_staff_strengths`, `tracker_adjustment_batches` + `tracker_pay_adjustments` (append-only; corrections are reversals), `tracker_audit_log` (trigger-written), `tracker_shares` (DB-generated `token`; revoke is final), `tracker_pay_presets` (studio-wide; `pcts` by work-type position, `codes` display only; create/delete only), `tracker_notice_queue`, `tracker_email_log`. Projects and staff are soft-archived via `archived_at`; work types are deleted (only while unused).

**DB rules (authoritative, enforced in SQL; the client only mirrors them)** — every rule trigger/RPC takes the per-project advisory lock; pipeline order trigger (strict before/after per cut, checked on every edit); one task per cut + type; pay % total = 100 per project (deferred trigger, ≥ 1 type) and per cut split when set (`tracker_cut_split` trigger, keys must be the project's types, raises `pct_total`); a used type cannot be deleted or reordered; `project_id` is immutable on tasks/types/cuts. Error keys raised from SQL (`order_conflict`, `type_in_use`, `pct_total`, `adjustment_invalid`, `project_immutable`, `share_revoked`) are mapped to messages in `src/components/tracker/errors.ts`. RPCs (SECURITY INVOKER, authenticated): `tracker_create_project`, `tracker_save_work_types`, `tracker_create_task`, `tracker_ensure_cut`, `tracker_set_cut_splits` (one split for many cuts, atomic), `tracker_add_adjustments` (`op_id`/batch id makes retries safe). Service-role only (EXECUTE revoked from authenticated): `tracker_claim_notices`, `tracker_claim_emails`.

**RLS** — every tracker table is `authenticated`-only; policies call `public.is_tracker_user()` (SECURITY INVOKER, checks the JWT email against `tracker_users`; EXECUTE revoked from `anon`/`public`). `tracker_users` has a self-row select policy that must not call the helper (recursion). `tracker_notice_queue` has a deny-all select policy and no grants. Keep `get_advisors` (security) empty after schema changes.

**Realtime** — the `supabase_realtime` publication holds `tracker_tasks`, `tracker_projects`, `tracker_staff`, `tracker_cuts`, `tracker_work_types`, `tracker_strengths`, `tracker_staff_strengths`, `tracker_pay_adjustments`, `tracker_shares`. `GanttBoard/useTaskRealtime.ts` authorizes the socket (`realtime.setAuth(session.access_token)`) before joining, subscribes without a filter (DELETE events can't be filtered), and feeds payloads to `taskSync`. Other tables (projects, work types, staff, strengths, shares, cuts…) use `useRealtimeRefresh` / `RealtimeRefresh` (any event → scheduled `router.refresh()`; `useRealtimeBusy` defers refresh while a form/edit is busy). Board presence (`GanttBoard/useBoardPresence.ts`, pure helpers in `presence.ts`) uses one **private** channel `tracker-board-<projectId>` (the only private channel; authorized by the `tracker_board_read`/`tracker_board_write` policies on `realtime.messages`): presence payload `{email, name, avatar, month, editing}` (avatar stack, editing outline) plus `cell` broadcasts (live hovered cells). Quota gate: `cell` is sent only while another email is present, the channel is `joined`, the tab is visible and the pointer is mouse/pen (250 ms trailing throttle). Test override for the single-account E2E: `localStorage['tracker.presence.selfPeer'] = '1'` makes own other tabs count as peers.

**Client sync** — `GanttBoard/taskSync.ts` is the single source of truth for board tasks: a synchronous store; `planCommit` runs inside the commit chain (`createCommitChain`), never before it; `refreshStart` must be called before every board refresh; conflicts are decided by `version` (stale writes are refused by the DB version check; foreign changes after baseline are tracked by version).

**Server actions** — all data actions go through `writeRow` in `tracker/actions.ts`: `getUser()` guard (retried once on network errors; never `getClaims`), zod validation, `.select().single()`, never throw. Task actions pass `{revalidate: 'none'}` (the board applies the returned row itself); project/staff/work-type actions call `refresh()`. The proxy skips `getUser` on server-action POSTs because each action authenticates itself. The proxy only sets `NEXT_LOCALE` when it changes — a `Set-Cookie` on an action response invalidates the client router cache.

**Pay** — stage pay = cut budget × `stagePct` (the cut's `pay_split` when set, types it omits get 0; else the type's default `pay_pct`). Splits are edited in `CutsView/SplitModal.tsx` (many cuts at once; presets map by position via `presetToDraft`, mismatches are flagged for the user to fix). Computed only in `src/components/tracker/pay.ts` (effective months via `earnings.ts`); never re-derive amounts elsewhere. Project-wide queries page with the keyset helper `Earnings/keyset.ts` (PostgREST `max_rows` is 1000).

**Admin client** — `src/utils/supabase/admin.ts` (service role, `SUPABASE_SECRET_KEY`) is used only by `src/lib/tracker/shareData.ts` (public share DTOs) and the cron route.

**Email** — `src/services/trackerMail.ts` (Resend), templates in `src/components/tracker/emails/`. Outbox-first: a row in `tracker_email_log` (payload persisted before the first attempt), then the worker `POST /api/tracker/cron` claims and delivers (`tracker_claim_notices` digests, reminder enqueue, `tracker_claim_emails` deliver/retry, max 5 attempts). Sender `tracker@web.sinostudio.vn` (verified Resend domain; `TRACKER_MAIL_FROM`, same fallback in code). Env: `TRACKER_MAIL_FROM`, `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`. The pg_cron job is scheduled after deploy (secret in Vault as `cron_secret`, same value as `CRON_SECRET`), via `execute_sql`, not a migration:

```sql
select cron.schedule('tracker-mail', '*/5 * * * *', $$ select net.http_post(url := 'https://sinostudio.vn/api/tracker/cron', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')), timeout_milliseconds := 60000) $$);
```

"Gửi lỗi" (failed sends) query: `select * from tracker_email_log where status <> 'accepted' and (attempts >= 5 or created_at < now() - interval '23 hours')`.

**Migrations (v2)** — `20260930065620_tracker_v2`, `20260930065653_tracker_v2_notice_queue_policy`, `20260930070707_tracker_v2_hardening`, `20260930072525_tracker_v2_shares_grant`, `20260930073842_tracker_v2_shares_token`; v2.1: `20260930102651_tracker_board_presence`; v2.2: `20261001032517_tracker_cut_pay_split`, `20261001053228_tracker_pay_presets` (v1: `20260927090805_tracker`, `20260927090827_tracker_users_self_initplan`, `20260927093702_revoke_helper_execute`).

**404s** — `app/global-not-found.tsx` (enabled by `experimental.globalNotFound`, needed because the root layout is `[locale]`) handles unmatched URLs; `[locale]/not-found.tsx` handles `notFound()` inside localized pages.

**Session** — `src/proxy.ts` (Next 16 proxy, formerly middleware) calls `updateSession` from `src/utils/supabase/proxy.ts`, which refreshes the Supabase cookie and redirects unauthenticated `/[locale]/tracker/*` requests to the login page (with `next`). Supabase clients: `src/utils/supabase/{client,server,admin}.ts`.

**Types regen** after a schema change:
1. Supabase MCP `generate_typescript_types` → write to `src/types/database.types.ts`
2. `npx supazod -i src/types/database.types.ts -o src/schemas/generated/index.ts -s public` (Zod schemas used by the actions)

**Tests** — `npm test` (Vitest) covers the proxy/session logic and the pure tracker modules: `dates`, `cuts`, `pipeline`, `pay`, `earnings`, `errors`, `ics`, `links`, `staffView`, `useRealtimeRefresh`, `GanttBoard/taskSync` + `dragMath` + `boardHelpers` + `presence`, `lib/tracker/mailPlan` + `shareShape`, `services/trackerMail`.

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
