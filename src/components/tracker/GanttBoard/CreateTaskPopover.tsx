'use client';

import {useState, type CSSProperties, type ReactElement} from 'react';
import {Autocomplete, Button, NumberInput, Popover, Select, Text, UnstyledButton} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {normalizeCutCode} from '../cuts';
import {orderConflict} from '../pipeline';
import {ddmm, isValidCutCode, parseDMY} from './boardHelpers';
import {fill, type Cut, type StageRow, type WorkType} from './GanttBoard';
import styles from './GanttBoard.module.css';

/** Cut mode also sends the picked staff and dates; the board supplies its own. */
export type CreateInput = {
    cut_code: string;
    work_type_id: string;
    budget?: number;
    staff_id?: string;
    start_date?: string;
    end_date?: string;
};

type Stage = Pick<StageRow, 'id' | 'cut_id' | 'work_type_id' | 'start_date' | 'end_date'>;

interface Props {
    opened: boolean;
    /** Board: the drag ghost is the anchor. */
    ghostStyle?: CSSProperties;
    /** Cut mode: the anchor element (the cell's "+" button) instead of the ghost; must accept a ref. */
    target?: ReactElement;
    /** Fixed dates on the board; initial dates in cut mode. */
    start: string;
    end: string;
    /** Project cuts in natural order. */
    cuts: Cut[];
    workTypes: WorkType[];
    stages: Stage[];
    typeOrder: Map<string, number>;
    /** Cuts view: cut + type fixed, pick staff + dates. */
    cutMode?: {
        cut: Pick<Cut, 'id' | 'code'>;
        workType: Pick<WorkType, 'id' | 'code' | 'label'>;
        staff: {id: string; name: string}[];
    };
    describeConflict: (conflictId: string, typeId: string) => string;
    onClose: () => void;
    /** Resolves an error message, or null once the task was created. */
    onSubmit: (input: CreateInput) => Promise<string | null>;
}

// Dropdowns stay inside the popover: a portalled click would count as an outside click
const INSIDE = {withinPortal: false};

