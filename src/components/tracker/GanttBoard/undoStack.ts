import type {Tables} from '@/types/database.types';
import {movableAdjustments} from '../pay';

/** Pure undo/redo stack for the board (v2.4). No React; every function returns new objects. */

type Task = Tables<'tracker_tasks'>;
export type Fields = Partial<Pick<Task, 'start_date' | 'end_date' | 'progress' | 'links' | 'work_type_id'>> & {cut_code?: string};
export type Placement = {staff_id: string; start_date: string; end_date: string};
export type TaskSnapshot = {
    project_id: string; staff_id: string; work_type_id: string; cut_code: string; budget: number | null;
    start_date: string; end_date: string; progress: number; links: Task['links']; is_fix: boolean;
};

export type UndoEntry =
    | {kind: 'update'; id: string; version: number; before: Fields; after: Fields; label: string}
    | {kind: 'move'; id: string; version: number; before: Placement; after: Placement; moveAdjustments: boolean;
        opId: string; cut_id: string; work_type_id: string; label: string} // opId = batch of the last settled move
    // exists = the task exists after the recorded change (create: true, delete: false)
    | {kind: 'presence'; id: string; version: number; exists: boolean; snapshot: TaskSnapshot; label: string};

export type UndoState = {undo: UndoEntry[]; redo: UndoEntry[]; gen: number};
export type Dir = 'undo' | 'redo';

export const UNDO_LIMIT = 20;
export const EMPTY_UNDO: UndoState = {undo: [], redo: [], gen: 0};

const push = (list: UndoEntry[], e: UndoEntry) => [...list, e].slice(-UNDO_LIMIT);
const opposite = (dir: Dir): Dir => (dir === 'undo' ? 'redo' : 'undo');

/** Push onto undo (capped), clear redo, bump gen. Does not rebase: the caller rebases every confirmed write. */
export function record(s: UndoState, e: UndoEntry): UndoState {
    return {undo: push(s.undo, e), redo: [], gen: s.gen + 1};
}

/** Pop the top of `dir`; null when that list is empty. */
export function take(s: UndoState, dir: Dir): {state: UndoState; entry: UndoEntry; gen: number} | null {
    const list = s[dir];
    if (list.length === 0) return null;
    return {state: {...s, [dir]: list.slice(0, -1)}, entry: list[list.length - 1], gen: s.gen};
}

/** After a successful undo/redo: always rebase; push to the opposite list only when nothing was recorded since `take`. */
export function settled(s: UndoState, dir: Dir, e: UndoEntry, gen: number): UndoState {
    const r = rebase(s, e.id, e.version);
    if (r.gen !== gen) return r;
    const to = opposite(dir);
    return {...r, [to]: push(r[to], e)};
}

const mapBoth = (s: UndoState, f: (e: UndoEntry) => UndoEntry): UndoState => ({...s, undo: s.undo.map(f), redo: s.redo.map(f)});

/** Set `version` on every entry of `id` in both lists. */
export function rebase(s: UndoState, id: string, version: number): UndoState {
    return mapBoth(s, (e) => (e.id === id ? {...e, version} : e));
}

/** Rewrite `from` → `to` (re-created task) and rebase it. */
export function remap(s: UndoState, from: string, to: string, version: number): UndoState {
    return mapBoth(s, (e) => (e.id === from ? {...e, id: to, version} : e));
}

export type InverseOp =
    | {op: 'update'; fields: Fields}
    | {op: 'move'; placement: Placement; moveAdjustments: boolean; holder: string} // holder = staff who has the task now
    | {op: 'create'; snapshot: TaskSnapshot}
    | {op: 'delete'};

export function inverse(e: UndoEntry, dir: Dir): InverseOp {
    const back = dir === 'undo';
    switch (e.kind) {
        case 'update':
            return {op: 'update', fields: back ? e.before : e.after};
        case 'move':
            return {op: 'move', placement: back ? e.before : e.after, moveAdjustments: e.moveAdjustments,
                holder: back ? e.after.staff_id : e.before.staff_id};
        case 'presence':
            // undo wants the task to exist iff it did not after the change; redo restores the change
            return e.exists === back ? {op: 'delete'} : {op: 'create', snapshot: e.snapshot};
    }
}

type AdjRow = Parameters<typeof movableAdjustments>[0][number] & {batch_id: string | null};

/** Pay pre-check: current movable rows of the holder must equal the batch's unreversed copies. */
export function payUnchanged<A extends AdjRow>(
    rows: A[],
    key: {staff_id: string; cut_id: string; work_type_id: string},
    opId: string,
): boolean {
    const movable = new Set(movableAdjustments(rows, key).map((r) => r.id));
    const copies = new Set(rows.filter((r) => r.batch_id === opId && r.staff_id === key.staff_id && r.reverses_id === null)
        .map((r) => r.id));
    return movable.size === copies.size && [...movable].every((id) => copies.has(id));
}
