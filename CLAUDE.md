# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Portfolio website for **Sino Studio**, a Vietnamese animation studio. Built with Next.js 16 (App Router), React 19, Mantine UI v8, and Framer Motion. Dark-themed, Vietnamese-language content. React Compiler is enabled (`reactCompiler: true` in next.config.ts).

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, core-web-vitals + typescript presets)

No test framework is configured.

## Architecture

**Routing** — Next.js App Router with static pages:
- `/` — landing page (hero, ticker, who-we-are, clients, projects, brand-service sections)
- `/about`, `/services`, `/brand-equity` — static content pages
- `/projects/[id]` — dynamic project detail pages, statically generated from `PROJECTS` map via `generateStaticParams`; `dynamicParams = false`

**Data layer** — No database. All project data lives in `src/data/project-data.ts` as a `Record<string, ProjectMetaData>` export (`PROJECTS`). Music playlist metadata is in `src/data/playlist.ts`. Adding a new project means adding an entry to this map and placing assets in `public/images/projects/<id>/` and `public/videos/projects/<id>/`.

**Project detail pages** — Driven by a composable section system. Each project declares an ordered `sections` array (e.g. `['color-script', 'characters', 'background', 'credits']`). `ProjectShowcasePage` maps these to section components via a switch. Available section types: `color-script`, `characters`, `background`, `credits`, `snippets`, `fanart`, `video`. Project types: `animation`, `mv`, `series`.

**Asset naming conventions** — Section components expect numbered files in `public/images/projects/<project-id>/`:
- Characters: `character-1.webp`, `character-2.webp`, ...
- Color scripts: `color-script-1.png`, ... (count via `colorScriptCount`, default 12)
- Backgrounds: `background-1.webp` or `background-1.webm` (driven by `backgrounds` array with `{type: 'image'|'video'}`)
- Snippets: `snippets-1.webp`, ... (count via `snippetsCount`, default 12)
- Fanart: `fanart-1.webp`, ... (count via `fanartCount`, default 12)
- Hero image: `hero.webp`

**Styling** — CSS Modules (`.module.css` co-located with components). Global CSS variables in `globals.css` (`--color-red`, `--color-black`, `--color-dark`, `--color-white`). Mantine theme customized with red primary color and Montserrat headings (via `--font-heading` CSS variable from `next/font`). Body font is Inter.

**Global components** — `MusicPlayer` (audio player) and `ProgressBar` (route transition indicator via `@mantine/nprogress`) are rendered in the root layout, outside page content. `Navbar` and `Footer` are included per-page, not in the layout.

**Path alias** — `@/*` maps to `./src/*`.

## Key Conventions

- Components are organized by feature/page under `src/components/` (e.g. `landing/`, `project-details/`, `about/`, `services/`, `brand-equity/`)
- Client components use `'use client'` directive; page-level components are server components by default
- YouTube IFrame API is loaded globally via `<Script>` in the root layout; video playback uses the YouTube IFrame Player API with types in `src/types/youtube.d.ts`