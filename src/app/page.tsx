import {redirect} from 'next/navigation';
import {cookies} from 'next/headers';
import {LOCALES, DEFAULT_LOCALE} from '@/i18n/config';

export default async function RootPage() {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
    const locale = cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
        ? cookieLocale
        : DEFAULT_LOCALE;
    redirect(`/${locale}`);
}