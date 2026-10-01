'use client';

import {useState, type CSSProperties} from 'react';
import {useRouter} from 'next/navigation';
import {ActionIcon, Button, Checkbox, CloseButton, NumberInput, Popover, Text} from '@mantine/core';
import {IconPlus, IconTrash} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createTask, deleteCut, updateCut, type ActionResult} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {compareCutCodes} from '../cuts';
import {formatVnd} from '../earnings';
import {sanitizeLinks} from '../links';
import {cutSplit, payLines, pctHundredths, pctTotalOk, stagePct} from '../pay';
import {useRealtimeBusy} from '../useRealtimeRefresh';
import ProjectViewTabs from '../ProjectViewTabs/ProjectViewTabs';
import CreateTaskPopover, {type CreateInput} from '../GanttBoard/CreateTaskPopover';
import {ddmm, orderConflictText} from '../GanttBoard/boardHelpers';
import {fill} from '../GanttBoard/GanttBoard';
import AddCutsModal from './AddCutsModal';
import BulkModal, {type BulkStage} from './BulkModal';
import CutDrawer from './CutDrawer';
import {cellState, waitingFor} from './cutsViewHelpers';
import styles from './CutsView.module.css';

export type Cut = Tables<'tracker_cuts'>;
export type WorkType = Tables<'tracker_work_types'>;
export type Task = Pick<Tables<'tracker_tasks'>,
    'id' | 'project_id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'progress' | 'start_date' | 'end_date'>;
export type Staff = Pick<Tables<'tracker_staff'>, 'id' | 'name' | 'email' | 'archived_at'>;
export type Adjustment = Pick<Tables<'tracker_pay_adjustments'>,
    'id' | 'batch_id' | 'project_id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'amount' | 'reason' | 'reverses_id' | 'created_by' | 'created_at'>;
export type AuditRow = Tables<'tracker_audit_log'>;

interface Props {
    project: Tables<'tracker_projects'>;
    /** `?m=` of the board, passed through to the view tabs only. */
    month?: string;
    /** By sort_order. */
    workTypes: WorkType[];
    cuts: Cut[];
    /** Every task of the project. */
    tasks: Task[];
    staff: Staff[];
    adjustments: Adjustment[];
    /** Latest audit rows of the project's cuts and types, newest first. */
    audit: AuditRow[];
}

export const stageKey = (cutId: string, typeId: string) => `${cutId}:${typeId}`;

const todayICT = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date());

