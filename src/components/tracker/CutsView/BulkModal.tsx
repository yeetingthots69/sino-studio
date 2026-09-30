'use client';

import {useState} from 'react';
import {Button, CloseButton, Group, Modal, SegmentedControl, Select, Text, Textarea, TextInput} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {addAdjustments} from '@/app/[locale]/tracker/actions';
import {formatVnd} from '../earnings';
import {useRealtimeBusy} from '../useRealtimeRefresh';
import {amountOk, formatAmountInput, netByStaff, parseAmount} from './cutsViewHelpers';
import type {Cut, Staff, WorkType} from './CutsView';
import styles from './CutsView.module.css';

export type BulkStage = {key: string; cut: Cut; type: WorkType; assigneeId: string | null};

type Sign = '1' | '-1';
type Row = {id: number; stageKey: string; staffId: string | null; sign: Sign; amount: string; reason: string; touched: boolean};

interface Props {
    /** Made when the modal opens; every submit (incl. a retry after a lost response) reuses it. */
    opId: string;
    projectId: string;
    stages: BulkStage[];
    /** Active staff (the DB refuses archived staff on new entries). */
    staff: Staff[];
    onClose: () => void;
    onDone: (inserted: number) => void;
}

const MIN_REASON = 3;
/** Signed amount of a row (0 while the typed amount is invalid); the same value feeds the preview and the submit. */
const amountOf = (r: Row) => {
    const n = parseAmount(r.amount);
    return amountOk(n) ? Number(r.sign) * n : 0;
};

