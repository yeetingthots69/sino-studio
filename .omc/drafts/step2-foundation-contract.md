# Step 2 — Foundation contract (auth gate, proxy, login)

Plan: `.omc/plans/tracker-v1.md` §3.1, §3.2, §3.4 (`signInWithGoogle`, `signOut` only), §3.6 (MusicPlayer, LanguageSwitcher, robots, package.json), §5 AC1–4, AC12, AC15, AC18.

## Files (create/modify only these)
- `package.json`: deps `@supabase/supabase-js`, `dayjs`; devDeps `vitest`; script `"test": "vitest run"`.
- `vitest.config.ts`: `environment: 'node'`, `resolve.alias {'@': path.resolve(__dirname,'src')}`, `include: ['src/**/*.test.ts']`.
- `src/proxy.ts` (rewrite; keep exported names `proxy`, `config`).
- `src/utils/supabase/proxy.ts` (full rewrite).
- `src/utils/supabase/__tests__/proxy.test.ts` (full rewrite).
- `src/app/auth/callback/route.ts`.
- `src/app/[locale]/tracker/actions.ts` (only `signInWithGoogle`, `signOut` now; other actions come in later steps — leave a clear file shape).
- `src/app/[locale]/tracker/login/page.tsx` + `login.module.css`.
- `src/app/[locale]/tracker/(app)/layout.tsx`, `(app)/page.tsx` (temporary: renders "OK" placeholder; step 3 replaces).
- `src/components/tracker/NotAuthorized.tsx` (+ css).
- `src/components/music-player/MusicPlayer.tsx`, `src/components/language-switcher/LanguageSwitcher.tsx`, `src/app/robots.ts`.
- `src/i18n/dictionaries/en.json`, `vi.json`: add `tracker.auth.*` keys (signInWithGoogle, signOut, notAuthorized.title/body, errorDomain).

## Signatures / invariants
```ts
// src/utils/supabase/proxy.ts
export function isProtectedPath(pathname: string): boolean   // /^\/(en|vi)\/tracker(\/|$)/ && !/\/tracker\/login$/
export function isLoginPath(pathname: string): boolean
export async function updateSession(request: NextRequest, locale: Locale): Promise<NextResponse>
```
- `createServerClient` cookie adapter: `setAll(cookiesToSet, headers)` — apply BOTH cookies and `headers` (Object.entries → response.headers.set) to the response; when building a redirect, copy cookies AND those headers onto it.
- `getUser()` only when `isProtectedPath || isLoginPath`.
- Unauth + protected → `NextResponse.redirect(url)` where `url.pathname = /${locale}/tracker/login`, `url.searchParams.set('next', pathname + search)`. Status 307.
- Auth + login → 307 `/${locale}/tracker`.
- Every response: `cookies.set('NEXT_LOCALE', locale, {path:'/'})`.
- Use `LOCALES`, `isValidLocale`, `DEFAULT_LOCALE` from `@/i18n/config` — delete the local copies in `src/proxy.ts`.
- `src/proxy.ts` matcher: existing exclusions + `auth/`.

```ts
// src/app/auth/callback/route.ts
export async function GET(request: NextRequest): Promise<NextResponse>
```
- `code` → `supabase.auth.exchangeCodeForSession(code)`; on error → redirect login with `?error=auth`.
- `next` = `decodeURIComponent(searchParams.get('next') ?? '')`; valid iff `/^\/(en|vi)\/tracker(\/|\?|$)/.test(next)`; locale = `next.split('/')[1]` if valid else cookie `NEXT_LOCALE` if valid locale else `'en'`.
- If `!user.email?.toLowerCase().endsWith('@sinostudio.vn')` → `await supabase.auth.signOut()` BEFORE constructing the redirect → `/${locale}/tracker/login?error=domain`.
- Else redirect to `next` (valid) or `/${locale}/tracker`.

```ts
// actions.ts
export async function signInWithGoogle(formData: FormData): Promise<never>  // redirect()
export async function signOut(): Promise<never>
```
- `signInWithGoogle`: `next` from `formData.get('next')` (validated same regex, default `/${locale}/tracker`); `origin = (await headers()).get('origin')`; allowed origins `['https://sinostudio.vn','http://localhost:3000']`, else fall back to `NEXT_PUBLIC_FRONTEND_URL` env if set, else `https://sinostudio.vn`; `signInWithOAuth({provider:'google', options:{redirectTo:`${origin}/auth/callback?next=${encodeURIComponent(next)}`, queryParams:{hd:'sinostudio.vn', prompt:'select_account'}}})` → `redirect(data.url)`. No `getUser()` guard here.
- `signOut`: `createClient()` → `auth.signOut()` → `redirect('/${locale}/tracker/login')` (locale from `formData`/param).

`(app)/layout.tsx` (server): `export const dynamic = 'force-dynamic'`; `export const metadata = {robots:{index:false,follow:false}}`; `getUser()`; if no user → `redirect(`/${locale}/tracker/login`)` (defensive; proxy normally handles); query `tracker_users` `.select('email, role, display_name').eq('email', user.email.toLowerCase()).maybeSingle()`; if null → render `<NotAuthorized email={…}/>` (no children). Else render children (TrackerShell comes in step 3 — for now a minimal `<main>` wrapper). `login/page.tsx` also exports the noindex metadata.

Login page: dark, uses site tokens; heading, one `<form action={signInWithGoogle}>` with hidden `next` input (from `searchParams.next`), Google button; shows `dict.tracker.auth.errorDomain` when `searchParams.error === 'domain'`.

MusicPlayer: add `const pathname = usePathname()` next to existing hooks; `if (/^\/(en|vi)\/tracker(\/|$)/.test(pathname)) return null;` placed AFTER the last hook call (the `toggleMute` useCallback ~line 134) and before the JSX return.
LanguageSwitcher: `router.push(newPath + window.location.search)`.
robots: `rules: {userAgent:'*', allow:'/', disallow:['/en/tracker','/vi/tracker']}`.

## Tests (`proxy.test.ts`, vitest, mock `@supabase/ssr` like the current file does; host `https://sinostudio.vn`)
1. `/en/about` → `getUser` not called, status 200, `NEXT_LOCALE=en` set.
2. `/en/tracker` unauth → 307; `new URL(location).pathname === '/en/tracker/login'`; `searchParams.get('next') === '/en/tracker'`.
3. `/vi/tracker/abc?m=2026-10` unauth → `next === '/vi/tracker/abc?m=2026-10'`, `NEXT_LOCALE=vi`.
4. `/en/tracker/login` auth → 307 `/en/tracker`.
5. `/en/tracker` auth → 200, refreshed cookie present on response.
6. `/en/tracker/login` unauth → 200 (no redirect).
Also 3–4 unit tests for `isProtectedPath` / `isLoginPath`.

## Acceptance (executor verifies)
- `npm test` green; `npx.cmd tsc --noEmit` clean; `npm run lint` no new errors (pre-existing `LanguageSwitcher` `document.cookie` react-hooks/immutability error is known; do not attempt to fix it beyond the one-line search change).
- `npm run build` output lists `ƒ Proxy` (paste that line) and the tracker routes.
- `curl -I http://localhost:3000/en/tracker` (dev server, background) → 307 with `location` ending `/en/tracker/login?next=%2Fen%2Ftracker`; `/en/tracker/login` → 200; `/en/about` → 200.
