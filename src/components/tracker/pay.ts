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

type PayTask = Pick<Tables<'tracker_tasks'>, 'id' | 'project_id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'progress' | 'end_date'>;

/** One line per task whose cut and type are known; earned = progress 100. Month filtering (by end_date) is the caller's. */
export function payLines(
    tasks: PayTask[],
    cuts: Pick<Tables<'tracker_cuts'>, 'id' | 'budget'>[],
    types: Pick<Tables<'tracker_work_types'>, 'id' | 'pay_pct'>[],
): PayLine[] {
    const budget = new Map(cuts.map((c) => [c.id, c.budget]));
    const pct = new Map(types.map((t) => [t.id, t.pay_pct]));
    return tasks.flatMap((t) => {
        const b = budget.get(t.cut_id);
        const p = pct.get(t.work_type_id);
        if (b === undefined || p === undefined) return [];
        return [{
            task_id: t.id,
            project_id: t.project_id,
            cut_id: t.cut_id,
            work_type_id: t.work_type_id,
            staff_id: t.staff_id,
            amount: stagePay(b, p),
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
