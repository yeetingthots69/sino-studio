'use client';

import {useState} from 'react';
import {usePathname, useRouter} from 'next/navigation';
import {ActionIcon, Button, Popover, TextInput, UnstyledButton} from '@mantine/core';
import {MonthPicker} from '@mantine/dates';
import {IconChevronLeft, IconChevronRight} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {defaultMonth, isValidMonth, parseMonthInput, shiftMonth} from '../dates';
import {fill} from './GanttBoard';
import styles from './GanttBoard.module.css';

interface Props {
    month: string;
    /** Board-owned navigation (pending skeleton); falls back to a plain router push. */
    onNavigate?: (m: string) => void;
}

export default function MonthNav({month, onNavigate}: Props) {
    const t = useDictionary().tracker.board;
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [invalid, setInvalid] = useState(false);
    const go = (m: string) => {
        setOpen(false);
        if (onNavigate) onNavigate(m);
        else router.push(`${pathname}?m=${m}`);
    };
    const prev = shiftMonth(month, -1);
    const next = shiftMonth(month, 1);
    const label = fill(t.month, {m: Number(month.slice(5)), y: month.slice(0, 4)});
    const toggle = () => {
        setText('');
        setInvalid(false);
        setOpen((o) => !o);
    };

    return (
        <div className={styles.monthNav}>
            <ActionIcon variant="default" size="lg" aria-label={t.prevMonth} disabled={!isValidMonth(prev)} onClick={() => go(prev)}>
                <IconChevronLeft size={16}/>
            </ActionIcon>
            <Popover opened={open} onChange={setOpen} position="bottom" trapFocus withArrow shadow="md">
                <Popover.Target>
                    <UnstyledButton className={styles.monthLabel} aria-label={`${label} · ${t.jumpMonth}`} aria-expanded={open} onClick={toggle}>
                        {label}
                    </UnstyledButton>
                </Popover.Target>
                <Popover.Dropdown>
                    <TextInput
                        data-autofocus
                        size="sm"
                        mb="xs"
                        aria-label={t.jumpMonth}
                        placeholder={t.monthPlaceholder}
                        value={text}
                        error={invalid ? t.monthInvalid : undefined}
                        onChange={(e) => {
                            setText(e.currentTarget.value);
                            setInvalid(false);
                        }}
                        onKeyDown={(e) => {
                            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                            e.preventDefault();
                            const m = parseMonthInput(text);
                            if (m) go(m);
                            else setInvalid(true);
                        }}
                    />
                    <MonthPicker
                        value={`${month}-01`}
                        defaultDate={`${month}-01`}
                        minDate="2000-01-01"
                        maxDate="2099-12-01"
                        onChange={(v) => v && go(v.slice(0, 7))}
                    />
                    <Button variant="default" size="xs" fullWidth mt="xs" onClick={() => go(defaultMonth())}>
                        {t.thisMonth}
                    </Button>
                </Popover.Dropdown>
            </Popover>
            <ActionIcon variant="default" size="lg" aria-label={t.nextMonth} disabled={!isValidMonth(next)} onClick={() => go(next)}>
                <IconChevronRight size={16}/>
            </ActionIcon>
        </div>
    );
}
