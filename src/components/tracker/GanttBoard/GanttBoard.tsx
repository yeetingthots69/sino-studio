'use client';

import {useEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {ActionIcon, Avatar, Button, CloseButton, MultiSelect, Skeleton, Text, TextInput, Tooltip, Transition, UnstyledButton, VisuallyHidden} from '@mantine/core';
import {IconArrowBackUp, IconArrowForwardUp, IconArrowsSort, IconEye, IconEyeOff, IconSortAscendingLetters, IconSortDescendingLetters} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createTask, deleteTask, moveTask, updateTask, type ActionResult, type TaskPatch as ActionTaskPatch} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {getBrowserClient} from '@/utils/supabase/client';
import {compareCutCodes} from '../cuts';
import {sanitizeLinks} from '../links';
import {addDays, assignLanes, daysBetween, isWeekend, monthRange, weekdayLabel} from '../dates';
import {viewStaff} from '../staffView';
import {boardStaff, memberSet, type Department, type MemberRow} from '../members';
import {typeRule} from '../pipeline';
import {budgetValues} from '../pay';
import type {Phase} from '../phases';
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
import {useBoardPrefs, useProjectFilter} from './useBoardPrefs';
import {useDragCreate} from './useDragCreate';
import {useRefreshScheduler} from './useRefreshScheduler';
import {useTaskRealtime} from './useTaskRealtime';
import {useWheelHandoff} from './wheelHandoff';
import {EMPTY_UNDO, inverse, payUnchanged, rebase, record, remap, restoreInput, settled, take, type Dir, type Fields, type UndoEntry, type UndoState} from './undoStack';
import UndoToast, {type UndoToastData} from './UndoToast';
import {isRealtimeBusy, useRealtimeIdle, useRealtimeTables} from '@/components/tracker/useRealtimeRefresh';
import styles from './GanttBoard.module.css';

export type Task = Tables<'tracker_tasks'>;
export type Staff = Tables<'tracker_staff'>;
export type WorkType = Tables<'tracker_work_types'>;
export type Cut = Tables<'tracker_cuts'>;
export type StageRow = Pick<Task, 'id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'start_date' | 'end_date' | 'version' | 'is_fix'>;
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

/** Undo/redo stacks per project: module-level so they survive the per-month remount; cleared on reload. */
const undoStore = new Map<string, UndoState>();
const undoListeners = new Set<() => void>();
const subscribeUndo = (l: () => void) => {
    undoListeners.add(l);
    return () => void undoListeners.delete(l);
};
/** Board writes in flight per project, across month remounts (an old board's write still blocks undo on the new one). */
const inFlight = new Map<string, number>();
const bumpInFlight = (projectId: string, d: 1 | -1) => {
    inFlight.set(projectId, (inFlight.get(projectId) ?? 0) + d);
    for (const l of undoListeners) l();
};
const UPDATE_KEYS = ['start_date', 'end_date', 'progress', 'links', 'work_type_id'] as const;

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
    /** Every staff, archived included (name lookups); rows are picked by `boardStaff`. */
    staff: Staff[];
    /** The project's departments by sort_order, name. */
    departments: Department[];
    /** The project's member rows (staff × department). */
    members: MemberRow[];
    /** The project's work types by sort_order. */
    workTypes: WorkType[];
    /** The project's phases (v2.8: the order rule). */
    phases: Phase[];
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

const BOARD_TABLES = [
    'tracker_projects', 'tracker_work_types', 'tracker_staff', 'tracker_strengths', 'tracker_staff_strengths', 'tracker_shares',
    'tracker_departments', 'tracker_member_departments',
];

