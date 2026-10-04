// Earnings (N2): month rules + per-staff totals for a scope. Pay itself only via payLines/staffTotals.
import type {Tables} from '@/types/database.types';
import {defaultMonth, isValidMonth} from './dates';
import {payLines, staffTotals, type PayLine, type Totals} from './pay';

type Task = Parameters<typeof payLines>[0][number];
type Cut = Parameters<typeof payLines>[1][number];
type WorkType = Parameters<typeof payLines>[2][number];
export type Adjustment = Pick<
    Tables<'tracker_pay_adjustments'>,
    'id' | 'project_id' | 'cut_id' | 'work_type_id' | 'staff_id' | 'amount' | 'created_at' | 'reverses_id'
>;
/** 'all' or 'YYYY-MM'. */
export type MonthFilter = string;

export function parseMonthFilter(raw: unknown, fallback: MonthFilter): MonthFilter {
    return raw === 'all' || isValidMonth(raw) ? raw : fallback;
}

/**
 * Effective month per adjustment id: the end_date month of the adjustment staff's latest fix on that stage (v2.6 D9),
 * else the stage task's (non-fix, same cut + type) end_date month, else the created_at month in Asia/Ho_Chi_Minh;
 * a reversal takes the effective month of the entry it reverses.
 */
export function effectiveMonths(
    tasks: Pick<Task, 'cut_id' | 'work_type_id' | 'staff_id' | 'end_date' | 'is_fix'>[],
    adjustments: Adjustment[],
): Map<string, string> {
    const stageMonth = new Map<string, string>();
    const fixMonth = new Map<string, string>(); // 'cut:type:staff' → month of that staff's latest fix end
    for (const t of tasks) {
        const month = String(t.end_date).slice(0, 7);
        if (!t.is_fix) stageMonth.set(`${t.cut_id}:${t.work_type_id}`, month);
        else {
            const key = `${t.cut_id}:${t.work_type_id}:${t.staff_id}`;
            if (month > (fixMonth.get(key) ?? '')) fixMonth.set(key, month);
        }
    }
    const byId = new Map(adjustments.map((a) => [a.id, a]));
    const own = (a: Adjustment) =>
        fixMonth.get(`${a.cut_id}:${a.work_type_id}:${a.staff_id}`)
        ?? stageMonth.get(`${a.cut_id}:${a.work_type_id}`) ?? defaultMonth(new Date(a.created_at));
    return new Map(adjustments.map((a) => {
        const original = a.reverses_id ? byId.get(a.reverses_id) : undefined;
        return [a.id, own(original ?? a)];
    }));
}

/**
 * Lines + adjustments inside the scope (project ids; undefined = every project) and month, with per-staff totals.
 * `tasks` must be every task of the scope (not month-filtered) so adjustments find their stage.
 */
export function earnings<A extends Adjustment>(
    data: {tasks: Task[]; cuts: Cut[]; types: WorkType[]; adjustments: A[]},
    month: MonthFilter,
    projectIds?: Set<string>,
): {lines: PayLine[]; adjustments: A[]; totals: Map<string, Totals>} {
    const inScope = (p: string) => !projectIds || projectIds.has(p);
    const inMonth = (m: string | undefined) => month === 'all' || m === month;
    const months = effectiveMonths(data.tasks, data.adjustments);
    const lines = payLines(data.tasks, data.cuts, data.types)
        .filter((l) => inScope(l.project_id) && inMonth(l.end_date.slice(0, 7)));
    const adjustments = data.adjustments.filter((a) => inScope(a.project_id) && inMonth(months.get(a.id)));
    return {lines, adjustments, totals: staffTotals(lines, adjustments)};
}

/** Per project → per staff totals (studio breakdown); sums to `earnings().totals`. */
export function totalsByProject(lines: PayLine[], adjustments: Adjustment[]): Map<string, Map<string, Totals>> {
    const ids = new Set([...lines.map((l) => l.project_id), ...adjustments.map((a) => a.project_id)]);
    return new Map([...ids].map((p) => [p, staffTotals(
        lines.filter((l) => l.project_id === p),
        adjustments.filter((a) => a.project_id === p),
    )]));
}

/** One staff member's rows: stages by end date, adjustments newest first. */
export function staffRows<A extends Adjustment>(result: {lines: PayLine[]; adjustments: A[]}, staffId: string) {
    return {
        lines: result.lines.filter((l) => l.staff_id === staffId).sort((a, b) => b.end_date.localeCompare(a.end_date)),
        adjustments: result.adjustments.filter((a) => a.staff_id === staffId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    };
}

export const ZERO_TOTALS: Totals = {earned: 0, pending: 0, adjustments: 0, total: 0};

const vnd = new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'});
const vndSigned = new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND', signDisplay: 'exceptZero'});

export function formatVnd(amount: number, signed = false): string {
    return (signed ? vndSigned : vnd).format(amount);
}
