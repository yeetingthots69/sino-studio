'use client';

import {useOptimistic, useState, useTransition} from 'react';
import {Text} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createTask, deleteTask, updateTask, type ActionResult} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {addDays, assignLanes, isWeekend, monthRange, weekdayLabel} from '../dates';
import AddTaskButton from './AddTaskButton';
import Legend from './Legend';
import MonthNav from './MonthNav';
import TaskBar from './TaskBar';
import TaskPanel from './TaskPanel';
import {useRefreshScheduler} from './useRefreshScheduler';
import {useTaskRealtime} from './useTaskRealtime';
import {applyRealtime, upsertTask, type RealtimeChange} from './realtimeReducer';
import styles from './GanttBoard.module.css';

export type Task = Tables<'tracker_tasks'>;
export type Staff = Tables<'tracker_staff'>;
export type WorkType = Tables<'tracker_work_types'>;
export type TaskPatch = Partial<Pick<Task, 'name' | 'staff_id' | 'work_type_id' | 'start_date' | 'end_date' | 'progress'>>;

type OptimisticAction =
    | {type: 'update'; id: string; patch: TaskPatch}
    | {type: 'create'; task: Task}
    | {type: 'delete'; id: string};

export const DAY_W = 40;
export const DONE_COLOR = '#ef4444';

/** Fills `{key}` placeholders in a dictionary string. */
export const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

function reducer(tasks: Task[], a: OptimisticAction): Task[] {
    switch (a.type) {
        case 'update':
            return tasks.map((t) => (t.id === a.id ? {...t, ...a.patch} : t));
        case 'create':
            // upsert: the realtime INSERT may land before the create action resolves
            return upsertTask(tasks, a.task);
        case 'delete':
            return tasks.filter((t) => t.id !== a.id);
    }
}

interface Props {
    project: Tables<'tracker_projects'>;
    month: string;
    staff: Staff[];
    workTypes: WorkType[];
    tasks: Task[];
    locale: string;
}

