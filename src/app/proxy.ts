import {NextRequest, NextResponse} from 'next/server';

const LOCALES = ['en', 'vi'];
const DEFAULT_LOCALE = 'en';

function getLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && LOCALES.includes(cookieLocale)) {
        return cookieLocale;
    }

    const acceptLanguage = request.headers.get('Accept-Language') || '';
    const preferred = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim().toLowerCase());

    for (const lang of preferred) {
        if (lang.startsWith('vi')) return 'vi';
        if (lang.startsWith('en')) return 'en';
    }

    return DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl;

    const pathnameHasLocale = LOCALES.some(
        locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathnameHasLocale) {
        const response = NextResponse.next();
        const locale = pathname.split('/')[1];
        response.cookies.set('NEXT_LOCALE', locale, {path: '/'});
        return response;
    }

    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;

    const response = NextResponse.redirect(url);
    response.cookies.set('NEXT_LOCALE', locale, {path: '/'});
    return response;
}

export const config = {
    matcher: [
        '/((?!_next|images|videos|music|fonts|favicon\\.ico|sino-studio.*\\.png|.*\\.svg|.*\\.ico|api|robots\\.txt|sitemap\\.xml).*)',
    ],
};
