// Pay maths in integer VND. Every screen computes pay through these helpers only (no second formula).
import type {Tables} from '@/types/database.types';
import type {ISODate} from './dates';

export function pctHundredths(p: number): number {
    return Math.round(p * 100);
}

/** budget × pct, rounded half up on integer hundredths (budget ≤ 1e10 keeps the product < 2^53). */
export function stagePay(budget: number, payPct: number): number {
    return Math.round((budget * pctHundredths(payPct)) / 10000);
}

export function pctTotalOk(pcts: number[]): boolean {
    return pcts.length >= 1 && pcts.reduce((s, p) => s + pctHundredths(p), 0) === 10000;
}

/** The cut's whole split ({work_type_id: pct}, each phase's keys total 100, checked in SQL), or null. */
export function cutSplit(cut: Pick<Tables<'tracker_cuts'>, 'pay_split'>): Record<string, number> | null {
    return (cut.pay_split as Record<string, number> | null) ?? null;
}

/** The cut's override for one phase (its keys restricted to `phaseTypeIds`), or null = that phase uses the type defaults. */
export function phaseSplit(cut: Pick<Tables<'tracker_cuts'>, 'pay_split'>, phaseTypeIds: string[]): Record<string, number> | null {
    const split = cutSplit(cut);
    const own = split ? phaseTypeIds.filter((id) => id in split) : [];
    return own.length ? Object.fromEntries(own.map((id) => [id, split![id]])) : null;
}

/** Pay % of one stage: the cut's override for the type's phase when present (types it omits get 0), else the type's default. */
export function stagePct(
    cut: Pick<Tables<'tracker_cuts'>, 'pay_split'>,
    type: Pick<Tables<'tracker_work_types'>, 'id' | 'pay_pct'>,
    phaseTypeIds: string[],
): number {
    const split = phaseSplit(cut, phaseTypeIds);
    return split ? split[type.id] ?? 0 : type.pay_pct;
}

/** Type ids per phase id (input order kept), for `stagePct` / `phaseSplit`. */
export function typeIdsByPhase(types: Pick<Tables<'tracker_work_types'>, 'id' | 'phase_id'>[]): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const t of types) out.set(t.phase_id, [...(out.get(t.phase_id) ?? []), t.id]);
    return out;
}

type Budgets = Pick<Tables<'tracker_cuts'>, 'budgets'>;

/** budgets is Json: only finite non-negative numbers count. */
export function budgetValues(cut: Budgets): Record<string, number> {
    const b = cut.budgets;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return {};
    return Object.fromEntries(Object.entries(b).filter((e): e is [string, number] =>
        typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] >= 0));
}

/** The cut's budget for one phase (0 when unset). */
export function cutBudget(cut: Budgets, phaseId: string): number {
    return budgetValues(cut)[phaseId] ?? 0;
}

/** The cut's budget over all phases. */
export function cutTotal(cut: Budgets): number {
    return Object.values(budgetValues(cut)).reduce((s, v) => s + v, 0);
}

export type PayLine = {
    task_id: string;
    project_id: string;
    cut_id: string;
    work_type_id: string;
    staff_id: string;
    amount: number;
    earned: boolean;
    end_date: ISODate;
};

type PayTask = Pick<Tables<'tracker_tasks'>, 'id' | 'project_id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'progress' | 'end_date' | 'is_fix'>;

/** One line per non-fix task whose cut and type are known (a fix pays nothing, v2.6 D1); earned = progress 100. Month filtering (by end_date) is the caller's. */
export function payLines(
    tasks: PayTask[],
    cuts: Pick<Tables<'tracker_cuts'>, 'id' | 'budgets' | 'pay_split'>[],
    types: Pick<Tables<'tracker_work_types'>, 'id' | 'pay_pct' | 'phase_id'>[],
): PayLine[] {
    const cutById = new Map(cuts.map((c) => [c.id, c]));
    const typeById = new Map(types.map((t) => [t.id, t]));
    const phaseIds = typeIdsByPhase(types);
    return tasks.flatMap((t) => {
        const cut = cutById.get(t.cut_id);
        const type = typeById.get(t.work_type_id);
        if (!cut || !type || t.is_fix) return [];
        return [{
            task_id: t.id,
            project_id: t.project_id,
            cut_id: t.cut_id,
            work_type_id: t.work_type_id,
            staff_id: t.staff_id,
            amount: stagePay(cutBudget(cut, type.phase_id), stagePct(cut, type, phaseIds.get(type.phase_id) ?? [])),
            earned: t.progress === 100,
            end_date: String(t.end_date).slice(0, 10),
        }];
    });
}

export type Totals = {earned: number; pending: number; adjustments: number; total: number};

/** Per staff: earned/pending from lines; adjustments summed per staff whether or not their stage task still exists. */
export function staffTotals(
    lines: PayLine[],
    adjustments: Pick<Tables<'tracker_pay_adjustments'>, 'staff_id' | 'amount'>[],
): Map<string, Totals> {
    const out = new Map<string, Totals>();
    const get = (id: string) => {
        let t = out.get(id);
        if (!t) out.set(id, (t = {earned: 0, pending: 0, adjustments: 0, total: 0}));
        return t;
    };
    for (const l of lines) {
        const t = get(l.staff_id);
        if (l.earned) t.earned += l.amount;
        else t.pending += l.amount;
        t.total += l.amount;
    }
    for (const a of adjustments) {
        const t = get(a.staff_id);
        t.adjustments += a.amount;
        t.total += a.amount;
    }
    return out;
}

type AdjRow = {id: string; staff_id: string; cut_id: string; work_type_id: string; amount: number; reverses_id: string | null};

/** Adjustments `tracker_move_task` moves: the key's non-reversal rows that no row (of any key) reverses. Mirrors the SQL. */
export function movableAdjustments<A extends AdjRow>(
    rows: A[],
    key: {staff_id: string; cut_id: string; work_type_id: string},
): A[] {
    const reversed = new Set(rows.flatMap((r) => (r.reverses_id ? [r.reverses_id] : [])));
    return rows.filter((r) => r.reverses_id === null && !reversed.has(r.id)
        && r.staff_id === key.staff_id && r.cut_id === key.cut_id && r.work_type_id === key.work_type_id);
}