export default function GanttBoard({project, month, staff, workTypes, tasks}: Props) {
    const {board: t, common} = useDictionary().tracker;
    // Local copy of the server tasks: task actions don't re-render the page, so each confirmed
    // server row is applied here. A new `tasks` prop (refresh / navigation) replaces it wholesale.
    const [taskList, setTaskList] = useState(tasks);
    const [prevTasks, setPrevTasks] = useState(tasks);
    if (tasks !== prevTasks) {
        setPrevTasks(tasks);
        setTaskList(tasks);
    }
    const [optimisticTasks, addOptimistic] = useOptimistic(taskList, reducer);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, startTransition] = useTransition();
    // refreshes (realtime or deferred) wait while a bar is dragged or the name draft is dirty
    const {dragging, panelDirty, requestRefresh, settle} = useRefreshScheduler();
    const {start: monthStart, end: monthEnd, days} = monthRange(month);
    const range = {start: monthStart, end: monthEnd};

    // Realtime rows go straight into the confirmed list (own echoes are idempotent). Only a row for a
    // staff member the page did not load (e.g. archived) needs the server render.
    const onRealtime = (change: RealtimeChange) => {
        if (change.newRow && change.newRow.project_id === project.id && !staff.some((s) => s.id === change.newRow.staff_id)) {
            requestRefresh();
            return;
        }
        setTaskList((list) => applyRealtime(list, change, project.id, range));
    };
    useTaskRealtime(project.id, month, onRealtime, requestRefresh);
    const dates = Array.from({length: days}, (_, i) => addDays(monthStart, i));
    const activeTypes = workTypes.filter((w) => !w.archived_at);
    const typeById = new Map(workTypes.map((w) => [w.id, w]));
    const selected = optimisticTasks.find((x) => x.id === selectedId) ?? null;

    /**
     * Optimistic write: shows `optimistic` now; on success applies the server row (`confirmed`) to
     * taskList in the same transition so nothing flickers back. On failure the optimistic state reverts.
     */
    function commit<T>(
        optimistic: OptimisticAction,
        run: () => Promise<ActionResult<T>>,
        confirmed: (data: T) => (list: Task[]) => Task[],
        onOk?: (data: T) => void,
    ) {
        startTransition(async () => {
            addOptimistic(optimistic);
            const r = await run();
            // updates after an await must be re-wrapped to stay in the transition
            startTransition(() => {
                if (!r.ok) {
                    setError(
                        r.error === 'not_found' ? common.error.notFound
                            : r.error === 'network' ? common.error.network
                                : common.error.generic,
                    );
                } else {
                    setError(null);
                    setTaskList(confirmed(r.data));
                    onOk?.(r.data);
                }
            });
            settle();
        });
    }

    const update = (id: string, patch: TaskPatch) => {
        // same month filter as realtime: a task whose new dates leave the viewed month disappears right away
        const current = optimisticTasks.find((x) => x.id === id);
        const next = current && {...current, ...patch};
        const staysVisible = !next || applyRealtime([], {type: 'UPDATE', newRow: next}, project.id, range).length > 0;
        commit(
            staysVisible ? {type: 'update', id, patch} : {type: 'delete', id},
            () => updateTask({id, ...patch}),
            (row) => (list) => applyRealtime(list, {type: 'UPDATE', newRow: row}, project.id, range),
        );
    };

    const remove = (id: string) => {
        setSelectedId(null);
        commit({type: 'delete', id}, () => deleteTask({id}), () => (list) => reducer(list, {type: 'delete', id}));
    };

    const add = (staffId: string) => {
        const input = {
            project_id: project.id,
            staff_id: staffId,
            work_type_id: activeTypes[0].id,
            name: 'C?',
            start_date: monthStart,
            end_date: monthStart,
            progress: 0,
        };
        const now = new Date().toISOString();
        const temp: Task = {...input, id: `tmp-${now}`, created_at: now, updated_at: now};
        commit(
            {type: 'create', task: temp},
            () => createTask(input),
            (row) => (list) => applyRealtime(list, {type: 'INSERT', newRow: row}, project.id, range),
            (row) => setSelectedId(row.id),
        );
    };

    return (
        <section className={styles.page}>
            <header className={styles.intro}>
                <Text size="sm" c="dimmed">{t.kicker}</Text>
                <h1 className={styles.title}>{t.title}</h1>
                <Text size="sm" c="dimmed">{t.hint}</Text>
            </header>

            <div className={styles.layout}>
                <div className={styles.card}>
                    <div className={styles.topBar}>
                        <MonthNav month={month}/>
                        <Legend workTypes={activeTypes}/>
                    </div>

                    <div className={styles.scroll}>
                        <div
                            className={styles.grid}
                            style={{
                                gridTemplateColumns: `48px 160px 220px repeat(${days}, ${DAY_W}px)`,
                                gridTemplateRows: `auto repeat(${staff.length}, auto)`,
                            }}
                        >
                            <div className={`${styles.head} ${styles.stickyStt}`} style={{gridArea: '1 / 1'}}>{t.stt}</div>
                            <div className={`${styles.head} ${styles.stickyName}`} style={{gridArea: '1 / 2'}}>{t.staff}</div>
                            <div className={`${styles.head} ${styles.stickyStrengths}`} style={{gridArea: '1 / 3'}}>{t.strengths}</div>
                            {dates.map((d, i) => (
                                <div key={d} className={`${styles.head} ${styles.dayHead} ${isWeekend(d) ? styles.weekendText : ''}`} style={{gridArea: `1 / ${i + 4}`}}>
                                    <span>{weekdayLabel(d)}</span>
                                    <span>{i + 1}</span>
                                </div>
                            ))}
                            {dates.map((d, i) => isWeekend(d) && (
                                <div key={`w-${d}`} className={styles.weekend} style={{gridColumn: i + 4}}/>
                            ))}

                            {staff.map((s, idx) => {
                                const rowTasks = optimisticTasks.filter((x) => x.staff_id === s.id);
                                const lanes = assignLanes(rowTasks);
                                const laneCount = Math.max(1, ...[...lanes.values()].map((l) => l + 1));
                                const height = laneCount * DAY_W + 8;
                                const archived = !!s.archived_at;
                                const row = idx + 2; // explicit placement so weekend overlays never displace cells
                                return (
                                    <div key={s.id} className={styles.row}>
                                        <div className={`${styles.cell} ${styles.stickyStt} ${styles.muted}`} style={{height, gridArea: `${row} / 1`}}>
                                            {idx + 1}
                                        </div>
                                        <div className={`${styles.cell} ${styles.stickyName}`} style={{height, gridArea: `${row} / 2`}}>
                                            <span className={`${styles.name} ${archived ? styles.muted : ''}`}>{s.name}</span>
                                            {!archived && activeTypes.length > 0 && (
                                                <AddTaskButton label={fill(t.addTask, {name: s.name})} onClick={() => add(s.id)}/>
                                            )}
                                        </div>
                                        <div className={`${styles.cell} ${styles.stickyStrengths} ${styles.muted}`} style={{height, gridArea: `${row} / 3`}}>
                                            <span className={styles.ellipsis}>{s.strengths}</span>
                                        </div>
                                        <div className={styles.track} style={{height, gridRow: row, gridColumn: `4 / span ${days}`}}>
                                            {rowTasks.map((task) => (
                                                <TaskBar
                                                    key={task.id}
                                                    task={task}
                                                    workType={typeById.get(task.work_type_id)}
                                                    month={month}
                                                    lane={lanes.get(task) ?? 0}
                                                    selected={task.id === selectedId}
                                                    draggingRef={dragging}
                                                    settle={settle}
                                                    onSelect={() => setSelectedId(task.id)}
                                                    onCommit={(patch) => update(task.id, patch)}
                                                />
                                            ))}
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
                    staff={staff}
                    workTypes={workTypes}
                    error={error}
                    panelDirtyRef={panelDirty}
                    settle={settle}
                    onUpdate={(patch) => selected && update(selected.id, patch)}
                    onDelete={() => selected && remove(selected.id)}
                />
            </div>
        </section>
    );
}
