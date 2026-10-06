// Pure helpers for the Cuts view (N1 cells, drawer people rows, bulk net preview, audit diffs).
import type {Json} from '@/types/database.types';
import {cutBudget, phaseSplit, stagePct, staffTotals, type PayLine, type Totals} from '../pay';

/** Phase switcher: the saved phase when it still exists, else the first (phases in sort order). */
export function pickPhase<P extends {id: string}>(phases: P[], saved: string | null): P | undefined {
    return phases.find((p) => p.id === saved) ?? phases[0];
}

/** Footer (O8): assigned stage pay per type of one phase, that phase's total, and the total over all phases. */
export function footerTotals(
    lines: {work_type_id: string; amount: number}[],
    phaseTypeIds: string[],
): {byType: Map<string, number>; phase: number; all: number} {
    const byType = new Map(phaseTypeIds.map((id) => [id, 0]));
    let all = 0;
    for (const l of lines) {
        all += l.amount;
        if (byType.has(l.work_type_id)) byType.set(l.work_type_id, byType.get(l.work_type_id)! + l.amount);
    }
    return {byType, phase: [...byType.values()].reduce((s, v) => s + v, 0), all};
}

/** Split button of one phase: its effective pcts ("30 · 70%") and whether the cut overrides that phase. */
export function phaseSplitLabel(
    cut: {pay_split: Json | null},
    phaseTypes: {id: string; pay_pct: number}[],
): {text: string; custom: boolean} {
    const ids = phaseTypes.map((w) => w.id);
    return {
        text: `${phaseTypes.map((w) => stagePct(cut, w, ids)).join(' · ')}%`,
        custom: phaseSplit(cut, ids) !== null,
    };
}

/** An audit `budgets` value as [phase name, amount] in phase order (only phases present in the map). */
export function budgetEntries(v: Json | undefined, phases: {id: string; name: string}[]): [string, number][] {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
    return phases.filter((p) => p.id in v).map((p) => [p.name, cutBudget({budgets: v}, p.id)]);
}

export type CellState = 'empty' | 'progress' | 'done';

export const cellState = (task: {progress: number} | undefined): CellState =>
    !task ? 'empty' : task.progress === 100 ? 'done' : 'progress';

/**
 * "chờ <code>": the nearest earlier existing stage of the cut that is below 100 % (done ones are skipped), while this stage is not done.
 * `stages` = the cut's tasks in type order (undefined where the stage does not exist). v2.8: only stages of
 * the same phase count.
 */
export function waitingFor<T extends {code: string; phase_id: string}>(
    types: T[],
    stages: ({progress: number} | undefined)[],
    index: number,
): T | null {
    if (cellState(stages[index]) === 'done') return null;
    for (let i = index - 1; i >= 0; i--) {
        if (types[i].phase_id === types[index].phase_id && cellState(stages[i]) === 'progress') return types[i];
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

/**
 * Preset → split draft, by position: value i goes to the i-th type (types in sort order).
 * `missing` = ids of types past the preset's end (set to 0, the user fills them); `extra` = preset values with no type.
 */
export function presetToDraft(
    pcts: number[],
    types: {id: string}[],
): {draft: Record<string, number>; missing: string[]; extra: number[]} {
    return {
        draft: Object.fromEntries(types.map((t, i) => [t.id, pcts[i] ?? 0])),
        missing: types.slice(pcts.length).map((t) => t.id),
        extra: pcts.slice(types.length),
    };
}
