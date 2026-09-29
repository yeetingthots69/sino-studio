import {describe, expect, it} from 'vitest';
import type {Tables} from '@/types/database.types';
import {applyRealtime} from '../realtimeReducer';

type Task = Tables<'tracker_tasks'>;

const P = 'project-a';
const SEPT = {start: '2026-09-01', end: '2026-09-30'};
const task = (id: string, over: Partial<Task> = {}): Task => ({
    id,
    project_id: P,
    staff_id: 's1',
    work_type_id: 'w1',
    name: id,
    start_date: '2026-09-05',
    end_date: '2026-09-08',
    progress: 0,
    created_at: '',
    updated_at: '',
    ...over,
});

describe('applyRealtime', () => {
    it('ignores rows of another project that are not on the board', () => {
        const list = [task('a')];
        expect(applyRealtime(list, {type: 'INSERT', newRow: task('b', {project_id: 'other'})}, P, SEPT)).toBe(list);
    });

    it('removes a task moved to another project', () => {
        const list = [task('a')];
        expect(applyRealtime(list, {type: 'UPDATE', newRow: task('a', {project_id: 'other'})}, P, SEPT)).toEqual([]);
    });

    it('removes a task moved out of the month', () => {
        const moved = task('a', {start_date: '2026-10-02', end_date: '2026-10-04'});
        expect(applyRealtime([task('a')], {type: 'UPDATE', newRow: moved}, P, SEPT)).toEqual([]);
    });

    it('delete removes by id', () => {
        expect(applyRealtime([task('a'), task('b')], {type: 'DELETE', oldId: 'a'}, P, SEPT).map((t) => t.id)).toEqual(['b']);
    });

    it('upsert replaces by id, inserts when new, and normalizes dates', () => {
        const updated = applyRealtime([task('a')], {type: 'UPDATE', newRow: task('a', {name: 'C7'})}, P, SEPT);
        expect(updated).toEqual([task('a', {name: 'C7'})]);
        const inserted = applyRealtime(updated, {type: 'INSERT', newRow: task('b', {end_date: '2026-10-03T00:00:00'})}, P, SEPT);
        expect(inserted.map((t) => [t.id, t.end_date])).toEqual([['a', '2026-09-08'], ['b', '2026-10-03']]);
    });
});
