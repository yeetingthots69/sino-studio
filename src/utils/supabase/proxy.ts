import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';
import type {Locale} from '@/i18n/config';
import type {Database} from '@/types/database.types';

const TRACKER_RE = /^\/(en|vi)\/tracker(\/|$)/;
const LOGIN_RE = /^\/(en|vi)\/tracker\/login$/;

export function isLoginPath(pathname: string): boolean {
    return LOGIN_RE.test(pathname);
}

export function isProtectedPath(pathname: string): boolean {
    return TRACKER_RE.test(pathname) && !isLoginPath(pathname);
}

/**
 * Refreshes the Supabase session for tracker routes and gates them.
 * Public site routes skip the Auth round-trip entirely.
 */
export async function updateSession(request: NextRequest, locale: Locale): Promise<NextResponse> {
    const {pathname, search} = request.nextUrl;
    let response = NextResponse.next({request});
    let authHeaders: Record<string, string> = {};

    const finish = (res: NextResponse) => {
        // Only when changed: any Set-Cookie on an action response makes Next drop the client router cache.
        if (request.cookies.get('NEXT_LOCALE')?.value !== locale) res.cookies.set('NEXT_LOCALE', locale, {path: '/'});
        return res;
    };

    const protectedPath = isProtectedPath(pathname);
    const loginPath = isLoginPath(pathname);
    if (!protectedPath && !loginPath) return finish(response);
    // Server actions authenticate themselves (getUser in writeRow + RLS); skip the extra Auth round trip.
    if (protectedPath && request.method === 'POST' && request.headers.has('next-action')) return finish(response);

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet, headers) {
                    cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));
                    response = NextResponse.next({request});
                    cookiesToSet.forEach(({name, value, options}) => response.cookies.set(name, value, options));
                    authHeaders = {...authHeaders, ...headers};
                    Object.entries(authHeaders).forEach(([k, v]) => response.headers.set(k, v));
                },
            },
        }
    );

    const {data: {user}} = await supabase.auth.getUser();

    const redirectTo = (url: URL) => {
        const redirect = NextResponse.redirect(url);
        response.cookies.getAll().forEach((c) => redirect.cookies.set(c.name, c.value, c));
        Object.entries(authHeaders).forEach(([k, v]) => redirect.headers.set(k, v));
        return finish(redirect);
    };

    if (!user && protectedPath) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/tracker/login`;
        url.search = '';
        url.searchParams.set('next', pathname + search);
        return redirectTo(url);
    }

    if (user && loginPath) {
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}/tracker`;
        url.search = '';
        return redirectTo(url);
    }

    return finish(response);
}
