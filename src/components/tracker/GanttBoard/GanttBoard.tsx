'use client';

import {useEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {ActionIcon, Avatar, CloseButton, MultiSelect, Skeleton, Text, Transition, UnstyledButton, VisuallyHidden} from '@mantine/core';
import {IconArrowsSort, IconEye, IconEyeOff, IconSortAscendingLetters, IconSortDescendingLetters} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createTask, deleteTask, moveTask, updateTask, type ActionResult, type TaskPatch as ActionTaskPatch} from '@/app/[locale]/tracker/actions';
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
import {MoveDialog} from './MoveDialog';
import TaskBar from './TaskBar';
import TaskPanel from './TaskPanel';
import {createCommitChain, planCommit} from './taskSync';
import {createTaskStore, NEXT_SORT, orderConflictText} from './boardHelpers';
import {cssColor} from './presence';
import {useBoardPresence} from './useBoardPresence';
import {useBoardPrefs} from './useBoardPrefs';
import {useDragCreate} from './useDragCreate';
import {useRefreshScheduler} from './useRefreshScheduler';
import {useTaskRealtime} from './useTaskRealtime';
import {useWheelHandoff} from './wheelHandoff';
import {isRealtimeBusy, useRealtimeIdle, useRealtimeTables} from '@/components/tracker/useRealtimeRefresh';
import styles from './GanttBoard.module.css';

export type Task = Tables<'tracker_tasks'>;
export type Staff = Tables<'tracker_staff'>;
export type WorkType = Tables<'tracker_work_types'>;
export type Cut = Tables<'tracker_cuts'>;
export type StageRow = Pick<Task, 'id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'start_date' | 'end_date' | 'version'>;
export type TaskPatch = ActionTaskPatch;

/** Minimum day column width; the board widens days to fill the card (`dayW`). */
export const DAY_W = 40;
/** Vertical lane pitch of a staff row. */
export const LANE_H = 40;
export const DONE_COLOR = '#ef4444';

/** Fills `{key}` placeholders in a dictionary string. */
export const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

const SORT_ICON = {studio: IconArrowsSort, az: IconSortAscendingLetters, za: IconSortDescendingLetters};

/** Optimistic layer over the confirmed rows: a patch (or a hidden row for a delete) until its commit settles. */
type Pending = {seq: number; id: string; patch: Partial<Task>; hide?: boolean};
/** Selection change waiting for the panel's "Discard changes?" answer. */
type PendingNav = {kind: 'close'} | {kind: 'select'; id: string};
/** Cross-person move waiting for MoveDialog. */
type MoveDraft = {task: Task; staff_id: string; start_date: string; end_date: string; baseline: number};

