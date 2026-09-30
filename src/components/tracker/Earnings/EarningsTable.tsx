'use client';

import {useState} from 'react';
import Link from 'next/link';
import {Group, Table, Text, Title, UnstyledButton} from '@mantine/core';
import {IconArrowDown, IconArrowUp} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {formatVnd} from '../earnings';
import {fill} from '../GanttBoard/GanttBoard';
import MonthFilter from './MonthFilter';
import type {Totals} from '../pay';
import styles from './Earnings.module.css';

export type EarningsRow = {
    id: string;
    name: string;
    archived: boolean;
    totals: Totals;
    /** Studio scope only. */
    projects?: {id: string; name: string; archived: boolean; total: number}[];
};

interface Props {
    rows: EarningsRow[];
    month: string;
    /** Rows link to `${hrefBase}/${id}?m=${month}`. */
    hrefBase: string;
    /** Project scope: its name (title) and the view tabs. */
    projectName?: string;
    tabs?: React.ReactNode;
}

export default function EarningsTable({rows, month, hrefBase, projectName, tabs}: Props) {
    const t = useDictionary().tracker.people;
    const [desc, setDesc] = useState(true);
    const sorted = rows.toSorted((a, b) => (desc ? b.totals.total - a.totals.total : a.totals.total - b.totals.total));
    const withProjects = rows.some((r) => r.projects);

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <Group gap="md">
                    <Title order={2}>{projectName ? fill(t.projectTitle, {project: projectName}) : t.title}</Title>
                    {tabs}
                </Group>
                <MonthFilter month={month}/>
            </div>
            {rows.length === 0 ? <Text c="dimmed">{t.empty}</Text> : (
            <Table.ScrollContainer minWidth={640}>
                <Table highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t.name}</Table.Th>
                            <Table.Th className={styles.right}>{t.earned}</Table.Th>
                            <Table.Th className={styles.right}>{t.pending}</Table.Th>
                            <Table.Th className={styles.right}>{t.adjustments}</Table.Th>
                            <Table.Th className={styles.right} aria-sort={desc ? 'descending' : 'ascending'}>
                                <UnstyledButton className={styles.sort} onClick={() => setDesc(!desc)} title={t.sortByTotal}>
                                    {t.total} {desc ? <IconArrowDown size={14}/> : <IconArrowUp size={14}/>}
                                </UnstyledButton>
                            </Table.Th>
                            {withProjects && <Table.Th>{t.byProject}</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {sorted.map((r) => (
                            <Table.Tr key={r.id} className={r.archived ? styles.archived : undefined}>
                                <Table.Td>
                                    <Link className={styles.link} href={`${hrefBase}/${r.id}?m=${month}`}>{r.name}</Link>
                                </Table.Td>
                                <Table.Td className={styles.right}>{formatVnd(r.totals.earned)}</Table.Td>
                                <Table.Td className={styles.right}>{formatVnd(r.totals.pending)}</Table.Td>
                                <Table.Td className={styles.right}>
                                    <Money amount={r.totals.adjustments} signed/>
                                </Table.Td>
                                <Table.Td className={`${styles.right} ${styles.strong}`}>{formatVnd(r.totals.total)}</Table.Td>
                                {withProjects && (
                                    <Table.Td>
                                        <div className={styles.breakdown}>
                                            {r.projects?.map((p) => (
                                                <span key={p.id} className={p.archived ? styles.archived : undefined}>
                                                    {p.name}{p.archived && ` (${t.archived})`}: {formatVnd(p.total)}
                                                </span>
                                            ))}
                                        </div>
                                    </Table.Td>
                                )}
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
            )}
        </div>
    );
}

/** Signed amount colored by sign (green bonus, red penalty). */
export function Money({amount, signed}: {amount: number; signed?: boolean}) {
    const cls = amount > 0 ? styles.plus : amount < 0 ? styles.minus : undefined;
    return <span className={cls}>{formatVnd(amount, signed)}</span>;
}
