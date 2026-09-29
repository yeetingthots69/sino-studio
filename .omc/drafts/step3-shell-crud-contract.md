# Step 3 — Shell + CRUD pages contract

Plan: `.omc/plans/tracker-v1.md` §3.1, §3.3 (archived semantics), §3.4, §3.5 (`TrackerShell`, `ProjectsTable`, `StaffTable`, `WorkTypesTable`), §3.6 dictionaries. Step 2 already delivered: proxy/auth, `(app)/layout.tsx` gate, `actions.ts` with `signInWithGoogle`/`signOut`, `NotAuthorized`, `tracker.auth.*` dictionary keys.

Three executors run in parallel. Shared conventions (all three):
- Server pages under `src/app/[locale]/tracker/(app)/…/page.tsx` load data with `createClient()` (RLS) and pass plain arrays to a `'use client'` table component in `src/components/tracker/<Name>/<Name>.tsx` + `.module.css`.
- Mutations = server actions in `src/app/[locale]/tracker/actions.ts` (append; do not rewrite existing exports). Shape:
  ```ts
  type ActionResult<T = undefined> = {ok: true; data: T} | {ok: false; error: string};
  ```
  Each: `getUser()` guard → zod parse (import generated schemas from `@/schemas/generated` and narrow) → supabase write with `.select().single()` (0 rows → `{ok:false,error:'not_found'}`) → `revalidatePath('/[locale]/tracker','layout')` → return row.
- Ids validated with `z.uuid()`. Colors `^#[0-9a-fA-F]{6}$`. Names trimmed, 1–80 chars.
- Dictionaries: add keys under `tracker.<area>.*` to BOTH `en.json` and `vi.json` (vi labels from the prototype where they exist). Never hardcode strings.
- UI: Mantine 9 `Table`, `Modal`, `TextInput`, `ColorInput`, `NumberInput`, `Button`, `@mantine/form` `useForm`; dark site theme; CSS Modules for layout only. Inline `Text c="red"` for action errors (no notifications dep).
- Archive = set `archived_at = now()`; tables show an "Archived" toggle (default hidden). Unarchive = set null.
- Verify: `npx.cmd tsc --noEmit`, `npm run lint` (no new errors), and one manual round-trip via the dev server if a session cookie is available; otherwise `execute_sql` read-back after calling the action is not possible — state that and rely on tsc + a code walkthrough. Do not commit.

## 3A — TrackerShell + ProjectSwitcher + (app)/page redirect  (executor: shell-exec)
Files: `src/components/tracker/TrackerShell/TrackerShell.tsx` (+css), `src/components/tracker/ProjectSwitcher.tsx`, modify `(app)/layout.tsx` to render `<TrackerShell user={{name, avatarUrl, email}} projects={…} locale>` around children, replace placeholder `(app)/page.tsx`.
- Layout loads `tracker_projects` where `archived_at is null` order `created_at desc` → `{id,name,color}[]`; passes to shell.
- `TrackerShell` (`'use client'`): sticky header height 56px, `background: var(--color-dark)`, bottom 1px border rgba(255,255,255,.1). Left: logo `/sino-studio-face.png` (32px) linking `/${locale}/tracker`; `ProjectSwitcher` (Mantine `Select`, value = current `[projectId]` from `useParams()`, `onChange` → `router.push(`/${locale}/tracker/${id}`)`); nav links Projects / Staff / Work types (`next/link`, active underline `var(--color-red)`). Right: `LanguageSwitcher` (existing component), `Avatar src={avatarUrl}` + name (`user_metadata.full_name ?? email`), sign-out `<form action={signOut}>` button with hidden `locale`.
- Wrap children in `<DatesProvider settings={{locale}}>`; `import 'dayjs/locale/vi'` + `import '@mantine/dates/styles.css'` here.
- `(app)/page.tsx`: newest non-archived project → `redirect(`/${locale}/tracker/${id}`)`; none → `redirect(`/${locale}/tracker/projects`)`.
- Dictionary keys: `tracker.shell.{projects,staff,workTypes,signOut,selectProject}`.

## 3B — Projects page  (executor: projects-exec)
Files: `(app)/projects/page.tsx`, `src/components/tracker/ProjectsTable/ProjectsTable.tsx` (+css), actions `createProject({name,color})`, `updateProject({id,name?,color?})`, `archiveProject({id, archived: boolean})`.
- Columns: color swatch, name, created (dd/MM/yyyy), actions (edit, archive/unarchive, open → `/${locale}/tracker/${id}`).
- "New project" button → modal form (name required, ColorInput default `#e8192c`).
- Dictionary keys: `tracker.projects.*`.

## 3C — Staff + Work types pages  (executor: staff-exec)
Files: `(app)/staff/page.tsx`, `src/components/tracker/StaffTable/StaffTable.tsx`; `(app)/work-types/page.tsx`, `src/components/tracker/WorkTypesTable/WorkTypesTable.tsx`; actions `createStaff({name,strengths,sort_order})`, `updateStaff({id,…})`, `archiveStaff({id,archived})`, `createWorkType({code,label,color,sort_order})`, `updateWorkType`, `archiveWorkType`.
- Staff columns: STT (sort_order), NHÂN SỰ (name), ĐIỂM MẠNH (strengths), actions. Order by `sort_order, name`.
- Work types columns: swatch, code, label, order, actions. `code` unique — surface DB unique violation as `error:'duplicate'` → dictionary message.
- Dictionary keys: `tracker.staff.*`, `tracker.workTypes.*` (vi headers verbatim: "STT", "NHÂN SỰ", "ĐIỂM MẠNH").

## Acceptance (reviewer verifies)
- tsc + lint clean; `npm run build` lists `/[locale]/tracker/{projects,staff,work-types}`.
- Actions reject: non-uuid id, empty name, bad color, unauthenticated (return `{ok:false}`; never throw).
- Every user-visible string exists in both dictionaries (grep for string literals in the new components → none).
- Shell hides nothing from the public site (public pages unaffected: `Navbar`/`Footer` untouched).
