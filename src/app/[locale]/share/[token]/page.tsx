import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {isValidLocale, DEFAULT_LOCALE} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {addDays, defaultMonth, isValidMonth, monthRange} from '@/components/tracker/dates';
import {loadShare} from '@/lib/tracker/shareData';
import ScheduleGrid from '@/components/tracker/ScheduleGrid/ScheduleGrid';
import AutoRefresh from '@/components/tracker/ScheduleGrid/AutoRefresh';
import styles from './share.module.css';

export const dynamic = 'force-dynamic';

interface Props {
    params: Promise<{locale: string; token: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(isValidLocale(locale) ? locale : DEFAULT_LOCALE);
    return {title: dict.tracker.share.page.title, robots: {index: false, follow: false}, referrer: 'no-referrer'};
}

export default async function SharePage({params, searchParams}: Props) {
    const {locale, token} = await params;
    const {m} = await searchParams;
    const month = isValidMonth(m) ? m : defaultMonth();
    const [dto, dict] = await Promise.all([
        loadShare(token, month),
        getDictionary(isValidLocale(locale) ? locale : DEFAULT_LOCALE),
    ]);
    if (!dto) notFound();

    const t = dict.tracker.share.page;
    const {start, end} = monthRange(month);
    const href = (mm: string) => `/${locale}/share/${token}?m=${mm}`;

    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <p className={styles.kicker}>{t.title}</p>
                <h1 className={styles.title}>{dto.project.name}</h1>
                <p className={styles.hint}>{t.readOnly}</p>
            </header>
            <ScheduleGrid
                dto={dto}
                labels={t}
                monthLabel={t.month.replace('{m}', String(Number(month.slice(5)))).replace('{y}', month.slice(0, 4))}
                prevHref={href(addDays(start, -1).slice(0, 7))}
                nextHref={href(addDays(end, 1).slice(0, 7))}
            />
            <AutoRefresh/>
        </main>
    );
}