/** Bulk bonus/penalty (N3): one row per stage + helper rows, mixed signs, one atomic addAdjustments call. */
export default function BulkModal({opId, projectId, stages, staff, onClose, onDone}: Props) {
    const {cuts: t, common} = useDictionary().tracker;
    const active = new Set(staff.map((s) => s.id));
    const [rows, setRows] = useState<Row[]>(() => stages.map((s, i) => ({
        id: i,
        stageKey: s.key,
        staffId: s.assigneeId && active.has(s.assigneeId) ? s.assigneeId : null,
        sign: '1',
        amount: '',
        reason: '',
        touched: false,
    })));
    const [allSign, setAllSign] = useState<Sign>('1');
    const [allAmount, setAllAmount] = useState('');
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // a 'network' result may have been saved: rows lock, only a same-op_id retry or closing is allowed
    const [stuck, setStuck] = useState(false);
    useRealtimeBusy(true); // mounted only while open

    const stageByKey = new Map(stages.map((s) => [s.key, s]));
    const stageLabel = (key: string) => {
        const s = stageByKey.get(key);
        return s ? `${s.cut.code} · ${s.type.code}` : key;
    };
    const staffOptions = staff.map((s) => ({value: s.id, label: s.name}));
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));
    const net = netByStaff(rows.map((r) => ({staff_id: r.staffId, amount: amountOf(r)})));

    const patch = (id: number, p: Partial<Row>) => {
        setRows((rs) => rs.map((r) => (r.id === id ? {...r, ...p} : r)));
        setError(null);
    };

    const submit = async () => {
        const rowReasonOk = (r: Row) => !r.reason.trim() || r.reason.trim().length >= MIN_REASON;
        // row amount errors show once that row was touched or a submit was attempted (not on a fresh helper row)
        setRows((rs) => rs.map((r) => ({...r, touched: true})));
        const valid = rows.length > 0 && reason.trim().length >= MIN_REASON && rows.every((r) =>
            r.staffId && amountOk(parseAmount(r.amount)) && rowReasonOk(r));
        if (!valid) {
            setError(t.bulkInvalid);
            return;
        }
        setBusy(true);
        setError(null);
        const r = await addAdjustments({
            op_id: opId,
            project_id: projectId,
            reason: reason.trim(),
            entries: rows.map((row) => {
                const s = stageByKey.get(row.stageKey)!;
                return {
                    cut_id: s.cut.id,
                    work_type_id: s.type.id,
                    staff_id: row.staffId!,
                    amount: amountOf(row),
                    ...(row.reason.trim() ? {reason: row.reason.trim()} : {}),
                };
            }),
        }).catch(() => ({ok: false, error: 'network'}) as const);
        setBusy(false);
        setStuck(!r.ok && r.error === 'network');
        if (r.ok) onDone(r.data.length);
        else setError(r.error === 'invalid' ? t.adjInvalid : r.error === 'network' ? t.retryHint : common.error.generic);
    };

    return (
        <Modal
            opened
            onClose={() => !busy && onClose()}
            title={t.bulk}
            size="xl"
            closeOnEscape={!busy}
            closeOnClickOutside={!busy}
            withCloseButton={!busy}
        >
            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <fieldset className={styles.fieldset} disabled={stuck || busy}>
                <div className={styles.applyAll}>
                    <SegmentedControl
                        value={allSign}
                        onChange={(v) => setAllSign(v as Sign)}
                        data={[{value: '1', label: t.bonus}, {value: '-1', label: t.penalty}]}
                    />
                    <TextInput
                        aria-label={t.amount}
                        placeholder={t.amount}
                        inputMode="numeric"
                        value={allAmount}
                        onChange={(e) => setAllAmount(e.currentTarget.value)}
                        onBlur={() => setAllAmount(formatAmountInput(allAmount))}
                        error={allAmount !== '' && !amountOk(parseAmount(allAmount)) ? t.amountPositive : undefined}
                    />
                    <Button
                        variant="default"
                        disabled={!amountOk(parseAmount(allAmount))}
                        onClick={() => {
                            setRows((rs) => rs.map((r) => ({...r, sign: allSign, amount: formatAmountInput(allAmount), touched: true})));
                            setError(null);
                        }}
                    >
                        {t.applyAll}
                    </Button>
                </div>

                <div>
                    {rows.map((r) => (
                        <div key={r.id} className={styles.bulkRow}>
                            {r.id < stages.length ? (
                                <span className={`${styles.stageTag} ${styles.colStage}`}>{stageLabel(r.stageKey)}</span>
                            ) : (
                                <Select
                                    className={styles.colStage}
                                    aria-label={t.stage}
                                    allowDeselect={false}
                                    data={stages.map((s) => ({value: s.key, label: stageLabel(s.key)}))}
                                    value={r.stageKey}
                                    onChange={(v) => v && patch(r.id, {stageKey: v})}
                                />
                            )}
                            <Select
                                className={styles.colPerson}
                                aria-label={`${t.person} · ${stageLabel(r.stageKey)}`}
                                placeholder={t.person}
                                searchable
                                data={staffOptions}
                                value={r.staffId}
                                onChange={(v) => patch(r.id, {staffId: v})}
                            />
                            <SegmentedControl
                                className={styles.colSign}
                                value={r.sign}
                                onChange={(v) => patch(r.id, {sign: v as Sign})}
                                data={[{value: '1', label: t.bonus}, {value: '-1', label: t.penalty}]}
                            />
                            <TextInput
                                className={styles.colAmount}
                                aria-label={`${t.amount} · ${stageLabel(r.stageKey)}`}
                                placeholder={t.amount}
                                inputMode="numeric"
                                value={r.amount}
                                onChange={(e) => patch(r.id, {amount: e.currentTarget.value})}
                                onBlur={() => patch(r.id, {amount: formatAmountInput(r.amount), touched: true})}
                                error={r.touched && !amountOk(parseAmount(r.amount)) ? t.amountPositive : undefined}
                            />
                            <TextInput
                                className={styles.colReason}
                                aria-label={`${t.rowReason} · ${stageLabel(r.stageKey)}`}
                                placeholder={t.rowReason}
                                value={r.reason}
                                maxLength={500}
                                onChange={(e) => patch(r.id, {reason: e.currentTarget.value})}
                            />
                            <CloseButton
                                aria-label={t.removeRow}
                                disabled={rows.length === 1}
                                onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                            />
                        </div>
                    ))}
                </div>

                <Group>
                    <Button
                        variant="subtle"
                        onClick={() => setRows((rs) => [...rs, {
                            id: Math.max(stages.length, ...rs.map((x) => x.id + 1)),
                            stageKey: stages[0].key,
                            staffId: null,
                            sign: '1',
                            amount: '',
                            reason: '',
                            touched: false,
                        }])}
                    >
                        {t.addHelper}
                    </Button>
                </Group>

                <Textarea
                    label={t.batchReason}
                    value={reason}
                    onChange={(e) => {
                        setReason(e.currentTarget.value);
                        setError(null);
                    }}
                    autosize
                    minRows={2}
                    maxLength={500}
                />

                </fieldset>

                {net.length > 0 && (
                    <Text className={styles.preview}>
                        {t.preview}:{' '}
                        {net.map(([id, n]) => `${nameOf.get(id) ?? t.unknownStaff} ${formatVnd(n, true)}`).join(' · ')}
                    </Text>
                )}
                {error && <Text c="red" size="sm" role="alert">{error}</Text>}
                <Group justify="flex-end">
                    <Button variant="default" disabled={busy} onClick={onClose}>{common.cancel}</Button>
                    <Button type="submit" loading={busy}>{stuck ? t.retry : t.apply}</Button>
                </Group>
            </form>
        </Modal>
    );
}
