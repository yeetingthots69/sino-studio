'use client';

import {useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode} from 'react';
import Link from 'next/link';
import {ActionIcon, CloseButton, MultiSelect, Text, UnstyledButton} from '@mantine/core';
import {IconArrowsSort, IconEye, IconEyeOff, IconSortAscendingLetters, IconSortDescendingLetters} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createTask, deleteTask, updateTask, type ActionResult, type TaskPatch as ActionTaskPatch} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {compareCutCodes} from '../cuts';
import {sanitizeLinks} from '../links';
import {addDays, assignLanes, daysBetween, isWeekend, monthRange, weekdayLabel} from '../dates';
import {viewStaff} from '../staffView';
import ProjectViewTabs from '../ProjectViewTabs/ProjectViewTabs';
import AddTaskButton from './AddTaskButton';
import CreateTaskPopover, {type CreateInput} from './CreateTaskPopover';
import Legend from './Legend';
import MonthNav from './MonthNav';
import TaskBar from './TaskBar';
import TaskPanel from './TaskPanel';
import {createCommitChain, planCommit} from './taskSync';
import {createTaskStore, NEXT_SORT, orderConflictText} from './boardHelpers';
import {useBoardPrefs} from './useBoardPrefs';
import {useDragCreate} from './useDragCreate';
import {useRefreshScheduler} from './useRefreshScheduler';
import {useTaskRealtime} from './useTaskRealtime';
import {isRealtimeBusy, useRealtimeIdle, useRealtimeTables} from '@/components/tracker/useRealtimeRefresh';
import styles from './GanttBoard.module.css';

export type Task = Tables<'tracker_tasks'>;
export type Staff = Tables<'tracker_staff'>;
export type WorkType = Tables<'tracker_work_types'>;
export type Cut = Tables<'tracker_cuts'>;
export type StageRow = Pick<Task, 'id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'start_date' | 'end_date' | 'version'>;
export type TaskPatch = ActionTaskPatch;

export const DAY_W = 40;
export const DONE_COLOR = '#ef4444';

/** Fills `{key}` placeholders in a dictionary string. */
export const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const SORT_ICON = {studio: IconArrowsSort, az: IconSortAscendingLetters, za: IconSortDescendingLetters};

/** Optimistic layer over the confirmed rows: a patch (or a hidden row for a delete) until its commit settles. */
type Pending = {seq: number; id: string; patch: Partial<Task>; hide?: boolean};

interface Props {
    project: Tables<'tracker_projects'>;
    month: string;
    locale: string;
    staff: Staff[];
    /** The project's work types by sort_order. */
    workTypes: WorkType[];
    strengths: Tables<'tracker_strengths'>[];
    staffStrengths: Tables<'tracker_staff_strengths'>[];
    cuts: Cut[];
    /** Tasks overlapping the month (render set). */
    tasks: Task[];
    /** Every task of the project (stage index). */
    stages: StageRow[];
    /** Header slot for the share button (rendered by the page). */
    shareSlot?: ReactNode;
}

const BOARD_TABLES = ['tracker_projects', 'tracker_work_types', 'tracker_staff', 'tracker_strengths', 'tracker_staff_strengths', 'tracker_shares'];

