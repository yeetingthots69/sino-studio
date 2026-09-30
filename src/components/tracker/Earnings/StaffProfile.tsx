'use client';

import Link from 'next/link';
import {Badge, Group, Table, Text, Title} from '@mantine/core';
import {IconArrowLeft} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {formatVnd} from '../earnings';
import type {Totals} from '../pay';
import MonthFilter from './MonthFilter';
import {Money} from './EarningsTable';
import styles from './Earnings.module.css';

export type StageRow = {
    id: string;
    /** Studio scope only. */
    project?: {name: string; archived: boolean};
    cut: string;
    type: {label: string; color: string};
    dates: string;
    earned: boolean;
    amount: number;
};

export type AdjustmentRow = {
    id: string;
    amount: number;
    reason: string;
    author: string;
    date: string;
    batch: boolean;
    reversal: boolean;
    reversed: boolean;
};

interface Props {
    staff: {name: string; email: string | null; strengths: string[]};
    totals: Totals;
    stages: StageRow[];
    adjustments: AdjustmentRow[];
    month: string;
    backHref: string;
    /** Project scope: the view tabs. */
    tabs?: React.ReactNode;
}

export default function StaffProfile({staff, totals, stages, adjustments, month, backHref, tabs}: Props) {
    const t = useDictionary().tracker.people;
    const withProject = stages.some((s) => s.project);

    return (
        <div className={styles.page}>
            <Group justify="space-between" mb={12}>
                <Link className={styles.back} href={`${backHref}?m=${month}`}>
                    <IconArrowLeft size={14}/> {t.back}
                </Link>
                {tabs}
            </Group>
            <div className={styles.toolbar}>
                <div>
                    <Title order={2}>{staff.name}</Title>
                    <Text size="sm" c="dimmed">{staff.email ?? t.noEmail}</Text>
                    {staff.strengths.length > 0 && (
                        <Group gap={4} mt={6}>
                            {staff.strengths.map((s) => <Badge key={s} variant="light" size="sm">{s}</Badge>)}
                        </Group>
                    )}
                </div>
                <MonthFilter month={month}/>
            </div>

            <div className={styles.totals}>
                {(['earned', 'pending', 'adjustments', 'total'] as const).map((k) => (
                    <div key={k} className={styles.stat}>
                        <Text size="xs" c="dimmed" tt="uppercase">{t[k]}</Text>
                        <Text fw={k === 'total' ? 700 : 500} size="lg">
                            {k === 'adjustments' ? <Money amount={totals[k]} signed/> : formatVnd(totals[k])}
                        </Text>
                    </div>
                ))}
            </div>

            <Title order={4} mt="xl" mb="sm">{t.stages}</Title>
            {stages.length === 0 ? <Text c="dimmed">{t.noStages}</Text> : (
                <Table.ScrollContainer minWidth={560}>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                {withProject && <Table.Th>{t.project}</Table.Th>}
                                <Table.Th>{t.cut}</Table.Th>
                                <Table.Th>{t.type}</Table.Th>
                                <Table.Th>{t.dates}</Table.Th>
                                <Table.Th>{t.status}</Table.Th>
                                <Table.Th className={styles.right}>{t.amount}</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {stages.map((s) => (
                                <Table.Tr key={s.id}>
                                    {withProject && (
                                        <Table.Td className={s.project?.archived ? styles.archived : undefined}>
                                            {s.project?.name}{s.project?.archived && ` (${t.archived})`}
                                        </Table.Td>
                                    )}
                                    <Table.Td>{s.cut}</Table.Td>
                                    <Table.Td>
                                        <span className={styles.swatch} style={{background: s.type.color}}/> {s.type.label}
                                    </Table.Td>
                                    <Table.Td>{s.dates}</Table.Td>
                                    <Table.Td>
                                        <Badge variant={s.earned ? 'filled' : 'outline'} color={s.earned ? 'green' : 'gray'} size="sm">
                                            {s.earned ? t.earned : t.pending}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td className={styles.right}>{formatVnd(s.amount)}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            )}

            <Title order={4} mt="xl" mb="sm">{t.adjustmentsTitle}</Title>
            {adjustments.length === 0 ? <Text c="dimmed">{t.noAdjustments}</Text> : (
                <Table.ScrollContainer minWidth={560}>
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th className={styles.right}>{t.amount}</Table.Th>
                                <Table.Th>{t.reason}</Table.Th>
                                <Table.Th>{t.author}</Table.Th>
                                <Table.Th>{t.date}</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {adjustments.map((a) => (
                                <Table.Tr key={a.id}>
                                    <Table.Td className={`${styles.right} ${a.reversed ? styles.struck : ''}`}>
                                        <Money amount={a.amount} signed/>
                                    </Table.Td>
                                    <Table.Td>
                                        <span className={a.reversed ? styles.struck : undefined}>{a.reason}</span>
                                        {a.batch && <Badge ml={6} size="xs" variant="light">{t.batch}</Badge>}
                                        {a.reversal && <Badge ml={6} size="xs" variant="outline" color="gray">{t.reversal}</Badge>}
                                        {a.reversed && <Badge ml={6} size="xs" variant="outline" color="gray">{t.reversed}</Badge>}
                                    </Table.Td>
                                    <Table.Td><Text size="sm" c="dimmed">{a.author}</Text></Table.Td>
                                    <Table.Td>{a.date}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Table.ScrollContainer>
            )}
        </div>
    );
}
