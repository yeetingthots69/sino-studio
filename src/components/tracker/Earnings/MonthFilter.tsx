'use client';

import {usePathname, useRouter} from 'next/navigation';
import {ActionIcon, Button} from '@mantine/core';
import {IconChevronLeft, IconChevronRight} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {addDays, defaultMonth, monthRange} from '../dates';
import {fill} from '../GanttBoard/GanttBoard';
import styles from './Earnings.module.css';

/** `?m=YYYY-MM` month stepper plus an "all time" toggle (`?m=all`). */
export default function MonthFilter({month}: {month: string}) {
    const {board, people: t} = useDictionary().tracker;
    const router = useRouter();
    const pathname = usePathname();
    const go = (m: string) => router.push(`${pathname}?m=${m}`);
    const isAll = month === 'all';
    // From "all", step from the current month; read the clock only on click (not during render).
    const step = (dir: -1 | 1) => {
        const {start, end} = monthRange(isAll ? defaultMonth() : month);
        go((dir < 0 ? addDays(start, -1) : addDays(end, 1)).slice(0, 7));
    };

    return (
        <div className={styles.monthFilter}>
            <ActionIcon variant="default" size="lg" aria-label={board.prevMonth} onClick={() => step(-1)}>
                <IconChevronLeft size={16}/>
            </ActionIcon>
            <span className={styles.monthLabel}>
                {isAll ? t.allTime : fill(board.month, {m: Number(month.slice(5)), y: month.slice(0, 4)})}
            </span>
            <ActionIcon variant="default" size="lg" aria-label={board.nextMonth} onClick={() => step(1)}>
                <IconChevronRight size={16}/>
            </ActionIcon>
            <Button variant={isAll ? 'filled' : 'default'} onClick={() => go(isAll ? defaultMonth() : 'all')}>
                {t.allTime}
            </Button>
        </div>
    );
}
