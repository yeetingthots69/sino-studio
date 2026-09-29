import type {Tables} from '@/types/database.types';

type Task = Tables<'tracker_tasks'>;

export type RealtimeChange =
    | {type: 'INSERT' | 'UPDATE'; newRow: Task; oldId?: undefined}
    | {type: 'DELETE'; newRow?: undefined; oldId: string};

/** Realtime dates should already be 'YYYY-MM-DD'; slice defensively in case a timestamp form arrives. */
export function normalizeRow(row: Task): Task {
    return {...row, start_date: String(row.start_date).slice(0, 10), end_date: String(row.end_date).slice(0, 10)};
}

export function upsertTask(list: Task[], task: Task): Task[] {
    return list.some((t) => t.id === task.id) ? list.map((t) => (t.id === task.id ? task : t)) : [...list, task];
}

const without = (list: Task[], id: string) => (list.some((t) => t.id === id) ? list.filter((t) => t.id !== id) : list);

/**
 * Applies one realtime change to the board's confirmed task list (one project, one month).
 * Rows of other projects are ignored unless present (moved away → removed); rows that no longer
 * overlap the month are removed.
 */
export function applyRealtime(
    list: Task[],
    change: RealtimeChange,
    projectId: string,
    range: {start: string; end: string},
): Task[] {
    if (change.type === 'DELETE') return without(list, change.oldId);
    const row = normalizeRow(change.newRow);
    if (row.project_id !== projectId) return without(list, row.id);
    const overlaps = row.start_date <= range.end && row.end_date >= range.start;
    return overlaps ? upsertTask(list, row) : without(list, row.id);
}
