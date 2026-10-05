import {describe, expect, it} from 'vitest';
import {filterTasks, fmtRange, sortTasks, type ListTask} from '../taskList';

const t = (id: string, cut_id: string, work_type_id: string, staff_id: string, start_date: string, is_fix = false): ListTask =>
    ({id, cut_id, work_type_id, staff_id, start_date, end_date: start_date, progress: 0, is_fix});
const ids = (list: {id: string}[]) => list.map((x) => x.id);

describe('filterTasks', () => {
    const tasks = [t('1', 'c1', 'lo', 'a', '2026-01-01'), t('2', 'c1', 'ge', 'b', '2026-01-01'), t('3', 'c2', 'lo', 'b', '2026-01-01')];
    it('empty = all; each filter any-of; ANDed across', () => {
        expect(ids(filterTasks(tasks, {staff: [], types: [], cuts: []}))).toEqual(['1', '2', '3']);
        expect(ids(filterTasks(tasks, {staff: ['b'], types: [], cuts: []}))).toEqual(['2', '3']);
        expect(ids(filterTasks(tasks, {staff: ['b'], types: ['lo'], cuts: []}))).toEqual(['3']);
        expect(ids(filterTasks(tasks, {staff: ['a', 'b'], types: ['lo', 'ge'], cuts: ['c1']}))).toEqual(['1', '2']);
        expect(ids(filterTasks(tasks, {staff: ['a'], types: [], cuts: ['c2']}))).toEqual([]);
    });
});

describe('sortTasks', () => {
    const codes: Record<string, string> = {c2: 'C2', c10: 'C10'};
    const order: Record<string, number> = {lo: 10, ge: 20};
    it('cut natural, type order, stage before fix, start date, id; input untouched', () => {
        const tasks = [
            t('f', 'c10', 'lo', 'a', '2026-01-01'),
            t('e', 'c2', 'ge', 'a', '2026-01-01'),
            t('d', 'c2', 'lo', 'a', '2026-01-01', true),
            t('c', 'c2', 'lo', 'a', '2026-03-01'),
            t('b', 'c2', 'lo', 'a', '2025-12-01', true),
            t('a', 'c2', 'lo', 'a', '2025-12-01', true),
        ];
        const copy = [...tasks];
        expect(ids(sortTasks(tasks, (id) => codes[id], (id) => order[id]))).toEqual(['c', 'a', 'b', 'd', 'e', 'f']);
        expect(tasks).toEqual(copy);
    });
});

describe('fmtRange', () => {
    it('dd/mm/yyyy – dd/mm/yyyy across years', () => {
        expect(fmtRange('2026-12-30', '2027-01-02')).toBe('30/12/2026 – 02/01/2027');
    });
});
