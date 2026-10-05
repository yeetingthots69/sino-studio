'use client';

import {useState} from 'react';
import {MultiSelect, Progress, Text} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import type {Tables} from '@/types/database.types';
import {compareCutCodes} from '../cuts';
import {foldFilter} from '../staffView';
import {filterTasks, fmtRange, sortTasks, type ListTask} from '../taskList';
import ProjectViewTabs from '../ProjectViewTabs/ProjectViewTabs';
import {fill} from '../GanttBoard/GanttBoard';
import styles from './TaskListView.module.css';

type Staff = Pick<Tables<'tracker_staff'>, 'id' | 'name' | 'archived_at'>;
type WorkType = Pick<Tables<'tracker_work_types'>, 'id' | 'code' | 'label' | 'color' | 'sort_order'>;

interface Props {
    project: Pick<Tables<'tracker_projects'>, 'id' | 'name'>;
    /** `?m=` of the board, passed through to the view tabs only. */
    month?: string;
    /** By sort_order. */
    workTypes: WorkType[];
    cuts: Pick<Tables<'tracker_cuts'>, 'id' | 'code'>[];
    /** Every task of the project. */
    tasks: ListTask[];
    /** Studio staff by sort_order, name. */
    staff: Staff[];
}

/** Read-only task list of one project (plan §3.6). Filters live in state only. */
export default function TaskListView({project, month, workTypes, cuts, tasks, staff}: Props) {
    const {taskList: t, cuts: ct, board} = useDictionary().tracker;
    const [staffIds, setStaffIds] = useState<string[]>([]);
    const [typeIds, setTypeIds] = useState<string[]>([]);
    const [cutIds, setCutIds] = useState<string[]>([]);

    const cutCode = new Map(cuts.map((c) => [c.id, c.code]));
    const typeById = new Map(workTypes.map((w) => [w.id, w]));
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const owners = new Set(tasks.map((x) => x.staff_id));

    const staffData = staff.filter((s) => owners.has(s.id))
        .map((s) => ({value: s.id, label: s.archived_at ? `${s.name} (${t.archived})` : s.name}));
    const typeData = workTypes.map((w) => ({value: w.id, label: `${w.code} · ${w.label}`}));
    const cutData = [...cuts].sort((a, b) => compareCutCodes(a.code, b.code)).map((c) => ({value: c.id, label: c.code}));

    const rows = sortTasks(
        filterTasks(tasks, {staff: staffIds, types: typeIds, cuts: cutIds}),
        (id) => cutCode.get(id) ?? '',
        (id) => typeById.get(id)?.sort_order ?? 0,
    );

    const filters = [
        {label: t.staff, data: staffData, value: staffIds, set: setStaffIds, filter: foldFilter},
        {label: t.workType, data: typeData, value: typeIds, set: setTypeIds},
        {label: t.cut, data: cutData, value: cutIds, set: setCutIds},
    ];

    return (
        <section className={styles.page}>
            <header className={styles.intro}>
                <div>
                    <Text size="sm" c="dimmed">{ct.kicker} · {project.name}</Text>
                    <h1 className={styles.title}>{t.title}</h1>
                    <Text size="sm" c="dimmed">{t.hint}</Text>
                </div>
                <ProjectViewTabs projectId={project.id} active="tasks" month={month}/>
            </header>

            <div className={styles.toolbar}>
                {filters.map((f) => (
                    <MultiSelect
                        key={f.label}
                        label={f.label}
                        data={f.data}
                        value={f.value}
                        onChange={f.set}
                        filter={f.filter}
                        placeholder={f.value.length ? undefined : t.all}
                        searchable
                        clearable
                        w={240}
                    />
                ))}
            </div>

            <Text size="sm" c="dimmed" mb={8} aria-live="polite">{fill(t.count, {count: rows.length})}</Text>

            <div className={styles.scroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th scope="col">{t.colCut}</th>
                            <th scope="col">{t.colType}</th>
                            <th scope="col">{t.colStaff}</th>
                            <th scope="col">{t.colDates}</th>
                            <th scope="col">{t.colProgress}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={5} className={styles.empty}>{t.empty}</td>
                            </tr>
                        ) : rows.map((x) => {
                            const w = typeById.get(x.work_type_id);
                            const s = staffById.get(x.staff_id);
                            const code = w?.code ?? '—';
                            return (
                                <tr key={x.id}>
                                    <td className={styles.cut}>{cutCode.get(x.cut_id) ?? '—'}</td>
                                    <td>
                                        <span className={styles.type}>
                                            <span className={styles.swatch} style={{background: w?.color}}/>
                                            <b>{x.is_fix ? `${code} · ${board.fix}` : code}</b>
                                            {w && <span className={styles.dim}>{w.label}</span>}
                                        </span>
                                    </td>
                                    <td>
                                        {s?.name ?? '—'}
                                        {s?.archived_at && <span className={styles.dim}> ({t.archived})</span>}
                                    </td>
                                    <td className={styles.num}>{fmtRange(x.start_date, x.end_date)}</td>
                                    <td>
                                        <span className={styles.progress}>
                                            <Progress value={x.progress} size="sm" w={80} aria-hidden/>
                                            <span className={styles.num}>{x.progress}%</span>
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
