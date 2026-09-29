'use client';

import {usePathname, useRouter} from 'next/navigation';
import {ActionIcon} from '@mantine/core';
import {IconChevronLeft, IconChevronRight} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {addDays, monthRange} from '../dates';
import {fill} from './GanttBoard';
import styles from './GanttBoard.module.css';

export default function MonthNav({month}: {month: string}) {
    const t = useDictionary().tracker.board;
    const router = useRouter();
    const pathname = usePathname();
    const {start, end} = monthRange(month);
    const go = (m: string) => router.push(`${pathname}?m=${m}`);

    return (
        <div className={styles.monthNav}>
            <ActionIcon variant="default" size="lg" aria-label={t.prevMonth} onClick={() => go(addDays(start, -1).slice(0, 7))}>
                <IconChevronLeft size={16}/>
            </ActionIcon>
            <span className={styles.monthLabel}>{fill(t.month, {m: Number(month.slice(5)), y: month.slice(0, 4)})}</span>
            <ActionIcon variant="default" size="lg" aria-label={t.nextMonth} onClick={() => go(addDays(end, 1).slice(0, 7))}>
                <IconChevronRight size={16}/>
            </ActionIcon>
        </div>
    );
}