export default function GanttBoard(props: Props) {
    const {project, month, locale, staff, workTypes, strengths, staffStrengths, cuts: cutRows, tasks, stages: stageRows} = props;
    const {board: t, common} = useDictionary().tracker;
    // Confirmed rows live in an external store updated synchronously on every input (commits read it at
    // send time inside the chain); React renders it through useSyncExternalStore.
    const [store] = useState(() => createTaskStore(project.id, tasks));
    const sync = useSyncExternalStore(store.subscribe, store.get, store.get);
    const [chain] = useState(createCommitChain);
    const seqRef = useRef(0);
    const [pending, setPending] = useState<Pending[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [prefs, setPrefs] = useBoardPrefs();
    const {start: monthStart, end: monthEnd, days} = monthRange(month);
    const drag = useDragCreate(days, DAY_W);

    // cuts: replaced by every (re)load, patched by realtime and create results in between
    const [cuts, setCuts] = useState(() => new Map(cutRows.map((c) => [c.id, c])));
    const [prevCutRows, setPrevCutRows] = useState(cutRows);
    if (cutRows !== prevCutRows) {
        setPrevCutRows(cutRows);
        setCuts(new Map(cutRows.map((c) => [c.id, c])));
    }

    // refreshes (realtime resync or deferred) wait while a bar is dragged or a panel draft is dirty
    const {dragging, panelDirty, requestRefresh, settle} = useRefreshScheduler(
        () => store.apply({kind: 'refreshStart'}),
        isRealtimeBusy,
    );
    // refreshed props → snapshot (the mount rows are already the initial state)
    const [mountTasks] = useState(tasks);
    useEffect(() => {
        if (tasks !== mountTasks) store.apply({kind: 'snapshot', rows: tasks, range: {start: monthStart, end: monthEnd}});
    }, [tasks, mountTasks, store, monthStart, monthEnd]);

    const staffIds = new Set(staff.map((s) => s.id));
    useTaskRealtime(project.id, month, {
        onTask: (c) => {
            if (c.type === 'delete') return store.apply({kind: 'realtimeDelete', id: c.id});
            // a staff member this page did not load (e.g. archived) needs the server render
            if (c.row.project_id === project.id && !staffIds.has(c.row.staff_id)) requestRefresh();
            store.apply({kind: 'realtime', row: c.row});
        },
        onCut: (c) => setCuts((m) => {
            if (c.type === 'upsert') return c.row.project_id === project.id ? new Map(m).set(c.row.id, c.row) : m;
            if (!m.has(c.id)) return m;
            const next = new Map(m);
            next.delete(c.id);
            return next;
        }),
        onResync: requestRefresh,
    });
    // lookup tables and share links: server refresh through the board scheduler (refreshStart snapshot, drag/draft deferral)
    useRealtimeTables(BOARD_TABLES, requestRefresh);
    useRealtimeIdle(settle);

    const dates = Array.from({length: days}, (_, i) => addDays(monthStart, i));
    const typeById = new Map(workTypes.map((w) => [w.id, w]));
    const typeOrder = new Map(workTypes.map((w) => [w.id, w.sort_order]));
    const cutList = [...cuts.values()].sort((a, b) => compareCutCodes(a.code, b.code));
    const cutCodes = new Map(cutList.map((c) => [c.id, c.code]));

    // stage index: loader rows merged with every confirmed row (higher version wins), physical deletes excluded
    const stageMap = new Map<string, StageRow>();
    for (const s of stageRows) if (!sync.tombstones.has(s.id)) stageMap.set(s.id, s);
    for (const {row} of sync.entries.values()) {
        const s = stageMap.get(row.id);
        if (!s || row.version >= s.version) stageMap.set(row.id, row);
    }
    const stages = [...stageMap.values()];

    // displayed rows = confirmed rows + pending optimistic patches, month filter last
    const shown: Task[] = [];
    let selected: Task | null = null;
    for (const {row} of sync.entries.values()) {
        let r = row;
        let hidden = false;
        for (const p of pending) {
            if (p.id !== row.id) continue;
            if (p.hide) hidden = true;
            else r = {...r, ...p.patch};
        }
        if (hidden) continue;
        if (r.id === selectedId) selected = r;
        if (r.start_date <= monthEnd && r.end_date >= monthStart) shown.push(r);
    }

    // staff columns
    const strengthById = new Map(strengths.map((s) => [s.id, s]));
    const strengthIdsByStaff = new Map<string, string[]>();
    for (const j of staffStrengths) {
        if (strengthById.has(j.strength_id)) strengthIdsByStaff.set(j.staff_id, [...(strengthIdsByStaff.get(j.staff_id) ?? []), j.strength_id]);
    }
    const strengthLabels = new Map([...strengthIdsByStaff].map(([id, ids]) => [
        id,
        strengths.filter((s) => ids.includes(s.id)).map((s) => s.label).join(', '),
    ]));
    const allRounderIds = new Set(strengths.filter((s) => s.all_rounder).map((s) => s.id));
    const filter = prefs.filter.filter((id) => strengthById.has(id));
    const rows = viewStaff(staff, strengthIdsByStaff, allRounderIds, {sort: prefs.sort, filter});
    const hide = prefs.hideStrengths;
    const lead = hide ? 2 : 3; // fixed columns before the day columns
    const SortIcon = SORT_ICON[prefs.sort];

    const describeConflict = (conflictId: string | undefined, typeId: string | undefined) =>
        orderConflictText(t, conflictId, typeId, stages, cutCodes, typeById);

    const failText = (r: {error: string; detail?: string}, ctx: {typeId?: string; cut?: boolean}) => {
        switch (r.error) {
            case 'order_conflict':
                return describeConflict(r.detail, ctx.typeId);
            case 'duplicate':
                return t.duplicateStage;
            case 'invalid':
                return ctx.cut ? t.invalidCut : common.error.generic;
            case 'not_found':
                return common.error.notFound;
            case 'network':
                return common.error.network;
            default:
                return common.error.generic;
        }
    };

    /**
     * Versioned write through the per-task chain: expected_version is planned when the commit is sent
     * (planCommit on the store, not render state); a conflict or failure reverts the optimistic layer and
     * drops the commits queued behind it.
     */
    function commit<T>(
        id: string,
        baseline: number,
        optimistic: Omit<Pending, 'seq' | 'id'>,
        send: (expected_version: number) => Promise<ActionResult<T>>,
        onOk: (data: T) => void,
        ctx: {typeId?: string; cut?: boolean},
    ) {
        const seq = ++seqRef.current;
        setPending((p) => [...p, {seq, id, ...optimistic}]);
        setNotice(null);
        void chain(id, async () => {
            const plan = planCommit(store.get(), id, baseline);
            if (plan === 'conflict-local') {
                setNotice(t.conflict);
                return false;
            }
            store.apply({kind: 'begin', id});
            // any throw (sync or async) still reaches an ack below, so the task never stays in flight
            let r: ActionResult<T> = {ok: false, error: 'network'};
            try {
                r = await send(plan.expected_version);
            } catch {
                // network failure → 'network'
            }
            if (r.ok) {
                onOk(r.data);
                return true;
            }
            if (r.error === 'conflict') {
                store.apply({kind: 'ack', id, fresh: r.fresh});
                setNotice(t.conflict);
                return false;
            }
            store.apply({kind: 'ack', id});
            setNotice(failText(r, ctx));
            return false;
        }).then(() => {
            setPending((p) => p.filter((x) => x.seq !== seq));
            settle();
        });
    }

    const update = (task: Task, patch: TaskPatch, display: Partial<Task>, baseline: number) =>
        commit(
            task.id,
            baseline,
            {patch: display},
            (expected_version) => updateTask({id: task.id, expected_version, patch}),
            (row) => {
                store.apply({kind: 'ack', id: task.id, row});
                // a new cut arrives by realtime; without it (channel down) the refresh brings it
                if (!cuts.has(row.cut_id)) requestRefresh();
            },
            {typeId: patch.work_type_id ?? task.work_type_id, cut: patch.cut_code !== undefined},
        );

    const remove = (task: Task, baseline: number) => {
        setSelectedId(null);
        commit(
            task.id,
            baseline,
            {patch: {}, hide: true},
            (expected_version) => deleteTask({id: task.id, expected_version}),
            () => store.apply({kind: 'ownDelete', id: task.id}),
            {},
        );
    };

    const draft = drag.draft;
    const create = async (input: CreateInput): Promise<string | null> => {
        if (!draft) return null;
        const r = await createTask({
            ...input,
            project_id: project.id,
            staff_id: draft.staffId,
            start_date: addDays(monthStart, draft.from),
            end_date: addDays(monthStart, draft.to),
        }).catch(() => ({ok: false, error: 'network'}) as const);
        if (!r.ok) return failText(r, {typeId: input.work_type_id, cut: true});
        const {task, cut} = r.data;
        store.apply({kind: 'ack', id: task.id, row: task});
        setCuts((m) => new Map(m).set(cut.id, cut));
        setSelectedId(task.id);
        drag.close();
        return null;
    };

    // "+": the 1st of the month, or today when today is in the viewed month
    const openAdd = (staffId: string) => {
        const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh'}).format(new Date());
        drag.openAt(staffId, today >= monthStart && today <= monthEnd ? daysBetween(monthStart, today) : 0);
    };

    return (
        <section className={styles.page}>
            <header className={styles.intro}>
                <div>
                    <Text size="sm" c="dimmed">{t.kicker}</Text>
                    <h1 className={styles.title}>{t.title}</h1>
                    <Text size="sm" c="dimmed">{t.hint}</Text>
                </div>
                <div className={styles.headerActions}>
                    {props.shareSlot}
                    <ProjectViewTabs projectId={project.id} active="board" month={month}/>
                </div>
            </header>

            <div className={styles.layout}>
                <div className={styles.card}>
                    <div className={styles.topBar}>
                        <MonthNav month={month}/>
                        <Legend workTypes={workTypes}/>
                    </div>
                    {notice && (
                        <div className={styles.notice} role="alert">
                            <span>{notice}</span>
                            <CloseButton size="sm" aria-label={t.dismiss} onClick={() => setNotice(null)}/>
                        </div>
                    )}

                    <div className={styles.scroll}>
                        <div
                            className={styles.grid}
                            style={{
                                gridTemplateColumns: `48px 160px ${hide ? '' : '220px '}repeat(${days}, ${DAY_W}px)`,
                                gridTemplateRows: `auto repeat(${rows.length}, auto)`,
                            }}
                        >
                            <div className={`${styles.head} ${styles.stickyStt}`} style={{gridArea: '1 / 1'}}>{t.stt}</div>
                            <div className={`${styles.head} ${styles.stickyName} ${hide ? styles.stickyLast : ''}`} style={{gridArea: '1 / 2'}}>
                                <UnstyledButton
                                    className={styles.sortButton}
                                    aria-label={fill(t.sort.label, {mode: t.sort[prefs.sort]})}
                                    title={fill(t.sort.label, {mode: t.sort[prefs.sort]})}
                                    onClick={() => setPrefs({...prefs, sort: NEXT_SORT[prefs.sort]})}
                                >
                                    {t.staff}
                                    <SortIcon size={14}/>
                                </UnstyledButton>
                                {hide && (
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label={t.showStrengths}
                                        title={t.showStrengths}
                                        onClick={() => setPrefs({...prefs, hideStrengths: false})}
                                    >
                                        <IconEye size={14}/>
                                    </ActionIcon>
                                )}
                            </div>
                            {!hide && (
                                <div className={`${styles.head} ${styles.stickyStrengths} ${styles.stickyLast}`} style={{gridArea: '1 / 3'}}>
                                    <MultiSelect
                                        className={styles.strengthFilter}
                                        size="xs"
                                        aria-label={t.strengthFilter}
                                        placeholder={filter.length ? undefined : t.strengths}
                                        data={strengths.map((s) => ({value: s.id, label: s.label}))}
                                        value={filter}
                                        onChange={(v) => setPrefs({...prefs, filter: v})}
                                        clearable
                                    />
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label={t.hideStrengths}
                                        title={t.hideStrengths}
                                        onClick={() => setPrefs({...prefs, hideStrengths: true})}
                                    >
                                        <IconEyeOff size={14}/>
                                    </ActionIcon>
                                </div>
                            )}
                            {dates.map((d, i) => (
                                <div key={d} className={`${styles.head} ${styles.dayHead} ${isWeekend(d) ? styles.weekendText : ''}`} style={{gridArea: `1 / ${i + lead + 1}`}}>
                                    <span>{weekdayLabel(d)}</span>
                                    <span>{i + 1}</span>
                                </div>
                            ))}
                            {dates.map((d, i) => isWeekend(d) && (
                                <div key={`w-${d}`} className={styles.weekend} style={{gridColumn: i + lead + 1}}/>
                            ))}

                            {rows.map((s, idx) => {
                                const rowTasks = shown.filter((x) => x.staff_id === s.id);
                                const lanes = assignLanes(rowTasks);
                                const laneCount = Math.max(1, ...[...lanes.values()].map((l) => l + 1));
                                const height = laneCount * DAY_W + 8;
                                const active = !s.archived_at && workTypes.length > 0;
                                const row = idx + 2; // explicit placement so weekend overlays never displace cells
                                return (
                                    <div key={s.id} className={styles.row}>
                                        <div className={`${styles.cell} ${styles.stickyStt} ${styles.muted}`} style={{height, gridArea: `${row} / 1`}}>
                                            {idx + 1}
                                        </div>
                                        <div className={`${styles.cell} ${styles.stickyName} ${hide ? styles.stickyLast : ''}`} style={{height, gridArea: `${row} / 2`}}>
                                            <Link
                                                href={`/${locale}/tracker/${project.id}/people/${s.id}`}
                                                className={`${styles.name} ${s.archived_at ? styles.muted : ''}`}
                                            >
                                                {s.name}
                                            </Link>
                                            {active && <AddTaskButton label={fill(t.addTask, {name: s.name})} onClick={() => openAdd(s.id)}/>}
                                        </div>
                                        {!hide && (
                                            <div className={`${styles.cell} ${styles.stickyStrengths} ${styles.stickyLast} ${styles.muted}`} style={{height, gridArea: `${row} / 3`}}>
                                                <span className={styles.ellipsis}>{strengthLabels.get(s.id)}</span>
                                            </div>
                                        )}
                                        <div
                                            className={`${styles.track} ${active ? styles.trackActive : ''}`}
                                            style={{height, gridRow: row, gridColumn: `${lead + 1} / span ${days}`}}
                                            {...(active ? {...drag.trackHandlers, onPointerDown: (e: PointerEvent<HTMLElement>) => drag.onPointerDown(e, s.id)} : {})}
                                        >
                                            {rowTasks.map((task) => (
                                                <TaskBar
                                                    key={task.id}
                                                    task={task}
                                                    cutCode={cutCodes.get(task.cut_id) ?? ''}
                                                    workType={typeById.get(task.work_type_id)}
                                                    month={month}
                                                    lane={lanes.get(task) ?? 0}
                                                    selected={task.id === selectedId}
                                                    draggingRef={dragging}
                                                    settle={settle}
                                                    onSelect={() => setSelectedId(task.id)}
                                                    onCommit={(patch, baseline) => update(task, patch, patch, baseline)}
                                                />
                                            ))}
                                            {draft?.staffId === s.id && (
                                                <CreateTaskPopover
                                                    key={draft.id}
                                                    opened={draft.open}
                                                    ghostStyle={{left: draft.from * DAY_W, width: (draft.to - draft.from + 1) * DAY_W - 4}}
                                                    start={addDays(monthStart, draft.from)}
                                                    end={addDays(monthStart, draft.to)}
                                                    cuts={cutList}
                                                    workTypes={workTypes}
                                                    stages={stages}
                                                    typeOrder={typeOrder}
                                                    describeConflict={describeConflict}
                                                    onClose={drag.close}
                                                    onSubmit={create}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <TaskPanel
                    key={selected?.id ?? 'empty'}
                    task={selected}
                    cutCode={selected ? cutCodes.get(selected.cut_id) ?? '' : ''}
                    cuts={cutList}
                    staff={staff}
                    strengthLabels={strengthLabels}
                    workTypes={workTypes}
                    usedTypeIds={new Set(selected
                        ? stages.filter((x) => x.cut_id === selected.cut_id && x.id !== selected.id).map((x) => x.work_type_id)
                        : [])}
                    projectLinks={sanitizeLinks(project.links)}
                    panelDirtyRef={panelDirty}
                    settle={settle}
                    onUpdate={(patch, display, baseline) => selected && update(selected, patch, display, baseline)}
                    onDelete={(baseline) => selected && remove(selected, baseline)}
                    onInvalidCut={() => setNotice(t.invalidCut)}
                />
            </div>
        </section>
    );
}
