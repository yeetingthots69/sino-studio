'use client';

import {useState} from 'react';
import {ActionIcon, Button, Group, Modal, MultiSelect, NumberInput, Select, Text, TextInput} from '@mantine/core';
import {IconTrash} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createPayPreset, deletePayPreset, setCutSplits} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {pctHundredths, pctTotalOk, stagePct} from '../pay';
import {fill} from '../GanttBoard/GanttBoard';
import {presetToDraft} from './cutsViewHelpers';
import type {Cut, WorkType} from './CutsView';
import styles from './CutsView.module.css';

export type PayPreset = Tables<'tracker_pay_presets'>;

interface Props {
    projectId: string;
    /** Sorted by code. */
    cuts: Cut[];
    /** By sort_order (presets map onto this order). */
    workTypes: WorkType[];
    presets: PayPreset[];
    /** Preselected cuts; with exactly one, the editor starts from its current split. */
    initialCutIds: string[];
    onClose: () => void;
    onDone: (text: string) => void;
}

/** Pay split for one or many cuts: edit, load a preset (by work-type position), save a preset, or reset to the project default. */
export default function SplitModal({projectId, cuts, workTypes, presets, initialCutIds, onClose, onDone}: Props) {
    const {cuts: t, common} = useDictionary().tracker;
    const [cutIds, setCutIds] = useState(initialCutIds);
    const [draft, setDraft] = useState<Record<string, number | string>>(() => {
        const one = initialCutIds.length === 1 ? cuts.find((c) => c.id === initialCutIds[0]) : undefined;
        return Object.fromEntries(workTypes.map((w) => [w.id, one ? stagePct(one, w) : w.pay_pct]));
    });
    const [preset, setPreset] = useState<{id: string; missing: string[]; extra: number[]} | null>(null);
    const [name, setName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const values = workTypes.map((w) => Number(draft[w.id]) || 0);
    const ok = pctTotalOk(values);
    const total = values.reduce((s, p) => s + pctHundredths(p), 0) / 100;
    const loaded = preset && presets.find((p) => p.id === preset.id);
    const fmt = (pcts: number[]) => `${pcts.join(' · ')}%`;

    const errorText = (e: string) =>
        e === 'pct_total' ? t.splitTotal : e === 'duplicate' ? t.presetDuplicate : e === 'network' ? common.error.network : common.error.generic;
    const run = async <T, >(p: Promise<{ok: true; data: T} | {ok: false; error: string}>) => {
        setBusy(true);
        setError(null);
        const r = await p.catch(() => ({ok: false, error: 'network'}) as const);
        setBusy(false);
        if (!r.ok) setError(errorText(r.error));
        return r.ok ? r.data : null;
    };

    const loadPreset = (id: string | null) => {
        setConfirmDelete(false);
        const p = presets.find((x) => x.id === id);
        if (!p) return setPreset(null);
        const {draft: next, missing, extra} = presetToDraft(p.pcts, workTypes);
        setDraft(next);
        setPreset({id: p.id, missing, extra});
    };

    const apply = async (split: Record<string, number> | null) => {
        const done = await run(setCutSplits({project_id: projectId, cut_ids: cutIds, pay_split: split}));
        if (done) onDone(fill(t.splitApplied, {n: done.length}));
    };

    const savePreset = async () => {
        const created = await run(createPayPreset({name: name.trim(), pcts: values, codes: workTypes.map((w) => w.code)}));
        if (created) {
            setName('');
            setPreset({id: created.id, missing: [], extra: []});
        }
    };

    const removePreset = async () => {
        if (!preset) return;
        if (await run(deletePayPreset({id: preset.id}))) {
            setPreset(null);
            setConfirmDelete(false);
        }
    };

    return (
        <Modal opened onClose={onClose} title={t.splitTitle} size="md">
            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    if (ok && cutIds.length) void apply(Object.fromEntries(workTypes.map((w, i) => [w.id, values[i]])));
                }}
            >
                <MultiSelect
                    label={t.splitCuts}
                    searchable
                    data={cuts.map((c) => ({value: c.id, label: c.code}))}
                    value={cutIds}
                    onChange={setCutIds}
                    maxDropdownHeight={240}
                />
                <Group gap="xs">
                    <Button size="compact-xs" variant="default" onClick={() => setCutIds(cuts.map((c) => c.id))}>{t.splitAllCuts}</Button>
                    {cutIds.length > 0 && (
                        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setCutIds([])}>{t.splitNoCuts}</Button>
                    )}
                </Group>

                <Group gap="xs" align="flex-end" wrap="nowrap">
                    <Select
                        style={{flex: 1}}
                        label={t.preset}
                        placeholder={presets.length ? t.presetPlaceholder : t.presetNone}
                        disabled={!presets.length}
                        clearable
                        data={presets.map((p) => ({value: p.id, label: `${p.name} (${fmt(p.pcts)})`}))}
                        value={preset?.id ?? null}
                        onChange={loadPreset}
                    />
                    {loaded && (confirmDelete ? (
                        <Button color="red" loading={busy} onClick={() => void removePreset()}>
                            {fill(t.presetConfirmDelete, {name: loaded.name})}
                        </Button>
                    ) : (
                        <ActionIcon size="lg" variant="default" aria-label={t.presetDelete} title={t.presetDelete} onClick={() => setConfirmDelete(true)}>
                            <IconTrash size={16}/>
                        </ActionIcon>
                    ))}
                </Group>
                {loaded && loaded.pcts.length !== workTypes.length && (
                    <Text size="sm" c="orange">
                        {fill(t.presetMismatch, {n: loaded.pcts.length, m: workTypes.length})}
                        {preset.extra.length > 0 && ` ${fill(t.presetExtra, {values: fmt(preset.extra)})}`}
                    </Text>
                )}

                {workTypes.map((w, i) => {
                    const from = loaded?.codes[i];
                    return (
                        <NumberInput
                            key={w.id}
                            size="xs"
                            label={`${w.code} · ${w.label}`}
                            description={from && from !== w.code ? fill(t.presetFrom, {code: from}) : undefined}
                            error={preset?.missing.includes(w.id) ? t.presetMissing : undefined}
                            min={0}
                            max={100}
                            decimalScale={2}
                            suffix="%"
                            value={draft[w.id] ?? 0}
                            onChange={(v) => setDraft((d) => ({...d, [w.id]: v}))}
                        />
                    );
                })}
                <Text size="sm" c={ok ? 'dimmed' : 'red'}>{t.total}: {total}%{!ok && ` · ${t.splitTotal}`}</Text>

                <Group gap="xs" align="flex-end" wrap="nowrap">
                    <TextInput
                        style={{flex: 1}}
                        size="xs"
                        label={t.presetName}
                        maxLength={60}
                        value={name}
                        onChange={(e) => setName(e.currentTarget.value)}
                    />
                    <Button size="xs" variant="default" disabled={!ok || !name.trim()} loading={busy} onClick={() => void savePreset()}>
                        {t.presetSave}
                    </Button>
                </Group>

                {error && <Text c="red" size="sm" role="alert">{error}</Text>}
                <Group justify="space-between">
                    <Button variant="subtle" color="gray" disabled={!cutIds.length || busy} onClick={() => void apply(null)}>{t.splitReset}</Button>
                    <Group gap="xs">
                        <Button variant="default" onClick={onClose}>{common.cancel}</Button>
                        <Button type="submit" disabled={!ok || !cutIds.length} loading={busy}>{fill(t.splitApply, {n: cutIds.length})}</Button>
                    </Group>
                </Group>
            </form>
        </Modal>
    );
}
