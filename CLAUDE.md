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

Gantt-style production tracker for managers. Not linked from the public site, `noindex`, disallowed in `robots.ts`, not in the sitemap.

**Routes**
- `/[locale]/tracker` — redirects to the newest non-archived project, else to `projects`
- `/[locale]/tracker/login` — Google sign-in (`?error=domain` / `?error=auth` show a message)
- `/[locale]/tracker/(app)/[projectId]` — Gantt board for one project
- `/[locale]/tracker/(app)/projects`, `staff`, `work-types` — CRUD tables (archive instead of delete)
- `/auth/callback` — OAuth code exchange (outside `[locale]`); only a `next` matching `/(en|vi)/tracker...` is honoured

The `(app)` layout renders `TrackerShell` (header, project switcher, nav) and shows `NotAuthorized` when the signed-in user is not on the allow-list. Server actions live in `src/app/[locale]/tracker/actions.ts` (Zod-validated, return `ActionResult`); components in `src/components/tracker/`.

**Auth** — Google OAuth via Supabase, `hd=sinostudio.vn`; the callback rejects any email not ending in `@sinostudio.vn`, and data access additionally requires a row in `tracker_users`. That table has no write path through the API — add people with SQL only:

```sql
insert into public.tracker_users (email, role, display_name)
values ('someone@sinostudio.vn', 'manager', 'Someone');  -- email must be lowercase; role: admin | manager
```

**Tables** (`supabase/migrations/`) — `tracker_users` (allow-list), `tracker_projects`, `tracker_staff`, `tracker_work_types`, `tracker_tasks` (project/staff/work type FKs, `start_date`..`end_date`, `progress` 0–100). Projects, staff and work types are soft-archived via `archived_at`.

**RLS** — every tracker table is `authenticated`-only; policies call `public.is_tracker_user()` (SECURITY INVOKER, checks the JWT email against `tracker_users`; EXECUTE revoked from `anon`/`public`). `tracker_users` has a self-row select policy that must not call the helper (recursion). Keep `get_advisors` (security) empty after schema changes.

**Realtime** — `tracker_tasks` is in the `supabase_realtime` publication. `GanttBoard/useTaskRealtime.ts` authorizes the socket (`realtime.setAuth(session.access_token)`) before joining, subscribes without a filter (DELETE events can't be filtered), and applies payloads straight into client state via `realtimeReducer.ts` — no `router.refresh()` except on reconnect or an unusable payload.

**Server actions** — all data actions go through `writeRow` in `tracker/actions.ts`: `getUser()` guard (retried once on network errors; never `getClaims`), zod validation, `.select().single()`, never throw. Task actions pass `{revalidate: 'none'}` (the board applies the returned row itself); project/staff/work-type actions call `refresh()`. The proxy skips `getUser` on server-action POSTs because each action authenticates itself. The proxy only sets `NEXT_LOCALE` when it changes — a `Set-Cookie` on an action response invalidates the client router cache.

**404s** — `app/global-not-found.tsx` (enabled by `experimental.globalNotFound`, needed because the root layout is `[locale]`) handles unmatched URLs; `[locale]/not-found.tsx` handles `notFound()` inside localized pages.

**Session** — `src/proxy.ts` (Next 16 proxy, formerly middleware) calls `updateSession` from `src/utils/supabase/proxy.ts`, which refreshes the Supabase cookie and redirects unauthenticated `/[locale]/tracker/*` requests to the login page (with `next`). Supabase clients: `src/utils/supabase/{client,server,admin}.ts`.

**Types regen** after a schema change:
1. Supabase MCP `generate_typescript_types` → write to `src/types/database.types.ts`
2. `npx supazod -i src/types/database.types.ts -o src/schemas/generated/index.ts -s public` (Zod schemas used by the actions)

**Tests** — `npm test` (Vitest) covers the proxy/session logic and tracker date helpers.

**Next agent rules** — the `nextjs-agent-rules` block at the end of this file is auto-added by `next dev`; it is kept on purpose, do not remove it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
