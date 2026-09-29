import {NextResponse, type NextRequest} from 'next/server';
import createClient from '@/utils/supabase/server';
import {DEFAULT_LOCALE, isValidLocale} from '@/i18n/config';

const NEXT_RE = /^\/(en|vi)\/tracker(\/|\?|$)/;

export async function GET(request: NextRequest): Promise<NextResponse> {
    const {searchParams, origin} = request.nextUrl;
    const code = searchParams.get('code');

    const next = searchParams.get('next') ?? '';
    const validNext = NEXT_RE.test(next);
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value ?? '';
    const locale = validNext
        ? next.split('/')[1]
        : isValidLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
    const login = `${origin}/${locale}/tracker/login`;

    if (!code) return NextResponse.redirect(`${login}?error=auth`);

    const supabase = await createClient();
    const {data, error} = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return NextResponse.redirect(`${login}?error=auth`);

    if (!data.user.email?.toLowerCase().endsWith('@sinostudio.vn')) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${login}?error=domain`);
    }

    return NextResponse.redirect(`${origin}${validNext ? next : `/${locale}/tracker`}`);
}
