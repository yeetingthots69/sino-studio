// Pure helpers for the Cuts view (N1 cells, drawer people rows, bulk net preview, audit diffs).
import type {Json} from '@/types/database.types';
import {staffTotals, type PayLine, type Totals} from '../pay';

export type CellState = 'empty' | 'progress' | 'done';

export const cellState = (task: {progress: number} | undefined): CellState =>
    !task ? 'empty' : task.progress === 100 ? 'done' : 'progress';

/**
 * "chờ <code>": the nearest earlier existing stage of the cut that is below 100 % (done ones are skipped), while this stage is not done.
 * `stages` = the cut's tasks in type order (undefined where the stage does not exist).
 */
export function waitingFor<T extends {code: string}>(
    types: T[],
    stages: ({progress: number} | undefined)[],
    index: number,
): T | null {
    if (cellState(stages[index]) === 'done') return null;
    for (let i = index - 1; i >= 0; i--) {
        if (cellState(stages[i]) === 'progress') return types[i];
    }
    return null;
}

export type PersonRow = {staff_id: string; assignee: boolean; base: number; totals: Totals};

/**
 * Drawer people rows for one stage: the assignee (base = stage pay) plus anyone with adjustments on it;
 * figures via staffTotals over the stage's own line and adjustments. Assignee first, then by `order`.
 */
export function stagePeople(
    line: PayLine | undefined,
    adjustments: {staff_id: string; amount: number}[],
    order: (a: string, b: string) => number,
): PersonRow[] {
    const totals = staffTotals(line ? [line] : [], adjustments);
    return [...totals].map(([staff_id, t]) => ({
        staff_id,
        assignee: staff_id === line?.staff_id,
        base: t.earned + t.pending,
        totals: t,
    })).sort((a, b) => Number(b.assignee) - Number(a.assignee) || order(a.staff_id, b.staff_id));
}

/** Bulk preview: signed net per staff in first-seen order; rows without staff or amount are skipped. */
export function netByStaff(rows: {staff_id: string | null; amount: number}[]): [string, number][] {
    const out = new Map<string, number>();
    for (const r of rows) if (r.staff_id && r.amount) out.set(r.staff_id, (out.get(r.staff_id) ?? 0) + r.amount);
    return [...out];
}

const IGNORED = new Set(['id', 'project_id', 'created_at', 'updated_at', 'version']);

/** Changed fields of an audit row (update: differing keys; insert/delete: every non-meta key of the row). */
export function auditChanges(old: Json | null, next: Json | null): {field: string; from: Json | undefined; to: Json | undefined}[] {
    const o = (old && typeof old === 'object' && !Array.isArray(old) ? old : {}) as Record<string, Json | undefined>;
    const n = (next && typeof next === 'object' && !Array.isArray(next) ? next : {}) as Record<string, Json | undefined>;
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])].filter((k) => !IGNORED.has(k));
    return keys
        .filter((k) => JSON.stringify(o[k]) !== JSON.stringify(n[k]))
        .map((field) => ({field, from: o[field], to: n[field]}));
}

/**
 * Typed VND amount → integer. Grouping separators (vi "200.000", en "200,000", spaces) are ignored; anything
 * else (sign, decimals written with letters, empty) → null. No clamping: the caller validates with amountOk.
 */
export function parseAmount(raw: string): number | null {
    const digits = raw.replace(/[.,\s]/g, '');
    return /^\d{1,11}$/.test(digits) ? Number(digits) : null;
}

/** Amounts are entered unsigned (the +/− toggle carries the sign): 1 … 1e10. */
export const amountOk = (n: number | null): n is number => n !== null && n > 0 && n <= 1e10;

const groupVi = new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0});
/** Re-displays a typed amount with vi grouping ("200000" → "200.000"); unparsable input is left as typed. */
export const formatAmountInput = (raw: string) => {
    const n = parseAmount(raw);
    return n === null ? raw : groupVi.format(n);
};