export default function GanttBoard(props: Props) {
    const {project, month, locale, staff, workTypes, phases, strengths, staffStrengths, cuts: cutRows, tasks, stages: stageRows, departments, members} = props;
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
    // undo/redo: the module map is the synchronous source (survives the month remount), rendered via useSyncExternalStore
    const getUndo = () => undoStore.get(project.id) ?? EMPTY_UNDO;
    const undo = useSyncExternalStore(subscribeUndo, getUndo, getUndo);
    const getFlying = () => inFlight.get(project.id) ?? 0;
    const flying = useSyncExternalStore(subscribeUndo, getFlying, getFlying);
    const setUndo = (f: (s: UndoState) => UndoState) => {
        undoStore.set(project.id, f(getUndo()));
        for (const l of undoListeners) l();
    };
    const [toast, setToast] = useState<UndoToastData | null>(null);
    // ref = synchronous guard, state = disabled buttons; held for the whole runUndo / New Task create
    const undoBusyRef = useRef(false);
    const [undoBusy, setUndoBusy] = useState(false);
    const createBusyRef = useRef(false);
    const [createBusy, setCreateBusy] = useState(false);
    // toast buttons call the latest runUndo (fresh barrier and lookups), not the one of the render that made the toast
    const runUndoRef = useRef<(dir: Dir) => void>(() => {});
    const [prefs, setPrefs] = useBoardPrefs();
    const [savedFilter, setSavedFilter] = useProjectFilter(project.id);
    const [nameQuery, setNameQuery] = useState('');
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
    const rule = typeRule(workTypes, phases);
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
    // rows: active members ∪ owners of a displayed task (optimistic state included); only members are assignable
    const deptsByStaff = memberSet(members, departments);
    const deptById = new Map(departments.map((d) => [d.id, d]));
    const {rows: boardRows, assignable} = boardStaff(staff, deptsByStaff, shown.map((x) => x.staff_id));
    // saved ids of deleted strengths/departments are ignored
    const filter = savedFilter.strengths.filter((id) => strengthById.has(id));
    const deptFilter = savedFilter.departments.filter((id) => deptById.has(id));
    const filtered = filter.length > 0 || deptFilter.length > 0 || nameQuery.trim() !== '';
    const rows = viewStaff(boardRows, strengthIdsByStaff, allRounderIds, {sort: prefs.sort, filter}, {name: nameQuery, departments: deptFilter, deptsByStaff});
    const lead = hide ? 2 : 3; // fixed columns before the day columns
    const SortIcon = SORT_ICON[prefs.sort];

    const describeConflict = (conflictId: string | undefined, typeId: string | undefined) =>
        orderConflictText(t, conflictId, typeId, stages, cutCodes, typeById, rule);

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
            case 'fix_no_stage':
                return t.fixNoStageError;
            case 'staff_not_member':
                return t.staffNotMember;
            case 'phase_locked':
                return t.phaseLocked;
            case 'phase_invalid':
                return t.phaseInvalid;
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
     * `ctx.expected` (undo/redo): send that version as is, no planCommit (the task may be off-month or not in the
     * store); the server version check decides. `ctx.undo`: refusals show the undo conflict text.
     * Resolves true when the write succeeded.
     */
    function commit<T>(
        id: string,
        baseline: number,
        optimistic: Omit<Pending, 'seq' | 'id'>,
        send: (expected_version: number) => Promise<ActionResult<T>>,
        onOk: (data: T) => void,
        ctx: {typeId?: string; cut?: boolean; expected?: number; undo?: boolean},
    ): Promise<boolean> {
        const seq = ++seqRef.current;
        setPending((p) => [...p, {seq, id, ...optimistic}]);
        setNotice(null);
        const conflictText = ctx.undo ? t.undo.conflict : t.conflict;
        bumpInFlight(project.id, 1);
        return chain(id, async () => {
            const plan = ctx.expected === undefined ? planCommit(store.get(), id, baseline) : {expected_version: ctx.expected};
            if (plan === 'conflict-local') {
                setNotice(conflictText);
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
                setNotice(conflictText);
                return false;
            }
            store.apply({kind: 'ack', id});
            setNotice(ctx.undo && r.error === 'not_found' ? conflictText : failText(r, ctx));
            return false;
        }).then((outcome) => {
            bumpInFlight(project.id, -1);
            setPending((p) => p.filter((x) => x.seq !== seq));
            settle();
            return outcome === 'ok';
        });
    }

    // version invariant: every own confirmed write rebases that task's entries; a no-op change records nothing
    const confirmWrite = (id: string, version: number, entry?: UndoEntry, same?: boolean) => {
        setUndo((s) => {
            const r = rebase(s, id, version);
            return entry && !same ? record(r, entry) : r;
        });
        if (entry && !same) setToast({text: entry.label, action: {label: t.undo.undo, onClick: () => runUndoRef.current('undo')}});
    };
    const typeCode = (typeId: string, isFix = false) => (typeById.get(typeId)?.code ?? '') + (isFix ? ` · ${t.fix}` : '');
    const codes = (cutId: string, typeId: string, isFix = false) => ({cut: cutCodes.get(cutId) ?? '', type: typeCode(typeId, isFix)});

    const update = (task: Task, patch: TaskPatch, display: Partial<Task>, baseline: number) => {
        // undo entry: before-values from the displayed task at action start, after-values from the returned row
        const keys = UPDATE_KEYS.filter((k) => patch[k] !== undefined);
        const pick = (r: Task) => Object.fromEntries(keys.map((k) => [k, r[k]])) as Fields;
        const before = pick(task);
        const beforeCut = cutCodes.get(task.cut_id) ?? '';
        const kind = patch.cut_code !== undefined ? 'cut' : patch.work_type_id !== undefined ? 'type'
            : patch.progress !== undefined ? 'progress' : patch.links !== undefined ? 'links' : 'dates';
        return commit(
            task.id,
            baseline,
            {patch: display},
            (expected_version) => updateTask({id: task.id, expected_version, patch}),
            (row) => {
                store.apply({kind: 'ack', id: task.id, row});
                // a new cut arrives by realtime; without it (channel down) the refresh brings it
                if (!cuts.has(row.cut_id)) requestRefresh();
                const after = pick(row);
                if (patch.cut_code !== undefined) {
                    before.cut_code = beforeCut;
                    after.cut_code = patch.cut_code;
                }
                const label = fill(t.undo.label[kind], {cut: patch.cut_code ?? beforeCut, type: typeCode(row.work_type_id, row.is_fix)});
                confirmWrite(task.id, row.version, {kind: 'update', id: task.id, version: row.version, before, after, label},
                    JSON.stringify(before) === JSON.stringify(after));
            },
            {typeId: patch.work_type_id ?? task.work_type_id, cut: patch.cut_code !== undefined},
        );
    };

    const snapshotOf = (task: Task) => ({
        project_id: task.project_id, staff_id: task.staff_id, work_type_id: task.work_type_id,
        cut_code: cutCodes.get(task.cut_id) ?? '', budgets: cuts.has(task.cut_id) ? budgetValues(cuts.get(task.cut_id)!) : null,
        start_date: task.start_date, end_date: task.end_date, progress: task.progress, links: task.links, is_fix: task.is_fix,
    });

    const remove = (task: Task, baseline: number) => {
        setSelectedId(null);
        const entry: UndoEntry = {kind: 'presence', id: task.id, version: task.version, exists: false, snapshot: snapshotOf(task),
            label: fill(t.undo.label.deleted, codes(task.cut_id, task.work_type_id, task.is_fix))};
        commit(
            task.id,
            baseline,
            {patch: {}, hide: true},
            (expected_version) => deleteTask({id: task.id, expected_version}),
            () => {
                store.apply({kind: 'ownDelete', id: task.id});
                confirmWrite(task.id, task.version, entry);
            },
            {},
        );
    };

    const draft = drag.draft;
    // the draft's row stopped being assignable (e.g. removed from the project in another tab): drop the popover
    useEffect(() => {
        if (draft && !assignable.has(draft.staffId)) drag.close();
    });
    const create = async (input: CreateInput): Promise<string | null> => {
        if (!draft) return null;
        createBusyRef.current = true;
        setCreateBusy(true);
        bumpInFlight(project.id, 1);
        const r = await createTask({
            ...input,
            project_id: project.id,
            staff_id: draft.staffId,
            start_date: addDays(monthStart, draft.from),
            end_date: addDays(monthStart, draft.to),
        }).catch(() => ({ok: false, error: 'network'}) as const).finally(() => {
            createBusyRef.current = false;
            setCreateBusy(false);
            bumpInFlight(project.id, -1);
        });
        if (!r.ok) return failText(r, {typeId: input.work_type_id, cut: true});
        const {task, cut} = r.data;
        store.apply({kind: 'ack', id: task.id, row: task});
        setCuts((m) => new Map(m).set(cut.id, cut));
        confirmWrite(task.id, task.version, {kind: 'presence', id: task.id, version: task.version, exists: true,
            snapshot: {...snapshotOf(task), cut_code: cut.code, budgets: budgetValues(cut)},
            label: fill(t.undo.label.created, {cut: cut.code, type: typeCode(task.work_type_id, task.is_fix)})});
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
        const before = {staff_id: task.staff_id, start_date: task.start_date, end_date: task.end_date};
        commit(
            task.id,
            baseline,
            {patch: {staff_id, start_date, end_date}},
            (expected_version) => moveTask({id: task.id, expected_version, staff_id, start_date, end_date, move_adjustments: moveAdjustments, op_id, reason}),
            (row) => {
                store.apply({kind: 'ack', id: task.id, row});
                const after = {staff_id: row.staff_id, start_date: row.start_date, end_date: row.end_date};
                confirmWrite(task.id, row.version, {
                    kind: 'move', id: task.id, version: row.version, before, after, moveAdjustments, opId: op_id,
                    cut_id: row.cut_id, work_type_id: row.work_type_id,
                    label: fill(t.undo.label.move, {...codes(row.cut_id, row.work_type_id, row.is_fix), name: staffNames.get(row.staff_id) ?? ''}),
                }, JSON.stringify(before) === JSON.stringify(after));
            },
            {typeId: task.work_type_id},
        );
    };

    // Undo/redo barrier: a pending write, the panel draft or its discard prompt, MoveDialog, New Task, a bar drag.
    // State drives the buttons; `blocked()` adds the synchronous refs for keys and clicks.
    const undoBlocked = pending.length > 0 || flying > 0 || undoBusy || createBusy || panelIsDirty || pendingNav !== null
        || moveDraft !== null || draft !== null || dragId !== null;
    const blocked = () => undoBlocked || getFlying() > 0 || undoBusyRef.current || createBusyRef.current || panelDirtyRef.current || dragging.current;
    const toastLabel = (label: string, start: string, end: string) => (start <= monthEnd && end >= monthStart
        ? label
        : fill(t.undo.offMonth, {label, m: Number(start.slice(5, 7)), y: start.slice(0, 4)}));

    /** Sends the inverse of `e`; resolves the settled entry (new version / id) and the task's dates, or null (dropped). */
    async function applyInverse(e: UndoEntry, dir: Dir): Promise<{entry: UndoEntry; start: string; end: string} | null> {
        const inv = inverse(e, dir);
        const got: {row?: Task} = {};
        const ack = (row: Task) => {
            store.apply({kind: 'ack', id: row.id, row});
            got.row = row;
        };
        switch (inv.op) {
            case 'update': {
                const {cut_code, links, ...rest} = inv.fields;
                const patch: TaskPatch = {...rest, ...(cut_code === undefined ? {} : {cut_code}), ...(links === undefined ? {} : {links: sanitizeLinks(links)})};
                const cutId = cut_code === undefined ? undefined : cutList.find((c) => c.code === cut_code)?.id;
                const display: Partial<Task> = {...rest, ...(links === undefined ? {} : {links}), ...(cutId ? {cut_id: cutId} : {})};
                const ok = await commit(e.id, e.version, {patch: display}, (v) => updateTask({id: e.id, expected_version: v, patch}), (row) => {
                    ack(row);
                    if (!cuts.has(row.cut_id)) requestRefresh();
                }, {typeId: patch.work_type_id ?? store.get().entries.get(e.id)?.row.work_type_id, cut: cut_code !== undefined, expected: e.version, undo: true});
                return ok && got.row ? {entry: {...e, version: got.row.version}, start: got.row.start_date, end: got.row.end_date} : null;
            }
            case 'move': {
                if (e.kind !== 'move') return null;
                const {placement, holder, moveAdjustments} = inv;
                if (moveAdjustments) {
                    // proceed only if the holder's open rows for the stage are exactly the copies the last move made
                    let rows = null;
                    try {
                        rows = (await getBrowserClient().from('tracker_pay_adjustments')
                            .select('id, staff_id, cut_id, work_type_id, amount, reverses_id, batch_id')
                            .eq('project_id', project.id).eq('cut_id', e.cut_id).eq('work_type_id', e.work_type_id).eq('staff_id', holder)).data;
                    } catch {
                        // network failure → generic message below
                    }
                    if (!rows) {
                        setNotice(common.error.generic);
                        return null;
                    }
                    if (!payUnchanged(rows, {staff_id: holder, cut_id: e.cut_id, work_type_id: e.work_type_id}, e.opId)) {
                        setNotice(t.undo.payChanged);
                        return null;
                    }
                }
                const op_id = crypto.randomUUID();
                const reason = fill(t.undo.moveReason, {...codes(e.cut_id, e.work_type_id), name: staffNames.get(placement.staff_id) ?? ''});
                const ok = await commit(e.id, e.version, {patch: {...placement}},
                    (v) => moveTask({id: e.id, expected_version: v, ...placement, move_adjustments: moveAdjustments, op_id, reason}),
                    ack, {typeId: e.work_type_id, expected: e.version, undo: true});
                return ok && got.row ? {entry: {...e, version: got.row.version, opId: op_id}, start: got.row.start_date, end: got.row.end_date} : null;
            }
            case 'delete': {
                if (e.kind !== 'presence') return null;
                if (selectedId === e.id) setSelectedId(null);
                const ok = await commit(e.id, e.version, {patch: {}, hide: true}, (v) => deleteTask({id: e.id, expected_version: v}),
                    () => store.apply({kind: 'ownDelete', id: e.id}), {expected: e.version, undo: true});
                return ok ? {entry: e, start: e.snapshot.start_date, end: e.snapshot.end_date} : null;
            }
            case 'create': {
                // re-create (new id), then restore progress/links when they differ from the DB defaults (0, [])
                const s = inv.snapshot;
                const r = await createTask(restoreInput(s)).catch(() => ({ok: false, error: 'network'}) as const);
                if (!r.ok) {
                    setNotice(failText(r, {typeId: s.work_type_id, cut: true}));
                    return null;
                }
                const {task, cut} = r.data;
                store.apply({kind: 'ack', id: task.id, row: task});
                setCuts((m) => new Map(m).set(cut.id, cut));
                setUndo((st) => remap(st, e.id, task.id, task.version));
                let version = task.version;
                const links = sanitizeLinks(s.links);
                if (s.progress !== 0 || links.length > 0) {
                    // failure: the banner only; the re-created task stays recorded at its real version
                    const ok = await commit(task.id, version, {patch: {progress: s.progress, links: s.links}},
                        (v) => updateTask({id: task.id, expected_version: v, patch: {progress: s.progress, links}}), ack, {expected: version});
                    if (ok && got.row) {
                        version = got.row.version;
                        setUndo((st) => rebase(st, task.id, version));
                    }
                }
                return {entry: {...e, id: task.id, version}, start: task.start_date, end: task.end_date};
            }
        }
    }

    async function runUndo(dir: Dir) {
        if (blocked()) return;
        const taken = take(getUndo(), dir);
        if (!taken) return;
        undoBusyRef.current = true;
        setUndoBusy(true);
        bumpInFlight(project.id, 1);
        try {
            setUndo(() => taken.state); // the entry is dropped unless it settles
            setNotice(null);
            const done = await applyInverse(taken.entry, dir);
            if (!done) return;
            setUndo((s) => settled(s, dir, done.entry, taken.gen));
            const back: Dir = dir === 'undo' ? 'redo' : 'undo';
            setToast({
                text: fill(dir === 'undo' ? t.undo.undone : t.undo.redone, {label: toastLabel(done.entry.label, done.start, done.end)}),
                action: {label: t.undo[back], onClick: () => runUndoRef.current(back)},
            });
        } finally {
            undoBusyRef.current = false;
            setUndoBusy(false);
            bumpInFlight(project.id, -1);
        }
    }
    useEffect(() => {
        runUndoRef.current = (dir) => void runUndo(dir);
    });

    // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = redo; fields, dialogs and popovers keep their own undo
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey || e.repeat || e.isComposing || e.defaultPrevented) return;
            const dir: Dir | null = e.code === 'KeyZ' ? (e.shiftKey ? 'redo' : 'undo') : e.code === 'KeyY' ? 'redo' : null;
            if (!dir) return;
            const el = e.target instanceof HTMLElement ? e.target : null;
            if (el?.isContentEditable) return;
            if (el?.closest('input, textarea, select, [aria-modal="true"], [role=listbox], .mantine-Popover-dropdown')) return;
            if (blocked()) return;
            e.preventDefault();
            void runUndo(dir);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    });

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
                    <h1 className={styles.title}>{project.name}</h1>
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
                        <ActionIcon.Group>
                            {/* span wrappers: a disabled button gets no pointer events, the hint still shows */}
                            <Tooltip label={t.undo.undoHint}>
                                <span>
                                    <ActionIcon variant="subtle" color="gray" aria-label={t.undo.undo} disabled={undoBlocked || undo.undo.length === 0} onClick={() => void runUndo('undo')}>
                                        <IconArrowBackUp size={18}/>
                                    </ActionIcon>
                                </span>
                            </Tooltip>
                            <Tooltip label={t.undo.redoHint}>
                                <span>
                                    <ActionIcon variant="subtle" color="gray" aria-label={t.undo.redo} disabled={undoBlocked || undo.redo.length === 0} onClick={() => void runUndo('redo')}>
                                        <IconArrowForwardUp size={18}/>
                                    </ActionIcon>
                                </span>
                            </Tooltip>
                        </ActionIcon.Group>
                        {/* staff filters: name (not saved), departments (saved per project); strengths sit in their column header */}
                        <div className={styles.filters}>
                            <TextInput
                                size="xs"
                                aria-label={t.filters.name}
                                placeholder={t.filters.name}
                                value={nameQuery}
                                onChange={(e) => setNameQuery(e.currentTarget.value)}
                                rightSectionPointerEvents="all"
                                rightSection={nameQuery && <CloseButton size="xs" aria-label={t.filters.clearName} onClick={() => setNameQuery('')}/>}
                            />
                            <MultiSelect
                                className={styles.deptFilter}
                                size="xs"
                                aria-label={t.filters.departments}
                                placeholder={deptFilter.length ? undefined : t.filters.departments}
                                data={departments.map((d) => ({value: d.id, label: d.name}))}
                                value={deptFilter}
                                onChange={(v) => setSavedFilter({strengths: filter, departments: v})}
                                clearable
                            />
                            {filtered && (
                                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => {
                                    setNameQuery('');
                                    setSavedFilter({strengths: [], departments: []});
                                }}>
                                    {t.filters.clear}
                                </Button>
                            )}
                        </div>
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
                                <span className={`${styles.muted} ${styles.shownCount}`} role="status">
                                    {fill(t.filters.shown, {shown: rows.length, total: boardRows.length})}
                                </span>
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
                                        onChange={(v) => setSavedFilter({strengths: v, departments: deptFilter})}
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
                                // archived or non-member rows are greyed and accept no drop / "+" / drag-create
                                const assignableRow = assignable.has(s.id);
                                const active = assignableRow && workTypes.length > 0;
                                const depts = (deptsByStaff.get(s.id) ?? []).flatMap((id) => deptById.get(id) ?? []);
                                const row = idx + 2; // explicit placement so weekend overlays never displace cells
                                return (
                                    <div key={s.id} className={styles.row}>
                                        <div className={`${styles.cell} ${styles.stickyStt} ${styles.muted}`} style={{height, gridArea: `${row} / 1`}}>
                                            {idx + 1}
                                        </div>
                                        <div className={`${styles.cell} ${styles.stickyName} ${hide ? styles.stickyLast : ''}`} style={{height, gridArea: `${row} / 2`}}>
                                            <div className={styles.nameBlock}>
                                                <Link
                                                    href={`/${locale}/tracker/${project.id}/people/${s.id}`}
                                                    className={`${styles.name} ${assignableRow ? '' : styles.muted}`}
                                                >
                                                    {s.name}
                                                </Link>
                                                {depts.length > 0 && (
                                                    <span className={styles.chips} title={depts.map((d) => d.name).join(', ')}>
                                                        {depts.map((d) => (
                                                            <span key={d.id} className={styles.chip}>
                                                                <span className={styles.chipDot} style={{background: d.color}}/>
                                                                <span className={styles.chipName}>{d.name}</span>
                                                            </span>
                                                        ))}
                                                    </span>
                                                )}
                                            </div>
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
                                                    typeRule={rule}
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
                        {boardRows.length === 0 && !skeleton && (
                            // no active members and nobody owns a task this month
                            <div className={styles.empty}>
                                <Text size="sm" c="dimmed">{t.filters.emptyTitle}</Text>
                                <Link href={`/${locale}/tracker/${project.id}/members`}>{t.filters.emptyLink}</Link>
                            </div>
                        )}
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
                            members={deptsByStaff}
                            strengthLabels={strengthLabels}
                            workTypes={workTypes}
                            usedTypeIds={new Set(stages
                                .filter((x) => x.cut_id === panelTask.cut_id && x.id !== panelTask.id && !x.is_fix)
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
            {/* closes only the toast it was opened for: a toast button may already have set the next one */}
            <UndoToast toast={toast} onClose={() => setToast((cur) => (cur === toast ? null : cur))}/>
        </section>
    );
}
