'use client';

import Link from 'next/link';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import styles from './ProjectViewTabs.module.css';

interface Props {
    projectId: string;
    active: 'board' | 'cuts' | 'people';
    /** Viewed month (`YYYY-MM`), carried over as `?m=`. */
    month?: string;
}

const SUFFIX = {board: '', cuts: '/cuts', people: '/people'} as const;

/** "Lịch | Cut | Nhân sự" switcher shared by the project views. */
export default function ProjectViewTabs({projectId, active, month}: Props) {
    const t = useDictionary().tracker.views;
    const locale = useLocale();
    const query = month ? `?m=${month}` : '';
    return (
        <nav className={styles.tabs} aria-label={t.label}>
            {(Object.keys(SUFFIX) as (keyof typeof SUFFIX)[]).map((view) => (
                <Link
                    key={view}
                    href={`/${locale}/tracker/${projectId}${SUFFIX[view]}${query}`}
                    className={`${styles.tab} ${view === active ? styles.active : ''}`}
                    aria-current={view === active ? 'page' : undefined}
                >
                    {t[view]}
                </Link>
            ))}
        </nav>
    );
}
