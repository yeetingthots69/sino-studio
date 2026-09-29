import {NextRequest, NextResponse} from 'next/server';
import {DEFAULT_LOCALE, LOCALES, isValidLocale, type Locale} from '@/i18n/config';
import {updateSession} from '@/utils/supabase/proxy';

function getLocale(request: NextRequest): Locale {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (cookieLocale && isValidLocale(cookieLocale)) {
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

export async function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl;

    const pathLocale = LOCALES.find(
        locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    if (pathLocale) {
        return updateSession(request, pathLocale);
    }

    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;

    const response = NextResponse.redirect(url);
    if (request.cookies.get('NEXT_LOCALE')?.value !== locale) response.cookies.set('NEXT_LOCALE', locale, {path: '/'});
    return response;
}

export const config = {
    matcher: [
        '/((?!_next|images|videos|music|fonts|favicon\.ico|sino-studio.*\.png|.*\.svg|.*\.ico|api|auth/|robots\.txt|sitemap\.xml).*)',
    ],
};
