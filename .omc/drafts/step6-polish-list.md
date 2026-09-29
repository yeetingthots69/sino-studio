# Step 6 — polish list (accumulated from reviews)

From step-2 review (all minor, confirmed):
1. `proxy.test.ts` signed-in `/en/tracker` case: also assert `Cache-Control` header propagated on `NextResponse.next` path.
2. Login page: add `tracker.auth.errorAuth` (en/vi) and render for `?error=auth`.
3. `auth/callback/route.ts:132`: drop the redundant `decodeURIComponent` (searchParams already decodes).
4. `actions.ts` origin allow-list: add `https://www.sinostudio.vn`.
5. Guard `NEXT_PUBLIC_FRONTEND_URL` trailing slash (`.replace(/\/$/,'')`).
6. Origin allow-set: accept `/^http:\/\/localhost:\d+$/` (dev port varies; 3000 is occupied on the user's machine).

From wave-3 review (confirmed):
7. `ProjectsTable.tsx:106` hydration risk: format `created_at` with `Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh'})` (same for any other date rendered in client tables).
8. `ProjectSwitcher.tsx` `w={{base:140, lg:200}}`; shell left group `flex: 1 1 auto; min-width: 0` so sign-out never overflows at 375px.
9. Below 1024px: replace hidden nav with a Mantine `Menu` burger (Projects / Staff / Work types) — keep sign-out visible.
10. `actions.ts`: make `createProject/updateProject/archiveProject` use `writeRow`; delete `writeProject` and its casts. Remove unused `.swatch` in `StaffTable.module.css`.

From step-1 review (optional hardening): `revoke execute on function public.is_tracker_user() from anon, public;` — small follow-up migration.

Docs: `CLAUDE.md` Tracker section (routes, tables, `tracker_users` SQL-only, types regen via MCP + supazod, proxy/test, Next agent-rules block kept intentionally).