export default function CutsView({project, month, workTypes, cuts, tasks, staff, adjustments, audit}: Props) {
    const {cuts: t, board, common} = useDictionary().tracker;
    const router = useRouter();
    // success notices are neutral (role=status), errors red (role=alert)
    const [notice, setNoticeState] = useState<{text: string; ok: boolean} | null>(null);
    const setNotice = (text: string | null, ok = false) => setNoticeState(text === null ? null : {text, ok});
    const [drawer, setDrawer] = useState<{key: string; opId: string; opened: boolean} | null>(null);
    const [createAt, setCreateAt] = useState<{key: string; today: string} | null>(null);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [bulk, setBulk] = useState<{opId: string; keys: string[]} | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const cutList = [...cuts].sort((a, b) => compareCutCodes(a.code, b.code));
    const cutById = new Map(cuts.map((c) => [c.id, c]));
    const typeById = new Map(workTypes.map((w) => [w.id, w]));
    const typeOrder = new Map(workTypes.map((w) => [w.id, w.sort_order]));
    const cutCodes = new Map(cuts.map((c) => [c.id, c.code]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const activeStaff = staff.filter((s) => !s.archived_at);
    const taskByStage = new Map(tasks.map((x) => [stageKey(x.cut_id, x.work_type_id), x]));
    const lines = payLines(tasks, cuts, workTypes);
    const lineByTask = new Map(lines.map((l) => [l.task_id, l]));
    const adjByStage = new Map<string, Adjustment[]>();
    for (const a of adjustments) {
        const k = stageKey(a.cut_id, a.work_type_id);
        adjByStage.set(k, [...(adjByStage.get(k) ?? []), a]);
    }
    const typeTotals = new Map<string, number>();
    for (const l of lines) typeTotals.set(l.work_type_id, (typeTotals.get(l.work_type_id) ?? 0) + l.amount);
    const grandTotal = lines.reduce((s, l) => s + l.amount, 0);
    const cutsWithTasks = new Set(tasks.map((x) => x.cut_id));
    const staffName = (id: string) => staffById.get(id)?.name ?? t.unknownStaff;

    const errorText = (r: {error: string; detail?: string}, typeId?: string) => {
        switch (r.error) {
            case 'order_conflict':
                return orderConflictText(board, r.detail, typeId, tasks, cutCodes, typeById);
            case 'duplicate':
                return board.duplicateStage;
            case 'in_use':
                return t.cutInUse;
            case 'invalid':
                return t.invalid;
            case 'pct_total':
                return t.splitTotal;
            case 'not_found':
                return common.error.notFound;
            case 'network':
                return common.error.network;
            default:
                return common.error.generic;
        }
    };
    const run = <T, >(p: Promise<ActionResult<T>>) => p.catch(() => ({ok: false, error: 'network'}) as const);

    const createFromCell = async (input: CreateInput): Promise<string | null> => {
        if (!input.staff_id || !input.start_date || !input.end_date) return null;
        const r = await run(createTask({
            project_id: project.id,
            staff_id: input.staff_id,
            work_type_id: input.work_type_id,
            cut_code: input.cut_code,
            start_date: input.start_date,
            end_date: input.end_date,
        }));
        if (!r.ok) return errorText(r, input.work_type_id);
        setCreateAt(null);
        router.refresh(); // createTask does not revalidate (the board applies rows itself)
        return null;
    };

    const removeCut = async (cut: Cut) => {
        setConfirmDelete(null);
        const r = await run(deleteCut({id: cut.id}));
        setNotice(r.ok ? null : errorText(r));
    };

    const toggle = (key: string) =>
        setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

    const stopSelecting = () => {
        setSelecting(false);
        setSelected([]);
    };

    const openStage = (key: string) => setDrawer({key, opId: crypto.randomUUID(), opened: true});

    const bulkStages: BulkStage[] = (bulk?.keys ?? []).flatMap((key) => {
        const [cutId, typeId] = key.split(':');
        const cut = cutById.get(cutId);
        const type = typeById.get(typeId);
        return cut && type ? [{key, cut, type, assigneeId: taskByStage.get(key)?.staff_id ?? null}] : [];
    });

    // drawer target (kept while the close animation runs)
    const [dCutId, dTypeId] = drawer?.key.split(':') ?? [];
    const dCut = dCutId ? cutById.get(dCutId) : undefined;
    const dType = dTypeId ? typeById.get(dTypeId) : undefined;
    const dTask = drawer ? taskByStage.get(drawer.key) : undefined;
    const dAdjustments = drawer ? adjByStage.get(drawer.key) ?? [] : [];

    return (
        <section className={styles.page}>
            <header className={styles.intro}>
                <div>
                    <Text size="sm" c="dimmed">{t.kicker} · {project.name}</Text>
                    <h1 className={styles.title}>{t.title}</h1>
                    <Text size="sm" c="dimmed">{t.hint}</Text>
                </div>
                <ProjectViewTabs projectId={project.id} active="cuts" month={month}/>
            </header>

            <div className={styles.toolbar}>
                {notice && (
                    <Text
                        c={notice.ok ? 'dimmed' : 'red'}
                        size="sm"
                        role={notice.ok ? 'status' : 'alert'}
                        style={{display: 'flex', alignItems: 'center', gap: 8}}
                    >
                        {notice.text}
                        <CloseButton size="sm" aria-label={board.dismiss} onClick={() => setNotice(null)}/>
                    </Text>
                )}
                <div className={styles.toolbarEnd}>
                    {selecting ? (
                        <>
                            <Text size="sm" aria-live="polite">{fill(t.selecting, {n: selected.length})}</Text>
                            <Button
                                disabled={selected.length === 0}
                                onClick={() => setBulk({opId: crypto.randomUUID(), keys: selected})}
                            >
                                {t.continue}
                            </Button>
                            <Button variant="default" onClick={stopSelecting}>{common.cancel}</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="default" onClick={() => setAddOpen(true)}>{t.addCuts}</Button>
                            <Button
                                variant="default"
                                disabled={cutList.length === 0}
                                onClick={() => {
                                    setCreateAt(null);
                                    setSelecting(true);
                                }}
                            >
                                {t.bulk}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {cutList.length === 0 ? (
                <Text c="dimmed">{t.empty}</Text>
            ) : (
                <div className={styles.scroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col" className={styles.sticky}>
                                    {t.cut}
                                    <div className={styles.sub}>{t.budget}</div>
                                </th>
                                {workTypes.map((w) => (
                                    <th key={w.id} scope="col">
                                        <div className={styles.typeHead}>
                                            <span className={styles.swatch} style={{background: w.color}}/>
                                            <b>{w.code}</b>
                                            <span className={styles.typeLabel}>{w.label}</span>
                                            <span className={styles.pct} title={t.splitDefault}>{w.pay_pct}%</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {cutList.map((cut) => {
                                const stages = workTypes.map((w) => taskByStage.get(stageKey(cut.id, w.id)));
                                return (
                                    <tr key={cut.id}>
                                        <th scope="row" className={styles.sticky}>
                                            <div className={styles.cutHead}>
                                                <span className={styles.cutCode}>{cut.code}</span>
                                                {!cutsWithTasks.has(cut.id) && (confirmDelete === cut.id ? (
                                                    <Button size="compact-xs" color="red" onClick={() => void removeCut(cut)}>
                                                        {fill(t.confirmDelete, {code: cut.code})}
                                                    </Button>
                                                ) : (
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="gray"
                                                        size="sm"
                                                        aria-label={fill(t.deleteCut, {code: cut.code})}
                                                        onClick={() => setConfirmDelete(cut.id)}
                                                    >
                                                        <IconTrash size={14}/>
                                                    </ActionIcon>
                                                ))}
                                            </div>
                                            <BudgetInput cut={cut} label={fill(t.budgetLabel, {code: cut.code})} onError={(r) => setNotice(errorText(r))}/>
                                            <SplitInput cut={cut} workTypes={workTypes} onError={(r) => setNotice(errorText(r))}/>
                                        </th>
                                        {workTypes.map((w, i) => {
                                            const key = stageKey(cut.id, w.id);
                                            const task = stages[i];
                                            const state = cellState(task);
                                            const wait = waitingFor(workTypes, stages, i);
                                            const isSelected = selected.includes(key);
                                            const vars = {'--c': w.color, '--p': `${task?.progress ?? 0}%`} as CSSProperties;
                                            const adjSum = (adjByStage.get(key) ?? []).reduce((s, a) => s + a.amount, 0);
                                            const waitText = wait && <span className={styles.wait}>{fill(t.waiting, {code: wait.code})}</span>;
                                            return (
                                                <td key={w.id}>
                                                    <div className={`${styles.slot} ${selecting ? styles.selecting : ''} ${isSelected ? styles.selected : ''}`}>
                                                        {task ? (
                                                            <button
                                                                type="button"
                                                                className={`${styles.cell} ${styles[state]}`}
                                                                style={vars}
                                                                tabIndex={selecting ? -1 : undefined}
                                                                aria-label={fill(t.cellLabel, {
                                                                    cut: cut.code, type: w.code, name: staffName(task.staff_id), progress: task.progress,
                                                                })}
                                                                onClick={() => openStage(key)}
                                                            >
                                                                <span className={styles.cellHead}>
                                                                    <span className={styles.code}>{w.code}</span>
                                                                    {state === 'done' && <span className={styles.check}>{t.done}</span>}
                                                                </span>
                                                                <span className={styles.badge}>{formatVnd(lineByTask.get(task.id)?.amount ?? 0)}</span>
                                                                <span className={styles.line}>
                                                                    <span className={styles.who}>{staffName(task.staff_id)}</span>
                                                                    <span className={styles.when}>{ddmm(task.start_date)}–{ddmm(task.end_date)}</span>
                                                                    <span className={styles.progressText}>{task.progress}%</span>
                                                                </span>
                                                                {adjSum !== 0 && (
                                                                    <span className={styles.adjFlag}>{fill(t.adjFlag, {amount: formatVnd(adjSum, true)})}</span>
                                                                )}
                                                                {waitText}
                                                            </button>
                                                        ) : (
                                                            <div className={`${styles.cell} ${styles.empty}`} style={vars}>
                                                                <span className={styles.cellHead}><span className={styles.code}>{w.code}</span></span>
                                                                <span className={styles.dash} aria-hidden>—</span>
                                                                {adjByStage.has(key) ? (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.adjButton}
                                                                        tabIndex={selecting ? -1 : undefined}
                                                                        onClick={() => openStage(key)}
                                                                    >
                                                                        {fill(t.adjFlag, {amount: formatVnd(adjSum, true)})}
                                                                    </button>
                                                                ) : null}
                                                                {waitText}
                                                                {!selecting && (() => {
                                                                    const label = fill(t.assign, {cut: cut.code, type: w.code});
                                                                    const plus = (
                                                                        <ActionIcon
                                                                            className={styles.plus}
                                                                            variant="default"
                                                                            size="sm"
                                                                            aria-label={label}
                                                                            title={label}
                                                                            onClick={() => setCreateAt({key, today: todayICT()})}
                                                                        >
                                                                            <IconPlus size={14}/>
                                                                        </ActionIcon>
                                                                    );
                                                                    return createAt?.key === key ? (
                                                                        <CreateTaskPopover
                                                                            opened
                                                                            target={plus}
                                                                            start={createAt.today}
                                                                            end={createAt.today}
                                                                            cuts={cutList}
                                                                            workTypes={workTypes}
                                                                            stages={tasks}
                                                                            typeOrder={typeOrder}
                                                                            cutMode={{cut, workType: w, staff: activeStaff}}
                                                                            describeConflict={(id, typeId) =>
                                                                                orderConflictText(board, id, typeId, tasks, cutCodes, typeById)}
                                                                            onClose={() => setCreateAt(null)}
                                                                            onSubmit={createFromCell}
                                                                        />
                                                                    ) : plus;
                                                                })()}
                                                            </div>
                                                        )}
                                                        {selecting && (
                                                            <label className={styles.selectOverlay}>
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onChange={() => toggle(key)}
                                                                    aria-label={fill(t.select, {cut: cut.code, type: w.code})}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th scope="row" className={styles.sticky}>
                                    {t.total}
                                    <span className={styles.money}>{formatVnd(grandTotal)}</span>
                                </th>
                                {workTypes.map((w) => (
                                    <td key={w.id}>
                                        <span className={styles.money}>{formatVnd(typeTotals.get(w.id) ?? 0)}</span>
                                        <span className={styles.sub}>{w.code}</span>
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <CutDrawer
                key={drawer?.opId ?? 'none'}
                // any stage with a task or adjustments (adjustments outlive a deleted task and stay reversible)
                opened={!!drawer?.opened && !!dCut && !!dType && (!!dTask || dAdjustments.length > 0)}
                onClose={() => setDrawer((d) => d && {...d, opened: false})}
                projectId={project.id}
                initialOpId={drawer?.opId ?? ''}
                cut={dCut}
                workType={dType}
                workTypes={workTypes}
                task={dTask}
                line={dTask ? lineByTask.get(dTask.id) : undefined}
                adjustments={dAdjustments}
                allAdjustments={adjustments}
                staff={staff}
                cutStaffIds={[...new Set(tasks.filter((x) => x.cut_id === dCutId).map((x) => x.staff_id))]}
                audit={audit.filter((a) => a.row_id === dCutId || a.row_id === dTypeId)}
                projectLinks={sanitizeLinks(project.links)}
            />

            {bulk && bulkStages.length > 0 && (
                <BulkModal
                    key={bulk.opId}
                    opId={bulk.opId}
                    projectId={project.id}
                    stages={bulkStages}
                    staff={activeStaff}
                    onClose={() => setBulk(null)}
                    onDone={(n) => {
                        setBulk(null);
                        stopSelecting();
                        setNotice(fill(t.bulkSaved, {n}), true);
                    }}
                />
            )}

            <AddCutsModal
                opened={addOpen}
                projectId={project.id}
                onClose={() => setAddOpen(false)}
                onDone={(n) => {
                    setAddOpen(false);
                    setNotice(fill(t.added, {n}), true);
                }}
            />
        </section>
    );
}

/** Sticky-column pay split: the cut's % per type (own split or the project default); a popover edits or resets it. */
function SplitInput({cut, workTypes, onError}: {cut: Cut; workTypes: WorkType[]; onError: (r: {error: string}) => void}) {
    const {cuts: t, common} = useDictionary().tracker;
    const [draft, setDraft] = useState<Record<string, number | string> | null>(null);
    const [busy, setBusy] = useState(false);
    useRealtimeBusy(draft !== null);
    const custom = cutSplit(cut) !== null;
    const pcts = workTypes.map((w) => stagePct(cut, w));
    const values = workTypes.map((w, i) => (draft ? Number(draft[w.id]) || 0 : pcts[i]));
    const ok = pctTotalOk(values);
    const total = values.reduce((s, p) => s + pctHundredths(p), 0) / 100;
    const save = async (split: Record<string, number> | null) => {
        setBusy(true);
        const r = await updateCut({id: cut.id, patch: {pay_split: split}}).catch(() => ({ok: false, error: 'network'}) as const);
        setBusy(false);
        if (r.ok) setDraft(null);
        else onError(r);
    };
    return (
        <Popover opened={draft !== null} onChange={(o) => !o && !busy && setDraft(null)} position="bottom-start" width={240} trapFocus withArrow shadow="md">
            <Popover.Target>
                <Button
                    mt={4}
                    size="compact-xs"
                    variant={custom ? 'light' : 'subtle'}
                    color={custom ? undefined : 'gray'}
                    title={custom ? t.splitCustom : t.splitDefault}
                    aria-label={fill(t.splitLabel, {code: cut.code})}
                    onClick={() => setDraft(Object.fromEntries(workTypes.map((w, i) => [w.id, pcts[i]])))}
                >
                    {pcts.join(' · ')}%
                </Button>
            </Popover.Target>
            <Popover.Dropdown>
                <form
                    className={styles.form}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (ok) void save(Object.fromEntries(workTypes.map((w, i) => [w.id, values[i]])));
                    }}
                >
                    <Text size="sm" fw={600}>{fill(t.splitLabel, {code: cut.code})}</Text>
                    {workTypes.map((w) => (
                        <NumberInput
                            key={w.id}
                            size="xs"
                            label={`${w.code} · ${w.label}`}
                            min={0}
                            max={100}
                            decimalScale={2}
                            suffix="%"
                            value={draft?.[w.id] ?? 0}
                            onChange={(v) => setDraft((d) => d && {...d, [w.id]: v})}
                        />
                    ))}
                    <Text size="sm" c={ok ? 'dimmed' : 'red'}>{t.total}: {total}%{!ok && ` · ${t.splitTotal}`}</Text>
                    <div className={styles.row}>
                        <Button type="submit" size="compact-sm" disabled={!ok} loading={busy}>{common.save}</Button>
                        {custom && (
                            <Button size="compact-sm" variant="default" disabled={busy} onClick={() => void save(null)}>{t.splitReset}</Button>
                        )}
                    </div>
                </form>
            </Popover.Dropdown>
        </Popover>
    );
}

/** Sticky-column budget: draft while typing, commit on blur / Enter → updateCut (the action refreshes the page); Escape reverts. */
function BudgetInput({cut, label, onError}: {cut: Cut; label: string; onError: (r: {error: string}) => void}) {
    const [draft, setDraft] = useState<number | string | null>(null);
    useRealtimeBusy(draft !== null && draft !== cut.budget);
    const commit = async () => {
        if (draft === null) return;
        const budget = typeof draft === 'number' ? draft : Number.NaN;
        if (!Number.isInteger(budget) || budget === cut.budget) {
            setDraft(null);
            return;
        }
        const r = await updateCut({id: cut.id, patch: {budget}}).catch(() => ({ok: false, error: 'network'}) as const);
        if (!r.ok) onError(r);
        setDraft(null);
    };
    return (
        <NumberInput
            mt={6}
            size="xs"
            aria-label={label}
            value={draft ?? cut.budget}
            onChange={setDraft}
            onBlur={() => void commit()}
            onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setDraft(null); // revert; the next blur then has nothing to commit
            }}
            min={0}
            max={1e10}
            allowDecimal={false}
            allowNegative={false}
            thousandSeparator="."
            decimalSeparator=","
            hideControls
            suffix=" ₫"
        />
    );
}