/** Create-task form anchored to the drag ghost (plan §3.4) or, in cut mode, to a Cuts-view cell (§3.5). */
export default function CreateTaskPopover(props: Props) {
    const {opened, ghostStyle, target, cuts, workTypes, stages, typeOrder, cutMode, describeConflict, onClose, onSubmit} = props;
    const t = useDictionary().tracker.board;
    const [code, setCode] = useState(cutMode?.cut.code ?? '');
    const [typeId, setTypeId] = useState<string | null>(cutMode?.workType.id ?? null);
    const [budget, setBudget] = useState<number | string>('');
    const [staffId, setStaffId] = useState<string | null>(null);
    // board: dates follow the ghost (props); cut mode: editable drafts seeded from props
    const [startDraft, setStart] = useState(props.start);
    const [endDraft, setEnd] = useState(props.end);
    const start = cutMode ? startDraft : props.start;
    const end = cutMode ? endDraft : props.end;
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Popover closes on Esc in a capture handler; while the cut list is open, Esc must close only the list
    const [listOpen, setListOpen] = useState(false);
    // Autocomplete hides an empty list (hiddenWhenEmpty); mirror its default filter
    const query = code.trim().toLowerCase();
    const listVisible = listOpen && cuts.some((c) => c.code.toLowerCase().includes(query));

    const cut = cutMode ? cutMode.cut : cuts.find((c) => c.code === code);
    const used = new Set(cut ? stages.filter((s) => s.cut_id === cut.id).map((s) => s.work_type_id) : []);
    const type = typeId && !used.has(typeId) ? typeId : null;
    const validCode = isValidCutCode(code);
    const validDates = !!start && !!end && end >= start;
    const conflict = cut && type && validDates
        ? orderConflict(stages, typeOrder, {id: '', cut_id: cut.id, work_type_id: type, start_date: start, end_date: end})
        : null;
    const message = error
        ?? (code && !validCode ? t.invalidCut : conflict && type ? describeConflict(conflict.id, type) : null);
    const ready = !!type && validCode && !conflict && (!cutMode || (!!staffId && validDates));

    const submit = async () => {
        if (!ready || !type) return;
        setBusy(true);
        const err = await onSubmit({
            cut_code: code,
            work_type_id: type,
            budget: !cut && typeof budget === 'number' ? budget : undefined,
            ...(cutMode && staffId ? {staff_id: staffId, start_date: start, end_date: end} : {}),
        });
        setBusy(false);
        setError(err);
    };

    return (
        <Popover opened={opened} onChange={(o) => !o && onClose()} position="bottom-start" width={300} trapFocus withArrow shadow="md" closeOnEscape={!listVisible}>
            <Popover.Target>
                {target ?? <div className={styles.ghost} style={ghostStyle}/>}
            </Popover.Target>
            <Popover.Dropdown>
                <form
                    className={styles.createForm}
                    onSubmit={(e) => {
                        e.preventDefault();
                        void submit();
                    }}
                >
                    {cutMode ? (
                        <>
                            <Text fw={600} size="sm">
                                {t.create.title} · {cutMode.cut.code} · {cutMode.workType.code} {cutMode.workType.label}
                            </Text>
                            <Select
                                label={t.panel.assignee}
                                data-autofocus
                                searchable
                                data={cutMode.staff.map((s) => ({value: s.id, label: s.name}))}
                                value={staffId}
                                onChange={(v) => {
                                    setStaffId(v);
                                    setError(null);
                                }}
                                comboboxProps={INSIDE}
                            />
                            <DateInput
                                label={t.panel.start}
                                value={start}
                                valueFormat="DD/MM/YYYY"
                                dateParser={parseDMY}
                                onChange={(v) => setStart(v ?? '')}
                                popoverProps={INSIDE}
                            />
                            <DateInput
                                label={t.panel.end}
                                value={end}
                                valueFormat="DD/MM/YYYY"
                                dateParser={parseDMY}
                                minDate={start || undefined}
                                onChange={(v) => setEnd(v ?? '')}
                                popoverProps={INSIDE}
                            />
                        </>
                    ) : (
                        <>
                            <Text fw={600} size="sm">
                                {t.create.title} · {ddmm(start)}–{ddmm(end)}
                            </Text>
                            <Autocomplete
                                label={t.create.cut}
                                placeholder={t.create.cutPlaceholder}
                                data-autofocus
                                data={cuts.map((c) => c.code)}
                                value={code}
                                onChange={(v) => {
                                    setCode(normalizeCutCode(v));
                                    setError(null);
                                }}
                                description={code && validCode && !cut ? fill(t.create.newCut, {code}) : undefined}
                                comboboxProps={INSIDE}
                                openOnFocus={false}
                                maxDropdownHeight={180}
                                onDropdownOpen={() => setListOpen(true)}
                                onDropdownClose={() => setListOpen(false)}
                            />
                            <div>
                                <Text size="sm" fw={500} mb={6}>{t.panel.type}</Text>
                                <div className={styles.typeGrid} role="radiogroup" aria-label={t.panel.type}>
                                    {workTypes.map((w) => (
                                        <UnstyledButton
                                            key={w.id}
                                            role="radio"
                                            aria-checked={w.id === type}
                                            disabled={used.has(w.id)}
                                            className={`${styles.typeChip} ${w.id === type ? styles.typeChipActive : ''}`}
                                            onClick={() => {
                                                setTypeId(w.id);
                                                setError(null);
                                            }}
                                        >
                                            <span className={styles.dot} style={{background: w.color}}/>{w.code}
                                        </UnstyledButton>
                                    ))}
                                </div>
                            </div>
                            {code && !cut && (
                                <NumberInput
                                    label={t.create.budget}
                                    value={budget}
                                    onChange={setBudget}
                                    min={0}
                                    max={1e10}
                                    allowDecimal={false}
                                    allowNegative={false}
                                    thousandSeparator="."
                                    decimalSeparator=","
                                />
                            )}
                        </>
                    )}
                    {message && <Text c="red" size="sm" role="alert">{message}</Text>}
                    <Button type="submit" loading={busy} disabled={!ready}>
                        {t.create.submit}
                    </Button>
                </form>
            </Popover.Dropdown>
        </Popover>
    );
}
