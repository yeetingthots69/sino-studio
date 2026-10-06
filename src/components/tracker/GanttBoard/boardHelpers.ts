import type {StaffSort} from '../staffView';
import {initTaskState, reconcile, type SyncInput, type TaskState} from './taskSync';
import type {Tables} from '@/types/database.types';
import {isOverlapPair, phaseRelation, type TypeRule} from '../pipeline';

type Task = Tables<'tracker_tasks'>;

/* ── Staff column prefs (localStorage `tracker.board.v1`) ─────── */

export type BoardPrefs = {sort: StaffSort; hideStrengths: boolean};
export const DEFAULT_PREFS: BoardPrefs = {sort: 'studio', hideStrengths: false};
export const NEXT_SORT: Record<StaffSort, StaffSort> = {studio: 'az', az: 'za', za: 'studio'};

/** Stored JSON → prefs; anything malformed falls back to the default for that field. */
export function parsePrefs(raw: string | null): BoardPrefs {
    let v: Partial<Record<keyof BoardPrefs, unknown>> = {};
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') v = parsed;
    } catch {
        // corrupt value → defaults
    }
    return {
        sort: v.sort === 'az' || v.sort === 'za' ? v.sort : 'studio',
        hideStrengths: v.hideStrengths === true,
    };
}

/* ── Per-project staff filter (localStorage `tracker.board.filter.<projectId>`) ── */

export type ProjectFilter = {strengths: string[]; departments: string[]};
export const EMPTY_PROJECT_FILTER: ProjectFilter = {strengths: [], departments: []};
export const projectFilterKey = (projectId: string) => `tracker.board.filter.${projectId}`;

/** Stored JSON → filter; non-arrays and non-string items are dropped. */
export function parseProjectFilter(raw: string | null): ProjectFilter {
    let v: Partial<Record<keyof ProjectFilter, unknown>> = {};
    try {
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') v = parsed;
    } catch {
        // corrupt value → empty
    }
    const strings = (x: unknown) => Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string') : [];
    return {strengths: strings(v.strengths), departments: strings(v.departments)};
}

/* ── Messages ─────────────────────────────────────────────────── */

/** 'YYYY-MM-DD' → 'dd/mm'. */
export const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Parses the typed 'DD/MM/YYYY' value back into 'YYYY-MM-DD'. */
export function parseDMY(value: string): string | null {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/** Server-side rule is printable ASCII, 1–20 chars (after normalizeCutCode). */
export const isValidCutCode = (code: string) => /^[\x21-\x7e]{1,20}$/.test(code);

type Stage = {id: string; cut_id: string; work_type_id: string; start_date: string; end_date: string};

/**
 * "Không thể xếp: C12 · LO (10/09–14/09) chưa kết thúc" for the stage `conflictId` (an order_conflict
 * detail or an orderConflict() hit). Earlier stage → "hasn't ended", later → "has started"; for an overlap
 * pair (pipeline isOverlapPair) earlier → "starts before it starts", later → "must start no later than";
 * the generic text when the stage or its cut / type is unknown here.
 */
export function orderConflictText(
    t: {orderEarlier: string; orderLater: string; orderEarly: string; orderLate: string; orderPhaseBefore: string; orderPhaseAfter: string; orderGeneric: string},
    conflictId: string | undefined,
    candidateTypeId: string | undefined,
    stages: Stage[],
    cutCodes: Map<string, string>,
    types: Map<string, {code: string; sort_order: number}>,
    rule: TypeRule,
): string {
    const s = conflictId ? stages.find((x) => x.id === conflictId) : undefined;
    const cut = s && cutCodes.get(s.cut_id);
    const type = s && types.get(s.work_type_id);
    if (!s || !cut || !type) return t.orderGeneric;
    const own = candidateTypeId ? types.get(candidateTypeId) : undefined;
    const stage = `${cut} · ${type.code} (${ddmm(s.start_date)}–${ddmm(s.end_date)})`;
    // v2.8: the stage is in an ancestor / descendant phase of the candidate's
    const peerPhase = rule.phaseOf.get(s.work_type_id);
    const rel = candidateTypeId ? phaseRelation(rule, rule.phaseOf.get(candidateTypeId), peerPhase) : null;
    if (rel) {
        const text = rel === 'before' ? t.orderPhaseBefore : t.orderPhaseAfter;
        return text.replace('{phase}', rule.phaseName.get(peerPhase!) ?? '').replace('{stage}', stage);
    }
    const later = own !== undefined && type.sort_order > own.sort_order;
    const overlap = !!candidateTypeId && (later
        ? isOverlapPair(rule, candidateTypeId, s.work_type_id)
        : isOverlapPair(rule, s.work_type_id, candidateTypeId));
    const text = later ? (overlap ? t.orderLate : t.orderLater) : (overlap ? t.orderEarly : t.orderEarlier);
    return text.replace('{stage}', stage);
}

/* ── Task store ───────────────────────────────────────────────── */

/** A sync input without `at`: the store stamps the client clock. */
export type StoreInput = SyncInput extends infer I ? (I extends {at: number} ? Omit<I, 'at'> : I) : never;

/**
 * External store around taskSync: `get()` is updated synchronously on every input, so commits read it
 * inside the chain at send time (React state would lag one render). The board renders it through
 * useSyncExternalStore.
 */
export function createTaskStore(projectId: string, rows: Task[]) {
    let state: TaskState = initTaskState(projectId, rows, Date.now());
    const listeners = new Set<() => void>();
    return {
        get: () => state,
        apply(input: StoreInput) {
            const next = reconcile(state, {...input, at: Date.now()} as SyncInput);
            if (next === state) return;
            state = next;
            listeners.forEach((l) => l());
        },
        subscribe(l: () => void) {
            listeners.add(l);
            return () => {
                listeners.delete(l);
            };
        },
    };
}

export type TaskStore = ReturnType<typeof createTaskStore>;
