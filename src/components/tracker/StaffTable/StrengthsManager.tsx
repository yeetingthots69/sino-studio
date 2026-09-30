'use client';

import {useState, useTransition} from 'react';
import {ActionIcon, Button, Group, Stack, Switch, Text, TextInput, Tooltip} from '@mantine/core';
import {IconArrowDown, IconArrowUp, IconTrash} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {
    createStrength, deleteStrength, updateStrength, type ActionResult,
} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import styles from './StaffTable.module.css';

type Strength = Tables<'tracker_strengths'>;

export function useErrorText() {
    const {common, staff: {error: e}} = useDictionary().tracker;
    const byError: Partial<Record<string, string>> = {
        not_found: common.error.notFound,
        network: common.error.network,
        duplicate: e.duplicate,
        invalid: e.invalid,
        in_use: e.inUse,
    };
    return (res: ActionResult<unknown>) => (res.ok ? null : byError[res.error] ?? common.error.generic);
}

/** Strengths list ("Điểm mạnh"): add / rename / delete / all-rounder / order. Each change saves immediately. */
export default function StrengthsManager({strengths}: {strengths: Strength[]}) {
    const t = useDictionary().tracker.staff;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState('');
    const [pending, startTransition] = useTransition();
    // bumped after a failed rename so the uncontrolled inputs remount with the saved label
    const [resets, setResets] = useState(0);

    const run = (...calls: (() => Promise<ActionResult<unknown>>)[]) => startTransition(async () => {
        const results = await Promise.all(calls.map((c) => c()));
        setError(errorText(results.find((r) => !r.ok) ?? {ok: true, data: undefined}));
    });

    // Swap with the neighbour, then renumber in steps of 10 (only rows whose value changes are written).
    const move = (i: number, delta: -1 | 1) => {
        const list = [...strengths];
        [list[i], list[i + delta]] = [list[i + delta], list[i]];
        run(...list.flatMap((s, j) => (s.sort_order === (j + 1) * 10
            ? []
            : [() => updateStrength({id: s.id, sort_order: (j + 1) * 10})])));
    };

    const rename = (id: string, label: string) => startTransition(async () => {
        const res = await updateStrength({id, label});
        setError(errorText(res));
        if (!res.ok) setResets((n) => n + 1);
    });

    const add = () => {
        const trimmed = label.trim();
        if (!trimmed) return;
        const sort_order = strengths.reduce((max, s) => Math.max(max, s.sort_order), 0) + 10;
        startTransition(async () => {
            const res = await createStrength({label: trimmed, all_rounder: false, sort_order});
            setError(errorText(res));
            if (res.ok) setLabel('');
        });
    };

    return (
        <Stack gap="xs">
            {strengths.length === 0 && <Text c="dimmed" size="sm">{t.noStrengths}</Text>}
            {strengths.map((s, i) => (
                <div key={s.id} className={styles.strengthRow}>
                    <ActionIcon variant="subtle" color="gray" aria-label={t.moveUp} disabled={pending || i === 0} onClick={() => move(i, -1)}>
                        <IconArrowUp size={16}/>
                    </ActionIcon>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t.moveDown}
                        disabled={pending || i === strengths.length - 1}
                        onClick={() => move(i, 1)}
                    >
                        <IconArrowDown size={16}/>
                    </ActionIcon>
                    <TextInput
                        key={`${s.id}:${s.label}:${resets}`}
                        className={styles.grow}
                        aria-label={`${t.strengths}: ${s.label}`}
                        maxLength={40}
                        defaultValue={s.label}
                        onBlur={(e) => {
                            const next = e.currentTarget.value.trim();
                            if (next && next !== s.label) rename(s.id, next);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                    <Tooltip label={t.allRounderHint}>
                        <Switch
                            label={t.allRounder}
                            checked={s.all_rounder}
                            disabled={pending}
                            onChange={(e) => {
                                const all_rounder = e.currentTarget.checked;
                                run(() => updateStrength({id: s.id, all_rounder}));
                            }}
                        />
                    </Tooltip>
                    <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={t.delete}
                        disabled={pending}
                        onClick={() => window.confirm(t.deleteConfirm) && run(() => deleteStrength({id: s.id}))}
                    >
                        <IconTrash size={16}/>
                    </ActionIcon>
                </div>
            ))}
            <Group mt="sm" align="flex-end">
                <TextInput
                    className={styles.grow}
                    label={t.newStrength}
                    maxLength={40}
                    value={label}
                    onChange={(e) => setLabel(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                />
                <Button onClick={add} loading={pending} disabled={!label.trim()}>{t.add}</Button>
            </Group>
            {error && <Text c="red" size="sm">{error}</Text>}
        </Stack>
    );
}
