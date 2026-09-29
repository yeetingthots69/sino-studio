import {describe, it, expect, vi, beforeEach} from 'vitest';
import {NextRequest} from 'next/server';

const h = vi.hoisted(() => ({
    getUser: vi.fn(async () => ({data: {user: null as {id: string} | null}})),
}));

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(
        (_url: string, _key: string, opts: {cookies: {setAll: (c: unknown[], h: Record<string, string>) => void}}) => {
            // Emulate the SSR client writing a refreshed cookie + cache headers through setAll.
            opts.cookies.setAll(
                [{name: 'sb-token', value: 'refreshed', options: {path: '/'}}],
                {'Cache-Control': 'private, no-store'}
            );
            return {auth: {getUser: h.getUser}};
        }
    ),
}));

const {updateSession, isProtectedPath, isLoginPath} = await import('@/utils/supabase/proxy');

function req(path: string, init?: {method?: string; headers?: Record<string, string>}) {
    return new NextRequest(new URL(`https://sinostudio.vn${path}`), init);
}

function localeOf(path: string) {
    return path.split('/')[1] as 'en' | 'vi';
}

async function run(path: string) {
    return updateSession(req(path), localeOf(path));
}

beforeEach(() => {
    h.getUser.mockClear();
    h.getUser.mockResolvedValue({data: {user: null}});
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable';
});

describe('path classification', () => {
    it('protects tracker paths in both locales', () => {
        expect(isProtectedPath('/en/tracker')).toBe(true);
        expect(isProtectedPath('/vi/tracker/abc')).toBe(true);
    });

    it('does not protect the login page or lookalike paths', () => {
        expect(isProtectedPath('/en/tracker/login')).toBe(false);
        expect(isProtectedPath('/en/trackers')).toBe(false);
        expect(isProtectedPath('/en/about')).toBe(false);
    });

    it('recognises the login path exactly', () => {
        expect(isLoginPath('/vi/tracker/login')).toBe(true);
        expect(isLoginPath('/en/tracker/login/x')).toBe(false);
        expect(isLoginPath('/en/tracker')).toBe(false);
    });
});

describe('updateSession', () => {
    it('skips getUser on public site pages', async () => {
        const res = await run('/en/about');
        expect(h.getUser).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('en');
    });

    it('redirects unauthenticated tracker requests to login with next', async () => {
        const res = await run('/en/tracker');
        expect(res.status).toBe(307);
        const loc = new URL(res.headers.get('location')!);
        expect(loc.pathname).toBe('/en/tracker/login');
        expect(loc.searchParams.get('next')).toBe('/en/tracker');
        expect(res.cookies.get('sb-token')?.value).toBe('refreshed');
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('keeps the query string in next and sets the vi locale cookie', async () => {
        const res = await run('/vi/tracker/abc?m=2026-10');
        expect(res.status).toBe(307);
        const loc = new URL(res.headers.get('location')!);
        expect(loc.searchParams.get('next')).toBe('/vi/tracker/abc?m=2026-10');
        expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('vi');
    });

    it('sends a signed-in visitor from login to the tracker', async () => {
        h.getUser.mockResolvedValue({data: {user: {id: 'u1'}}});
        const res = await run('/en/tracker/login');
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get('location')!).pathname).toBe('/en/tracker');
    });

    it('lets a signed-in visitor through with the refreshed cookie', async () => {
        h.getUser.mockResolvedValue({data: {user: {id: 'u1'}}});
        const res = await run('/en/tracker');
        expect(h.getUser).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(200);
        expect(res.cookies.get('sb-token')?.value).toBe('refreshed');
        expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });

    it('serves the login page to unauthenticated visitors', async () => {
        const res = await run('/en/tracker/login');
        expect(h.getUser).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(200);
    });

    it('skips getUser for server-action POSTs on protected paths', async () => {
        const res = await updateSession(req('/en/tracker/x', {method: 'POST', headers: {'next-action': 'abc'}}), 'en');
        expect(h.getUser).not.toHaveBeenCalled();
        expect(res.status).toBe(200);
        expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('en');
    });

    it('does not re-set NEXT_LOCALE when the request already carries it', async () => {
        h.getUser.mockResolvedValue({data: {user: {id: 'u1'}}});
        const res = await updateSession(req('/en/tracker', {headers: {cookie: 'NEXT_LOCALE=en'}}), 'en');
        expect(res.status).toBe(200);
        expect(res.cookies.get('NEXT_LOCALE')).toBeUndefined();
    });

    it('overwrites a stale NEXT_LOCALE', async () => {
        const res = await updateSession(req('/en/about', {headers: {cookie: 'NEXT_LOCALE=vi'}}), 'en');
        expect(res.cookies.get('NEXT_LOCALE')?.value).toBe('en');
    });

    it('sends no Set-Cookie on an action POST with a matching locale cookie', async () => {
        const res = await updateSession(
            req('/en/tracker/x', {method: 'POST', headers: {'next-action': 'abc', cookie: 'NEXT_LOCALE=en'}}),
            'en'
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('still gates POSTs without the next-action header', async () => {
        const res = await updateSession(req('/en/tracker/x', {method: 'POST'}), 'en');
        expect(h.getUser).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(307);
    });

    it('still gates GETs that carry a next-action header', async () => {
        const res = await updateSession(req('/en/tracker/x', {headers: {'next-action': 'abc'}}), 'en');
        expect(h.getUser).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(307);
    });
});
