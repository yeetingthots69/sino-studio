import {describe, expect, it} from 'vitest';
import type {Tables} from '@/types/database.types';
import {createCommitChain, initTaskState, planCommit, reconcile, visibleTasks, type SyncInput, type TaskState} from '../taskSync';

type Task = Tables<'tracker_tasks'>;

const P = 'project-a';
const OCT = {start: '2026-10-01', end: '2026-10-31'};
const task = (id: string, version: number, over: Partial<Task> = {}): Task => ({
    id,
    project_id: P,
    cut_id: 'c1',
    staff_id: 's1',
    work_type_id: 'w1',
    start_date: '2026-10-05',
    end_date: '2026-10-08',
    progress: 0,
    links: [],
    is_fix: false,
    version,
    created_at: '',
    updated_at: '',
    ...over,
});
const run = (s: TaskState, ...inputs: SyncInput[]) => inputs.reduce(reconcile, s);
const version = (s: TaskState, id = 'a') => s.entries.get(id)?.row.version;

describe('taskSync.reconcile', () => {
    const base = () => initTaskState(P, [task('a', 1)], 0);

    it('accepts only higher versions; ignores other projects', () => {
        let s = run(base(), {kind: 'realtime', row: task('a', 3, {progress: 30}), at: 1});
        s = run(s, {kind: 'realtime', row: task('a', 2, {progress: 20}), at: 2}, {kind: 'realtime', row: task('a', 3, {progress: 99}), at: 3});
        expect(s.entries.get('a')!.row.progress).toBe(30);
        s = run(s, {kind: 'realtime', row: task('b', 1, {project_id: 'other'}), at: 4});
        expect(s.entries.has('b')).toBe(false);
    });

    it('own echo before ack is not a foreign change', () => {
        let s = run(base(), {kind: 'begin', id: 'a'}, {kind: 'realtime', row: task('a', 2), at: 1});
        expect(version(s)).toBe(1); // held while in flight
        s = run(s, {kind: 'ack', id: 'a', row: task('a', 2), at: 2});
        expect(version(s)).toBe(2);
        expect(planCommit(s, 'a', 1)).toEqual({expected_version: 2});
    });

    it('foreign change held during an own commit is detected on ack', () => {
        const s = run(base(), {kind: 'begin', id: 'a'}, {kind: 'realtime', row: task('a', 2), at: 1},
            {kind: 'realtime', row: task('a', 3, {progress: 50}), at: 2}, {kind: 'ack', id: 'a', row: task('a', 2), at: 3});
        expect(version(s)).toBe(3);
        expect(planCommit(s, 'a', 1)).toBe('conflict-local');
    });

    it('foreign change during a drag → local conflict', () => {
        const baseline = version(base())!; // pointerdown
        const s = run(base(), {kind: 'realtime', row: task('a', 2, {start_date: '2026-10-06'}), at: 1});
        expect(planCommit(s, 'a', baseline)).toBe('conflict-local');
        expect(planCommit(s, 'a', 2)).toEqual({expected_version: 2}); // interaction started after it
    });

    it('5 rapid own commits → no conflict, last version wins', () => {
        let s = base();
        const baseline = 1; // all five interactions started before the first ack
        for (let i = 0; i < 5; i++) {
            const plan = planCommit(s, 'a', baseline);
            expect(plan).toEqual({expected_version: 1 + i});
            s = run(s, {kind: 'begin', id: 'a'});
            if (i > 0) s = run(s, {kind: 'realtime', row: task('a', 1 + i), at: 10 * i}); // echo of the previous commit
            s = run(s, {kind: 'ack', id: 'a', row: task('a', 2 + i, {progress: 20 * (i + 1)}), at: 10 * i + 5});
        }
        s = run(s, {kind: 'realtime', row: task('a', 6), at: 100}); // late echo of the last commit
        expect(s.entries.get('a')!.row).toMatchObject({version: 6, progress: 100});
        expect(planCommit(s, 'a', baseline)).toEqual({expected_version: 6});
    });

    it('late ack lower than a confirmed realtime version is ignored', () => {
        let s = run(base(), {kind: 'realtime', row: task('a', 4, {progress: 40}), at: 1});
        s = run(s, {kind: 'ack', id: 'a', row: task('a', 3, {progress: 30}), at: 2});
        expect(s.entries.get('a')!.row).toMatchObject({version: 4, progress: 40});
    });

    it('conflict response applies the fresh row as foreign', () => {
        const s = run(base(), {kind: 'begin', id: 'a'}, {kind: 'ack', id: 'a', fresh: task('a', 5), at: 1});
        expect(version(s)).toBe(5);
        expect(s.entries.get('a')!.inFlight).toBe(false);
        expect(planCommit(s, 'a', 1)).toBe('conflict-local');
    });

    it('physical deletes tombstone; stale payloads cannot resurrect', () => {
        for (const del of [{kind: 'realtimeDelete', id: 'a'}, {kind: 'ownDelete', id: 'a'}] as const) {
            const s = run(base(), del, {kind: 'realtime', row: task('a', 9), at: 1}, {kind: 'ack', id: 'a', row: task('a', 9), at: 2},
                {kind: 'snapshot', rows: [task('a', 9)], at: 3});
            expect(s.entries.has('a')).toBe(false);
            expect(planCommit(s, 'a', 1)).toBe('conflict-local');
        }
    });

    it('month-leave is not tombstoned: hidden, then shown again when it comes back', () => {
        let s = run(base(), {kind: 'realtime', row: task('a', 2, {start_date: '2026-11-02', end_date: '2026-11-04'}), at: 1});
        expect(visibleTasks(s, OCT)).toEqual([]);
        expect(s.tombstones.has('a')).toBe(false);
        s = run(s, {kind: 'realtime', row: task('a', 3), at: 2});
        expect(visibleTasks(s, OCT).map((t) => t.version)).toEqual([3]);
    });

    it('refresh snapshot keeps a row confirmed after the snapshot started', () => {
        const s = run(base(), {kind: 'refreshStart', at: 10}, {kind: 'realtime', row: task('b', 1), at: 11},
            {kind: 'snapshot', rows: [task('a', 1)], at: 12});
        expect([...s.entries.keys()]).toEqual(['a', 'b']);
        expect(s.snapshotStartedAt).toBeNull();
    });

    it('refresh snapshot removes a row confirmed before it started (missed DELETE), without tombstone', () => {
        const s = run(base(), {kind: 'refreshStart', at: 10}, {kind: 'snapshot', rows: [], at: 12});
        expect(s.entries.has('a')).toBe(false);
        expect(s.tombstones.has('a')).toBe(false);
    });

    it('month snapshot keeps a row moved out of the month (not in the props)', () => {
        let s = run(base(), {kind: 'ack', id: 'a', row: task('a', 2, {start_date: '2026-11-02', end_date: '2026-11-04'}), at: 1});
        s = run(s, {kind: 'refreshStart', at: 10}, {kind: 'snapshot', rows: [], at: 12, range: OCT});
        expect(version(s)).toBe(2);
        expect(visibleTasks(s, OCT)).toEqual([]);
        const gone = run(base(), {kind: 'refreshStart', at: 10}, {kind: 'snapshot', rows: [], at: 12, range: OCT});
        expect(gone.entries.has('a')).toBe(false); // in-month row missing → missed DELETE
    });

    it('snapshot never removes an in-flight entry with held payloads; ack then applies the held foreign row', () => {
        let s = run(base(), {kind: 'begin', id: 'a'}, {kind: 'realtime', row: task('a', 2), at: 1},
            {kind: 'realtime', row: task('a', 3, {start_date: '2026-11-02', end_date: '2026-11-04'}), at: 2},
            {kind: 'refreshStart', at: 3}, {kind: 'snapshot', rows: [], at: 4});
        expect(s.entries.has('a')).toBe(true);
        s = run(s, {kind: 'ack', id: 'a', row: task('a', 2), at: 5});
        expect(version(s)).toBe(3);
        expect(planCommit(s, 'a', 2)).toBe('conflict-local');
    });

    it('snapshot without refreshStart removes nothing; snapshot rows go through the version rule', () => {
        const s = run(base(), {kind: 'snapshot', rows: [task('b', 2), task('a', 1, {progress: 99})], at: 5});
        expect(s.entries.has('a')).toBe(true);
        expect(s.entries.get('a')!.row.progress).toBe(0);
        expect(version(s, 'b')).toBe(2);
    });

    it('createTask ack adds the row; its earlier realtime INSERT echo does not block later commits', () => {
        const s = run(base(), {kind: 'realtime', row: task('n', 1), at: 1}, {kind: 'ack', id: 'n', row: task('n', 1), at: 2});
        expect(planCommit(s, 'n', 1)).toEqual({expected_version: 1});
    });
});

describe('createCommitChain', () => {
    it('runs commits for one task one at a time and drops the queue after a failure', async () => {
        const enqueue = createCommitChain();
        const log: string[] = [];
        let release!: (ok: boolean) => void;
        const first = enqueue('a', () => new Promise<boolean>((r) => { log.push('1'); release = r; }));
        const second = enqueue('a', async () => { log.push('2'); return true; });
        const other = enqueue('b', async () => { log.push('b'); return true; });
        await other;
        expect(log).toEqual(['1', 'b']);
        release(false);
        expect(await first).toBe('failed');
        expect(await second).toBe('dropped');
        expect(await enqueue('a', async () => { log.push('3'); return true; })).toBe('ok'); // fresh chain
        expect(log).toEqual(['1', 'b', '3']);
    });

    it('a rejected commit counts as failed', async () => {
        const enqueue = createCommitChain();
        expect(await enqueue('a', () => Promise.reject(new Error('x')))).toBe('failed');
    });

    it('a synchronous throw counts as failed and does not wedge the chain', async () => {
        const enqueue = createCommitChain();
        expect(await enqueue('a', () => { throw new Error('sync'); })).toBe('failed');
        expect(await enqueue('a', async () => true)).toBe('ok');
    });
});
