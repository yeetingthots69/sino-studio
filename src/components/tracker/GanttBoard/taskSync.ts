/**
 * Task sync state machine (plan §3.4 "Task sync contract"). Pure: the board passes `at` (Date.now()).
 *
 * API
 * - initTaskState(projectId, rows, at) — confirmed rows from the loader (one board mount = one month).
 * - reconcile(state, input) — the only entry for confirmed data:
 *     {kind:'refreshStart'}            before router.refresh(): records snapshotStartedAt
 *     {kind:'snapshot', rows, range?}  refreshed props: version rule per row; a row missing from the props is
 *                                      removed only if confirmed before snapshotStartedAt (no refreshStart → none)
 *                                      and, when `range` (the loaded month) is given, only if it overlaps it —
 *                                      a row outside the month is simply not in the props
 *     {kind:'realtime', row}           INSERT/UPDATE payload (held as provisional while an own commit is in flight)
 *     {kind:'realtimeDelete', id}      physical delete → removed + tombstoned
 *     {kind:'begin', id}               own commit sent for this task (mark in flight)
 *     {kind:'ack', id, row?, fresh?}   own commit settled: row = own result, fresh = 'conflict' response row,
 *                                      neither = failure. Held payloads: version ≤ now-confirmed → own echo /
 *                                      stale, dropped; higher → foreign. Also used for createTask results.
 *     {kind:'ownDelete', id}           own delete acknowledged → removed + tombstoned
 *   Version rule: a row is accepted only if its version > the confirmed one; tombstoned ids and rows of
 *   other projects are ignored. Leaving the month is NOT a delete: out-of-month rows stay in `entries`
 *   (keeping their version) and are just filtered out by visibleTasks().
 * - planCommit(state, id, baseline) — call when the commit is actually sent (inside the chain):
 *   expected_version to send, or 'conflict-local' (a foreign change was confirmed after the baseline, or the
 *   task is gone). Baseline = confirmed version when the interaction started (pointerdown, first keystroke…).
 * - createCommitChain() — per-task serial queue; after a failed commit, commits queued behind it resolve
 *   'dropped' (revert their optimistic patches).
 * - visibleTasks(state, range) — confirmed rows overlapping the month.
 *
 * Wiring rule: the state MUST live in a ref updated synchronously on every input
 * (`stateRef.current = reconcile(stateRef.current, input)`), and planCommit must read that ref inside the
 * chained run. React state is only a render mirror of the ref; never reconcile from or plan against it.
 * Entries with a commit in flight or a held payload are never removed by a snapshot.
 */
import type {Tables} from '@/types/database.types';

type Task = Tables<'tracker_tasks'>;

/** Realtime dates should already be 'YYYY-MM-DD'; slice defensively in case a timestamp form arrives. */
function normalizeRow(row: Task): Task {
    return {...row, start_date: String(row.start_date).slice(0, 10), end_date: String(row.end_date).slice(0, 10)};
}

export type Entry = {
    row: Task;
    /** Client clock when this row was last confirmed. */
    confirmedAt: number;
    /** Highest version confirmed from a non-own source (realtime, snapshot, conflict fresh row). */
    foreignVersion: number;
    inFlight: boolean;
    /** Highest provisional payload received while inFlight. */
    held?: Task;
};

export type TaskState = {
    projectId: string;
    entries: Map<string, Entry>;
    tombstones: Set<string>;
    snapshotStartedAt: number | null;
};

export type SyncInput =
    | {kind: 'refreshStart'; at: number}
    | {kind: 'snapshot'; rows: Task[]; at: number; range?: {start: string; end: string}}
    | {kind: 'realtime'; row: Task; at: number}
    | {kind: 'realtimeDelete'; id: string}
    | {kind: 'begin'; id: string}
    | {kind: 'ack'; id: string; row?: Task; fresh?: Task; at: number}
    | {kind: 'ownDelete'; id: string};

export function initTaskState(projectId: string, rows: Task[], at: number): TaskState {
    const entries = new Map<string, Entry>();
    for (const r of rows) {
        const row = normalizeRow(r);
        entries.set(row.id, {row, confirmedAt: at, foreignVersion: row.version, inFlight: false});
    }
    return {projectId, entries, tombstones: new Set(), snapshotStartedAt: null};
}

