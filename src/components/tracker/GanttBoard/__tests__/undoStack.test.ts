import {describe, expect, it} from 'vitest';
import {
    EMPTY_UNDO, UNDO_LIMIT, inverse, payUnchanged, rebase, record, remap, settled, take,
    type TaskSnapshot, type UndoEntry, type UndoState,
} from '../undoStack';

const upd = (id: string, version = 1): UndoEntry =>
    ({kind: 'update', id, version, before: {progress: 0}, after: {progress: 50}, label: id});

const snapshot: TaskSnapshot = {project_id: 'p', staff_id: 's1', work_type_id: 'w', cut_code: 'C01', budget: null,
    start_date: '2026-10-01', end_date: '2026-10-03', progress: 0, links: [], is_fix: false};

const move: Extract<UndoEntry, {kind: 'move'}> = {kind: 'move', id: 't', version: 1, moveAdjustments: true, opId: 'op', cut_id: 'c', work_type_id: 'w',
    before: {staff_id: 'a', start_date: '2026-10-01', end_date: '2026-10-02'},
    after: {staff_id: 'b', start_date: '2026-10-05', end_date: '2026-10-06'}, label: 'm'};

const ids = (l: UndoEntry[]) => l.map((e) => e.id);

describe('undoStack', () => {
    it('record caps undo at 20, clears redo and bumps gen', () => {
        let s: UndoState = {...EMPTY_UNDO, redo: [upd('r')]};
        for (let i = 0; i < 25; i++) s = record(s, upd(`t${i}`));
        expect(s.undo).toHaveLength(UNDO_LIMIT);
        expect(s.undo[0].id).toBe('t5');
        expect(s.redo).toEqual([]);
        expect(s.gen).toBe(25);
        expect(EMPTY_UNDO).toEqual({undo: [], redo: [], gen: 0});
    });

    it('settled caps the redo list at 20', () => {
        let s: UndoState = {...EMPTY_UNDO, redo: Array.from({length: 20}, (_, i) => upd(`r${i}`)), undo: [upd('x')]};
        const t = take(s, 'undo')!;
        s = settled(t.state, 'undo', t.entry, t.gen);
        expect(s.redo).toHaveLength(UNDO_LIMIT);
        expect(s.redo[0].id).toBe('r1');
        expect(s.redo.at(-1)!.id).toBe('x');
    });

    it('take pops the top and returns null on an empty list', () => {
        expect(take(EMPTY_UNDO, 'undo')).toBeNull();
        expect(take(EMPTY_UNDO, 'redo')).toBeNull();
        const s = record(record(EMPTY_UNDO, upd('a')), upd('b'));
        const t = take(s, 'undo')!;
        expect(t.entry.id).toBe('b');
        expect(ids(t.state.undo)).toEqual(['a']);
        expect(t.gen).toBe(2);
        expect(ids(s.undo)).toEqual(['a', 'b']); // input untouched
    });

    it('settled moves undo → redo and redo → undo, rebasing the entry', () => {
        const s = record(EMPTY_UNDO, upd('a', 1));
        const t = take(s, 'undo')!;
        const afterUndo = settled(t.state, 'undo', {...t.entry, version: 2}, t.gen);
        expect(afterUndo.undo).toEqual([]);
        expect(afterUndo.redo).toEqual([{...upd('a'), version: 2}]);
        const t2 = take(afterUndo, 'redo')!;
        const afterRedo = settled(t2.state, 'redo', {...t2.entry, version: 3}, t2.gen);
        expect(afterRedo.undo.map((e) => e.version)).toEqual([3]);
        expect(afterRedo.redo).toEqual([]);
    });

    it('gen guard: a record between take and settled keeps the entry out, but still rebases', () => {
        const s = record(record(EMPTY_UNDO, upd('a', 1)), upd('b', 1));
        const t = take(s, 'undo')!; // b
        const mid = record(t.state, upd('b', 5)); // new action on b, redo cleared
        const out = settled(mid, 'undo', {...t.entry, version: 6}, t.gen);
        expect(out.redo).toEqual([]);
        expect(out.undo.map((e) => [e.id, e.version])).toEqual([['a', 1], ['b', 6]]);
    });

    it('rebase and remap touch every entry of the id in both lists', () => {
        const s: UndoState = {undo: [upd('a', 1), upd('b', 1), upd('a', 2)], redo: [upd('a', 3), upd('c', 1)], gen: 4};
        const r = rebase(s, 'a', 9);
        expect(r.undo.map((e) => e.version)).toEqual([9, 1, 9]);
        expect(r.redo.map((e) => e.version)).toEqual([9, 1]);
        expect(r.gen).toBe(4);
        expect(s.undo[0].version).toBe(1);
        const m = remap(s, 'a', 'z', 7);
        expect(ids(m.undo)).toEqual(['z', 'b', 'z']);
        expect(ids(m.redo)).toEqual(['z', 'c']);
        expect([...m.undo, ...m.redo].filter((e) => e.id === 'z').every((e) => e.version === 7)).toBe(true);
        expect(m.undo[1].version).toBe(1);
    });

    it('inverse: update and move', () => {
        expect(inverse(upd('a'), 'undo')).toEqual({op: 'update', fields: {progress: 0}});
        expect(inverse(upd('a'), 'redo')).toEqual({op: 'update', fields: {progress: 50}});
        expect(inverse(move, 'undo')).toEqual({op: 'move', placement: move.before, moveAdjustments: true, holder: 'b'});
        expect(inverse(move, 'redo')).toEqual({op: 'move', placement: move.after, moveAdjustments: true, holder: 'a'});
    });

    it('inverse: presence', () => {
        const created: UndoEntry = {kind: 'presence', id: 't', version: 1, exists: true, snapshot, label: 'c'};
        const deleted: UndoEntry = {...created, exists: false};
        expect(inverse(created, 'undo')).toEqual({op: 'delete'});
        expect(inverse(created, 'redo')).toEqual({op: 'create', snapshot});
        expect(inverse(deleted, 'undo')).toEqual({op: 'create', snapshot});
        expect(inverse(deleted, 'redo')).toEqual({op: 'delete'});
    });

    describe('payUnchanged', () => {
        const key = {staff_id: 'b', cut_id: 'c', work_type_id: 'w'};
        const row = (id: string, o: Partial<{staff_id: string; batch_id: string | null; reverses_id: string | null; amount: number}> = {}) =>
            ({id, staff_id: 'b', cut_id: 'c', work_type_id: 'w', amount: 100, reverses_id: null, batch_id: 'op', ...o});
        // the move batch: reversal of a's row + copy for b
        const base = [row('orig', {staff_id: 'a', batch_id: 'old'}), row('rev', {staff_id: 'a', reverses_id: 'orig', amount: -100}), row('copy')];

        it('equal sets → true', () => expect(payUnchanged(base, key, 'op')).toBe(true));
        it('extra row added for the holder → false', () =>
            expect(payUnchanged([...base, row('extra', {batch_id: 'other'})], key, 'op')).toBe(false));
        it('copy reversed → false', () =>
            expect(payUnchanged([...base, row('rev2', {reverses_id: 'copy', batch_id: 'other', amount: -100})], key, 'op')).toBe(false));
        it('both empty → true', () => expect(payUnchanged([], key, 'op')).toBe(true));
    });
});