/** Stable pseudo-random skeleton bars `[day offset, length]` for a staff row (1–2 bars inside the month). */
function skeletonBars(id: string, days: number): [number, number][] {
    let h = 7;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const first: [number, number] = [h % (days - 8), 2 + ((h >>> 5) % 6)];
    const second = first[0] + first[1] + 1 + ((h >>> 9) % 6);
    return h & 1 || second > days - 3 ? [first] : [first, [second, Math.min(days - second, 2 + ((h >>> 13) % 5))]];
}

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
    const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
    // the task the panel shows: the selection, kept through the panel's exit transition
    const [panelId, setPanelId] = useState<string | null>(null);
    if (selectedId !== null && selectedId !== panelId) setPanelId(selectedId);
    const [moveDraft, setMoveDraft] = useState<MoveDraft | null>(null);
    // MoveDialog stays mounted with the last draft so its close transition returns focus
    const [lastMove, setLastMove] = useState<MoveDraft | null>(null);
    if (moveDraft !== null && moveDraft !== lastMove) setLastMove(moveDraft);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [prefs, setPrefs] = useBoardPrefs();
    const {start: monthStart, end: monthEnd, days} = monthRange(month);

    // month navigation: the header switches at once, rows show skeletons until the new board mounts.
    // Checked in dev: the push transition stays pending until the page (keyed by month) renders the new board.
    const router = useRouter();
    const pathname = usePathname();
    const [navPending, startNav] = useTransition();
    const [pendingMonth, setPendingMonth] = useState<string | null>(null);
    const skeleton = navPending && pendingMonth !== null;
    const navigate = (m: string) => {
        if (m === (skeleton ? pendingMonth : month)) return;
        presence.leave(); // peers must not keep this tab's hovered cell while the skeleton shows
        setPendingMonth(m);
        startNav(() => router.push(`${pathname}?m=${m}`));
    };
    // safety: a navigation that never settles must not leave the skeleton forever
    useEffect(() => {
        if (pendingMonth === null) return;
        const id = setTimeout(() => setPendingMonth(null), 20_000);
        return () => clearTimeout(id);
    }, [pendingMonth]);
    const viewMonth = skeleton ? pendingMonth : month;
    const view = monthRange(viewMonth);
    const scrollRef = useRef<HTMLDivElement>(null);
    useWheelHandoff(scrollRef, !skeleton);
    // scroll viewport width (panel open/close and window resize change it); null until measured
    const [scrollW, setScrollW] = useState<number | null>(null);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setScrollW(el.clientWidth));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const hide = prefs.hideStrengths;
    // days widen to fill the card (never below DAY_W); every horizontal geometry uses this one value
    const leadW = 48 + 160 + (hide ? 0 : 220);
    const dayW = scrollW === null ? DAY_W : Math.max(DAY_W, (scrollW - leadW) / view.days);
    const drag = useDragCreate(days, dayW);

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
    // presence `editing`: the dragged bar, else the selected task while its panel has unsaved changes
    const [dragId, setDragId] = useState<string | null>(null);
    const [panelIsDirty, setPanelIsDirty] = useState(false);
    // TaskPanel writes this ref; each write also mirrors into state (the scheduler keeps reading panelDirty)
    const [panelDirtyRef] = useState(() => ({
        get current() {
            return panelDirty.current;
        },
        set current(v: boolean) {
            panelDirty.current = v;
            setPanelIsDirty(v);
        },
    }));
    const presence = useBoardPresence({
        projectId: project.id,
        month,
        editing: dragId ?? (panelIsDirty ? selectedId : null),
        days,
        dayWidth: dayW,
        draggingRef: dragging,
    });

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

    // header + weekend columns follow the target month while a navigation is pending
    const dates = Array.from({length: view.days}, (_, i) => addDays(view.start, i));
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
    let panelTask: Task | null = null;
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
        if (r.id === panelId) panelTask = r;
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
            case 'staff_archived':
                return t.moveArchived;
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
        requestSelect(task.id);
        drag.close();
        return null;
    };

    // selection: an unsaved links draft asks "Discard changes?" before the panel closes or switches
    function requestNav(nav: PendingNav) {
        if (panelDirtyRef.current) return setPendingNav(nav);
        setPendingNav(null);
        go(nav);
    }
    // closing moves focus back to the selected bar (the panel and its X button unmount)
    function go(nav: PendingNav) {
        if (nav.kind === 'select') return setSelectedId(nav.id);
        const bar = scrollRef.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
        setSelectedId(null);
        requestAnimationFrame(() => {
            if (bar?.isConnected) bar.focus();
        });
    }
    function requestSelect(id: string) {
        requestNav({kind: 'select', id});
    }
    const requestClose = () => requestNav({kind: 'close'});
    const onSelect = (id: string) => (selectedId === id ? requestClose() : requestSelect(id));
    // the panel has already dropped its draft when `discard` is true
    const resolveNav = (discard: boolean) => {
        if (discard && pendingNav) go(pendingNav);
        setPendingNav(null);
    };

    // Esc closes the panel unless something else owns the key (field, modal, listbox, popover, New Task).
    // Capture phase: an open bar Tooltip (floating-ui useDismiss) stops Escape's propagation on the bar.
    const createOpen = !!draft?.open;
    useEffect(() => {
        if (selectedId === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || e.isComposing || e.defaultPrevented || createOpen) return;
            const el = e.target instanceof HTMLElement ? e.target : null;
            if (el?.isContentEditable) return;
            if (el?.closest('input, textarea, select, [aria-modal="true"], [role=listbox], .mantine-Popover-dropdown')) return;
            requestClose();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    });

    const staffNames = new Map(staff.map((s) => [s.id, s.name]));
    const openMove = (task: Task, target: {staff_id: string; start_date: string; end_date: string}, baseline: number) =>
        setMoveDraft({task, ...target, baseline});
    const confirmMove = (moveAdjustments: boolean) => {
        if (!moveDraft) return;
        const {task, staff_id, start_date, end_date, baseline} = moveDraft;
        setMoveDraft(null);
        const op_id = crypto.randomUUID(); // one per confirmation (the batch id)
        const reason = fill(t.moveReason, {
            cut: cutCodes.get(task.cut_id) ?? '',
            type: typeById.get(task.work_type_id)?.code ?? '',
            from: staffNames.get(task.staff_id) ?? '',
            to: staffNames.get(staff_id) ?? '',
        });
        commit(
            task.id,
            baseline,
            {patch: {staff_id, start_date, end_date}},
            (expected_version) => moveTask({id: task.id, expected_version, staff_id, start_date, end_date, move_adjustments: moveAdjustments, op_id, reason}),
            (row) => store.apply({kind: 'ack', id: task.id, row}),
            {typeId: task.work_type_id},
        );
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
                        <MonthNav month={skeleton ? pendingMonth : month} onNavigate={navigate}/>
                        <Legend workTypes={workTypes}/>
                        {presence.people.length > 0 && (
                            <Avatar.Group className={styles.presence} aria-label={t.presence.label}>
                                {presence.people.map((p) => {
                                    const away = p.months.filter((m) => m !== month).map((m) => fill(t.month, {m: Number(m.slice(5)), y: m.slice(0, 4)}));
                                    const title = away.length ? `${p.name} · ${away.join(', ')}` : p.name;
                                    return <Avatar key={p.email} src={p.avatar} alt={p.name} name={p.name} color={p.color} size={28} radius="xl" title={title}/>;
                                })}
                            </Avatar.Group>
                        )}
                    </div>
                    {notice && (
                        <div className={styles.notice} role="alert">
                            <span>{notice}</span>
                            <CloseButton size="sm" aria-label={t.dismiss} onClick={() => setNotice(null)}/>
                        </div>
                    )}

                    <div ref={scrollRef} className={styles.scroll} aria-busy={skeleton || undefined}>
                        {skeleton && <VisuallyHidden role="status">{t.loading}</VisuallyHidden>}
                        <div
                            className={styles.grid}
                            style={{
                                gridTemplateColumns: `48px 160px ${hide ? '' : '220px '}repeat(${view.days}, ${dayW}px)`,
                                gridTemplateRows: `auto repeat(${rows.length}, auto)`,
                                '--day-w': `${dayW}px`,
                            } as CSSProperties}
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
                                const height = laneCount * LANE_H + 8;
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
                                        {skeleton ? (
                                            // same row height while the next month loads; no handlers, no presence hover
                                            <div className={styles.track} style={{height, gridRow: row, gridColumn: `${lead + 1} / span ${view.days}`}}>
                                                {skeletonBars(s.id, view.days).map(([day, len]) => (
                                                    <Skeleton key={day} style={{position: 'absolute', top: 4, left: day * dayW, width: len * dayW - 4}} height={32} radius={6}/>
                                                ))}
                                            </div>
                                        ) : (
                                        <div
                                            className={`${styles.track} ${active ? styles.trackActive : ''} ${dropTarget === s.id ? styles.dropTarget : ''}`}
                                            style={{height, gridRow: row, gridColumn: `${lead + 1} / span ${view.days}`}}
                                            data-staff-id={s.id}
                                            data-drop={active ? '1' : undefined}
                                            {...(active ? {...drag.trackHandlers, onPointerDown: (e: PointerEvent<HTMLElement>) => drag.onPointerDown(e, s.id)} : {})}
                                            onPointerMove={(e) => {
                                                if (active) drag.trackHandlers.onPointerMove(e);
                                                presence.hover(e, s.id);
                                            }}
                                            onPointerLeave={presence.leave}
                                        >
                                            {rowTasks.map((task) => (
                                                <TaskBar
                                                    key={task.id}
                                                    task={task}
                                                    cutCode={cutCodes.get(task.cut_id) ?? ''}
                                                    workType={typeById.get(task.work_type_id)}
                                                    month={month}
                                                    lane={lanes.get(task) ?? 0}
                                                    dayWidth={dayW}
                                                    selected={task.id === selectedId}
                                                    draggingRef={dragging}
                                                    settle={settle}
                                                    onSelect={() => onSelect(task.id)}
                                                    onCommit={(patch, baseline) => update(task, patch, patch, baseline)}
                                                    onDrag={setDragId}
                                                    editor={presence.editors.get(task.id)}
                                                    staffName={s.name}
                                                    onMove={(target, baseline) => openMove(task, target, baseline)}
                                                    onDropTarget={setDropTarget}
                                                />
                                            ))}
                                            {presence.cells.filter((c) => c.staffId === s.id && c.day < days).map((c) => (
                                                <div key={c.key} className={styles.liveCell} style={{left: c.day * dayW, width: dayW, '--presence': cssColor(c.color)} as CSSProperties} aria-hidden>
                                                    <span className={styles.liveTag}>{c.name}</span>
                                                </div>
                                            ))}
                                            {draft?.staffId === s.id && (
                                                <CreateTaskPopover
                                                    key={draft.id}
                                                    opened={draft.open}
                                                    ghostStyle={{left: draft.from * dayW, width: (draft.to - draft.from + 1) * dayW - 4}}
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* closed (or loading another month): no panel, the board takes the width; the exit renders panelTask */}
                <Transition mounted={selected !== null && !skeleton} transition="slide-left" duration={150}>
                    {(style) => (panelTask ? (
                        <TaskPanel
                            key={panelTask.id}
                            style={style}
                            task={panelTask}
                            cutCode={cutCodes.get(panelTask.cut_id) ?? ''}
                            cuts={cutList}
                            staff={staff}
                            strengthLabels={strengthLabels}
                            workTypes={workTypes}
                            usedTypeIds={new Set(stages
                                .filter((x) => x.cut_id === panelTask.cut_id && x.id !== panelTask.id)
                                .map((x) => x.work_type_id))}
                            projectLinks={sanitizeLinks(project.links)}
                            panelDirtyRef={panelDirtyRef}
                            settle={settle}
                            discardPrompt={pendingNav !== null}
                            onResolveDiscard={resolveNav}
                            onClose={requestClose}
                            onUpdate={(patch, display, baseline) => selected && update(selected, patch, display, baseline)}
                            onReassign={(staffId) => selected && openMove(selected, {staff_id: staffId, start_date: selected.start_date, end_date: selected.end_date}, selected.version)}
                            onDelete={(baseline) => selected && remove(selected, baseline)}
                            onInvalidCut={() => setNotice(t.invalidCut)}
                        />
                    ) : <></>)}
                </Transition>
            </div>
            {lastMove && (
                <MoveDialog
                    opened={moveDraft !== null}
                    projectId={project.id}
                    task={lastMove.task}
                    cutCode={cutCodes.get(lastMove.task.cut_id) ?? ''}
                    workType={typeById.get(lastMove.task.work_type_id)}
                    fromName={staffNames.get(lastMove.task.staff_id) ?? ''}
                    toName={staffNames.get(lastMove.staff_id) ?? ''}
                    dates={lastMove.start_date !== lastMove.task.start_date || lastMove.end_date !== lastMove.task.end_date
                        ? {start: lastMove.start_date, end: lastMove.end_date}
                        : null}
                    onCancel={() => setMoveDraft(null)}
                    onConfirm={confirmMove}
                />
            )}
        </section>
    );
}
