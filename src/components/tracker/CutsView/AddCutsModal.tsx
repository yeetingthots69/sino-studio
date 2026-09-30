'use client';

import {useState} from 'react';
import {Button, Group, Modal, NumberInput, Text} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createCuts} from '@/app/[locale]/tracker/actions';
import {fill} from '../GanttBoard/GanttBoard';
import styles from './CutsView.module.css';

interface Props {
    opened: boolean;
    projectId: string;
    onClose: () => void;
    onDone: (inserted: number) => void;
}

/** "Thêm cut": C{from}…C{to} (+ optional budget) → createCuts; existing codes are skipped by the action. */
export default function AddCutsModal({opened, projectId, onClose, onDone}: Props) {
    const {cuts: t, common} = useDictionary().tracker;
    const [from, setFrom] = useState<number | string>(1);
    const [to, setTo] = useState<number | string>(10);
    const [budget, setBudget] = useState<number | string>('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const valid = typeof from === 'number' && typeof to === 'number'
        && Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to >= from && to - from < 200;

    const submit = async () => {
        if (!valid) {
            setError(t.invalidRange);
            return;
        }
        setBusy(true);
        setError(null);
        const r = await createCuts({
            project_id: projectId,
            from,
            to,
            ...(typeof budget === 'number' ? {budget} : {}),
        }).catch(() => ({ok: false, error: 'network'}) as const);
        setBusy(false);
        if (r.ok) onDone(r.data.length);
        else setError(r.error === 'invalid' ? t.invalidRange : r.error === 'network' ? common.error.network : common.error.generic);
    };

    const numberProps = {allowDecimal: false, allowNegative: false, hideControls: true} as const;
    return (
        <Modal opened={opened} onClose={onClose} title={t.addCutsTitle}>
            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <Group grow>
                    <NumberInput label={t.from} value={from} onChange={setFrom} min={1} max={99999} data-autofocus {...numberProps}/>
                    <NumberInput label={t.to} value={to} onChange={setTo} min={1} max={99999} {...numberProps}/>
                </Group>
                <NumberInput
                    label={t.addBudget}
                    value={budget}
                    onChange={setBudget}
                    min={0}
                    max={1e10}
                    thousandSeparator="."
                    decimalSeparator=","
                    {...numberProps}
                />
                <Text size="sm" c="dimmed">{fill(t.addCutsHint, {from: String(from), to: String(to)})}</Text>
                {error && <Text c="red" size="sm" role="alert">{error}</Text>}
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>{common.cancel}</Button>
                    <Button type="submit" loading={busy}>{t.addCuts}</Button>
                </Group>
            </form>
        </Modal>
    );
}
