import type {Tables} from '@/types/database.types';
import {compareCutCodes} from './cuts';
import type {ISODate} from './dates';

export type ListTask = Pick<Tables<'tracker_tasks'>,
    'id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'start_date' | 'end_date' | 'progress' | 'is_fix'>;

/** Each filter is a list of ids; empty = all. The three are ANDed. */
export function filterTasks<T extends ListTask>(tasks: T[], f: {staff: string[]; types: string[]; cuts: string[]}): T[] {
    const has = (ids: string[], id: string) => ids.length === 0 || ids.includes(id);
    return tasks.filter((t) => has(f.staff, t.staff_id) && has(f.types, t.work_type_id) && has(f.cuts, t.cut_id));
}

/** Cut code (natural), work type order, stage before fix, start date, id. Returns a new array. */
export function sortTasks<T extends ListTask>(tasks: T[], cutCode: (cutId: string) => string, typeOrder: (typeId: string) => number): T[] {
    return [...tasks].sort((a, b) =>
        compareCutCodes(cutCode(a.cut_id), cutCode(b.cut_id))
        || typeOrder(a.work_type_id) - typeOrder(b.work_type_id)
        || Number(a.is_fix) - Number(b.is_fix)
        || a.start_date.localeCompare(b.start_date)
        || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const dmy = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** '2026-12-30', '2027-01-02' → '30/12/2026 – 02/01/2027'. */
export const fmtRange = (start: ISODate, end: ISODate) => `${dmy(start)} – ${dmy(end)}`;
