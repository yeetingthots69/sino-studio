'use client';

import {ActionIcon, Button, ColorInput, Group, NumberInput, Table, Text, TextInput, Tooltip} from '@mantine/core';
import {IconArrowDown, IconArrowUp, IconLock, IconPlus, IconTrash} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {pctHundredths, pctTotalOk} from '@/components/tracker/pay';
import {insertAt, moveRow} from './sortOrder';
import styles from './WorkTypesEditor.module.css';

export type EditorType = {
    key: string;
    id?: string;
    code: string;
    label: string;
    color: string;
    pay_pct: number | string; // NumberInput yields a string while a decimal is being typed
    sort_order: number;
    used: boolean;
};

const totalOk = (rows: EditorType[]) => pctTotalOk(rows.map((r) => Number(r.pay_pct) || 0));
const codesUnique = (rows: EditorType[]) => new Set(rows.map((r) => r.code.trim())).size === rows.length;
/** Save is allowed only when this holds. */
export const typesValid = (rows: EditorType[]) => totalOk(rows) && codesUnique(rows);

// key '' = new row; commit() gives it a key at click time (no impure calls during render).
const BLANK: EditorType = {key: '', code: '', label: '', color: '#888888', pay_pct: 0, sort_order: 0, used: false};

export default function WorkTypesEditor({value, onChange}: {value: EditorType[]; onChange: (v: EditorType[]) => void}) {
    const t = useDictionary().tracker.workTypesEditor;
    const commit = (rows: EditorType[]) =>
        onChange(rows.map((r) => (r.key ? r : {...r, key: crypto.randomUUID()})));
    const set = (i: number, patch: Partial<EditorType>) =>
        onChange(value.map((row, j) => (j === i ? {...row, ...patch} : row)));
    const total = value.reduce((s, r) => s + pctHundredths(Number(r.pay_pct) || 0), 0) / 100;
    const ok = totalOk(value);
    const unique = codesUnique(value);

    const icon = (label: string, next: EditorType[] | null, node: React.ReactNode, hint = label) => (
        // span wrapper: a disabled button fires no mouse events, so the hint would never show
        <Tooltip label={next ? label : hint}>
            <span className={styles.iconWrap}>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={next ? label : hint}
                    disabled={!next}
                    onClick={() => next && commit(next)}
                >
                    {node}
                </ActionIcon>
            </span>
        </Tooltip>
    );

    return (
        <div>
            <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing={4}>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th/>
                            <Table.Th>{t.code}</Table.Th>
                            <Table.Th>{t.label}</Table.Th>
                            <Table.Th>{t.color}</Table.Th>
                            <Table.Th>{t.payPct}</Table.Th>
                            <Table.Th/>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {value.map((row, i) => (
                            <Table.Tr key={row.key}>
                                <Table.Td>
                                    <div className={styles.buttons}>
                                        {icon(t.moveUp, moveRow(value, i, -1), <IconArrowUp size={16}/>, row.used ? t.locked : t.moveUp)}
                                        {icon(t.moveDown, moveRow(value, i, 1), <IconArrowDown size={16}/>, row.used ? t.locked : t.moveDown)}
                                    </div>
                                </Table.Td>
                                <Table.Td className={styles.code}>
                                    <TextInput
                                        aria-label={t.code}
                                        required
                                        maxLength={20}
                                        value={row.code}
                                        onChange={(e) => set(i, {code: e.currentTarget.value})}
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <TextInput
                                        aria-label={t.label}
                                        required
                                        maxLength={80}
                                        value={row.label}
                                        onChange={(e) => set(i, {label: e.currentTarget.value})}
                                    />
                                </Table.Td>
                                <Table.Td className={styles.color}>
                                    <ColorInput
                                        aria-label={t.color}
                                        format="hex"
                                        required
                                        value={row.color}
                                        onChange={(color) => set(i, {color})}
                                    />
                                </Table.Td>
                                <Table.Td className={styles.pct}>
                                    <NumberInput
                                        aria-label={t.payPct}
                                        required
                                        min={0}
                                        max={100}
                                        decimalScale={2}
                                        suffix="%"
                                        value={row.pay_pct}
                                        onChange={(pay_pct) => set(i, {pay_pct})}
                                    />
                                </Table.Td>
                                <Table.Td>
                                    <div className={styles.buttons}>
                                        {icon(t.insertBelow, insertAt(value, i + 1, BLANK), <IconPlus size={16}/>, t.noRoom)}
                                        {row.used ? (
                                            <Tooltip label={t.locked}>
                                                <span className={styles.lock} role="img" aria-label={t.locked}><IconLock size={16}/></span>
                                            </Tooltip>
                                        ) : (
                                            icon(t.delete, value.length > 1 ? value.filter((_, j) => j !== i) : null, <IconTrash size={16}/>, t.lastType)
                                        )}
                                    </div>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
            <Group justify="space-between" mt="xs">
                <Button
                    variant="default"
                    size="xs"
                    leftSection={<IconPlus size={14}/>}
                    onClick={() => commit(insertAt(value, value.length, BLANK)!)}
                >
                    {t.add}
                </Button>
                <Text size="sm" c={ok ? undefined : 'red'}>
                    {t.total}: {total}%{!ok && ` · ${t.totalHint}`}
                </Text>
            </Group>
            {!unique && <Text size="sm" c="red" mt={4}>{t.error.duplicate}</Text>}
        </div>
    );
}