/** Version rule; mutates `entries` (a copy owned by reconcile). */
function accept(entries: Map<string, Entry>, row: Task, at: number, own: boolean): void {
    const e = entries.get(row.id);
    if (e && row.version <= e.row.version) return;
    entries.set(row.id, {
        row,
        confirmedAt: at,
        foreignVersion: own ? (e?.foreignVersion ?? 0) : row.version,
        inFlight: e?.inFlight ?? false,
        held: e?.held,
    });
}

/** A non-own confirmed row: held while an own commit is in flight, else accepted as foreign. */
function incoming(state: TaskState, entries: Map<string, Entry>, raw: Task, at: number): void {
    const row = normalizeRow(raw);
    if (row.project_id !== state.projectId || state.tombstones.has(row.id)) return;
    const e = entries.get(row.id);
    if (e?.inFlight) {
        if (!e.held || row.version > e.held.version) entries.set(row.id, {...e, held: row});
    } else {
        accept(entries, row, at, false);
    }
}

function remove(state: TaskState, id: string): TaskState {
    const entries = new Map(state.entries);
    entries.delete(id);
    return {...state, entries, tombstones: new Set(state.tombstones).add(id)};
}

export function reconcile(state: TaskState, input: SyncInput): TaskState {
    switch (input.kind) {
        case 'refreshStart':
            return {...state, snapshotStartedAt: Math.min(state.snapshotStartedAt ?? input.at, input.at)};
        case 'realtimeDelete':
        case 'ownDelete':
            return remove(state, input.id);
        case 'begin': {
            const e = state.entries.get(input.id);
            if (!e || e.inFlight) return state;
            return {...state, entries: new Map(state.entries).set(input.id, {...e, inFlight: true, held: undefined})};
        }
        case 'realtime': {
            const entries = new Map(state.entries);
            incoming(state, entries, input.row, input.at);
            return {...state, entries};
        }
        case 'snapshot': {
            const entries = new Map(state.entries);
            const present = new Set<string>();
            for (const r of input.rows) {
                present.add(r.id);
                incoming(state, entries, r, input.at);
            }
            const started = state.snapshotStartedAt;
            if (started !== null) {
                for (const [id, e] of entries) {
                    // In-flight / held entries are settled by their ack, never by a snapshot.
                    if (present.has(id) || e.inFlight || e.held || e.confirmedAt >= started) continue;
                    // outside the loaded month: absent from the props by design, not deleted
                    if (input.range && (e.row.start_date > input.range.end || e.row.end_date < input.range.start)) continue;
                    entries.delete(id);
                }
            }
            return {...state, entries, snapshotStartedAt: null};
        }
        case 'ack': {
            if (state.tombstones.has(input.id)) return state;
            const entries = new Map(state.entries);
            const e = entries.get(input.id);
            const held = e?.held;
            if (e) entries.set(input.id, {...e, inFlight: false, held: undefined});
            if (input.row) accept(entries, normalizeRow(input.row), input.at, true);
            if (input.fresh) accept(entries, normalizeRow(input.fresh), input.at, false);
            // Held payload at or below the settled version = own echo or stale; above = foreign change.
            if (held) accept(entries, held, input.at, false);
            return {...state, entries};
        }
    }
}

export function planCommit(state: TaskState, id: string, baseline: number): {expected_version: number} | 'conflict-local' {
    const e = state.entries.get(id);
    if (!e || e.foreignVersion > baseline) return 'conflict-local';
    // Only own acks since the baseline (or nothing at all) → the latest confirmed version is ours.
    return {expected_version: e.row.version};
}

export function visibleTasks(state: TaskState, range: {start: string; end: string}): Task[] {
    const out: Task[] = [];
    for (const {row} of state.entries.values()) {
        if (row.start_date <= range.end && row.end_date >= range.start) out.push(row);
    }
    return out;
}

export type CommitOutcome = 'ok' | 'failed' | 'dropped';

/** Serialises commits per task id. `run` resolves true on success; a rejection counts as failure. */
export function createCommitChain() {
    const tails = new Map<string, Promise<CommitOutcome>>();
    return function enqueue(id: string, run: () => Promise<boolean>): Promise<CommitOutcome> {
        const prev = tails.get(id) ?? Promise.resolve<CommitOutcome>('ok');
        const p = prev.then(async (r): Promise<CommitOutcome> => {
            if (r !== 'ok') return 'dropped';
            // Promise.resolve().then(run) also turns a synchronous throw into a rejection.
            return (await Promise.resolve().then(run).catch(() => false)) ? 'ok' : 'failed';
        });
        tails.set(id, p);
        void p.then(() => {
            if (tails.get(id) === p) tails.delete(id);
        });
        return p;
    };
}
