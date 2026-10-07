'use client';

import {useState, type CSSProperties, type ReactElement} from 'react';
import {Autocomplete, Button, NumberInput, Popover, Select, Switch, Text, UnstyledButton} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {normalizeCutCode} from '../cuts';
import {orderConflict, type TypeRule} from '../pipeline';
import {ddmm, isValidCutCode, parseDMY} from './boardHelpers';
import {fill, type Cut, type StageRow, type WorkType} from './GanttBoard';
import styles from './GanttBoard.module.css';

/** Cut mode also sends the picked staff and dates; the board supplies its own. */
export type CreateInput = {
    cut_code: string;
    work_type_id: string;
    /** New cut only: {phase of the chosen type: amount}. */
    budgets?: Record<string, number>;
    staff_id?: string;
    start_date?: string;
    end_date?: string;
    is_fix?: boolean;
};

type Stage = Pick<StageRow, 'id' | 'cut_id' | 'work_type_id' | 'start_date' | 'end_date' | 'is_fix'>;

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
    typeRule: TypeRule;
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
/** Work types grouped by phase, in first-appearance order (types arrive sorted by sort_order = phase order). */
function typeGroups(workTypes: WorkType[]): [string, WorkType[]][] {
    const groups = new Map<string, WorkType[]>();
    for (const w of workTypes) groups.set(w.phase_id, [...(groups.get(w.phase_id) ?? []), w]);
    return [...groups];
}

export default function CreateTaskPopover(props: Props) {
    const {opened, ghostStyle, target, cuts, workTypes, stages, typeRule, cutMode, describeConflict, onClose, onSubmit} = props;
    const t = useDictionary().tracker.board;
    const [code, setCode] = useState(cutMode?.cut.code ?? '');
    const [typeId, setTypeId] = useState<string | null>(cutMode?.workType.id ?? null);
    const [budget, setBudget] = useState<number | string>('');
    // fix of an existing stage (board only)
    const [fixOn, setFixOn] = useState(false);
    const fix = fixOn && !cutMode;
    const [pickedStaff, setStaffId] = useState<string | null>(null);
    // a person removed from the project meanwhile (realtime refresh) is no longer a valid pick
    const staffId = cutMode?.staff.some((s) => s.id === pickedStaff) ? pickedStaff : null;
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
    // stage tasks of the cut (fixes never take a stage); a fix picks among them, a stage task avoids them
    const used = new Set(cut ? stages.filter((s) => s.cut_id === cut.id && !s.is_fix).map((s) => s.work_type_id) : []);
    const pickable = (id: string) => (fix ? used.has(id) : !used.has(id));
    const type = typeId && pickable(typeId) ? typeId : null;
    const validCode = isValidCutCode(code);
    const validDates = !!start && !!end && end >= start;
    const noStage = fix && !!code && validCode && used.size === 0;
    // a fix has no date rule (D2)
    const conflict = !fix && cut && type && validDates
        ? orderConflict(stages, typeRule, {id: '', cut_id: cut.id, work_type_id: type, start_date: start, end_date: end, is_fix: false})
        : null;
    const message = error
        ?? (code && !validCode ? t.invalidCut : noStage ? t.fixNoStage : conflict && type ? describeConflict(conflict.task.id, type) : null);
    const ready = !!type && validCode && !conflict && (!fix || !!cut) && (!cutMode || (!!staffId && validDates));

    const submit = async () => {
        if (!ready || !type) return;
        setBusy(true);
        const err = await onSubmit({
            cut_code: code,
            work_type_id: type,
            budgets: !cut && !fix && typeof budget === 'number' ? {[workTypes.find((w) => w.id === type)!.phase_id]: budget} : undefined,
            ...(fix ? {is_fix: true} : {}),
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
                                description={code && validCode && !cut && !fix ? fill(t.create.newCut, {code}) : undefined}
                                comboboxProps={INSIDE}
                                openOnFocus={false}
                                maxDropdownHeight={180}
                                onDropdownOpen={() => setListOpen(true)}
                                onDropdownClose={() => setListOpen(false)}
                            />
                            <Switch
                                label={t.fixSwitch}
                                checked={fixOn}
                                onChange={(e) => {
                                    setFixOn(e.currentTarget.checked);
                                    setError(null);
                                }}
                            />
                            <div>
                                <Text size="sm" fw={500} mb={6}>{t.panel.type}</Text>
                                <div className={styles.typeGroups} role="radiogroup" aria-label={t.panel.type}>
                                    {typeGroups(workTypes).map(([phaseId, group]) => (
                                        <div key={phaseId} role="group" aria-label={typeRule.phaseName.get(phaseId)}>
                                            {typeRule.phaseName.size > 1 && (
                                                <Text size="xs" c="dimmed" mb={4}>{typeRule.phaseName.get(phaseId)}</Text>
                                            )}
                                            <div className={styles.typeGrid}>
                                                {group.map((w) => (
                                                    <UnstyledButton
                                                        key={w.id}
                                                        role="radio"
                                                        aria-checked={w.id === type}
                                                        disabled={!pickable(w.id)}
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
                                    ))}
                                </div>
                            </div>
                            {code && !cut && !fix && (
                                <NumberInput
                                    label={type && typeRule.phaseName.size > 1 ? `${t.create.budget} (${typeRule.phaseName.get(typeRule.phaseOf.get(type) ?? '') ?? ''})` : t.create.budget}
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
