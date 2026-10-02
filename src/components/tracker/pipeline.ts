import type {ISODate} from './dates';

export type StageTask = {id: string; cut_id: string; work_type_id: string; start_date: ISODate; end_date: ISODate};

/** Project type order: sort order, direct predecessor (by sort_order) and the overlaps_prev flags. */
export type TypeRule = {order: Map<string, number>; prev: Map<string, string | null>; overlaps: Set<string>};

export function typeRule(workTypes: {id: string; sort_order: number; overlaps_prev: boolean}[]): TypeRule {
    const sorted = [...workTypes].sort((a, b) => a.sort_order - b.sort_order);
    return {
        order: new Map(sorted.map((w) => [w.id, w.sort_order])),
        prev: new Map(sorted.map((w, i) => [w.id, i > 0 ? sorted[i - 1].id : null])),
        overlaps: new Set(sorted.filter((w) => w.overlaps_prev).map((w) => w.id)),
    };
}

/** True when the later type `b` may overlap the earlier type `a` (b flagged, a its direct predecessor). */
export const isOverlapPair = (rule: TypeRule, a: string, b: string) => rule.overlaps.has(b) && rule.prev.get(b) === a;

export type OrderConflict = {task: StageTask; reason: 'earlier' | 'later' | 'early' | 'late'};

/**
 * Same rule as the SQL trigger private.tracker_task_order: within the candidate's cut, an earlier stage
 * must end before the candidate starts and a later stage must start after it ends, except for an overlap
 * pair (later type flagged overlaps_prev, earlier type its direct predecessor), which only needs
 * later.start >= earlier.start. Returns the offending task with the lowest type order (SQL
 * `order by sort_order limit 1`) or null. 'earlier'/'later' = strict pair, 'early' = the candidate starts
 * before its predecessor, 'late' = the candidate starts after its overlapping successor. The candidate's
 * own id is skipped; types without an order entry are ignored.
 */
export function orderConflict(stages: StageTask[], rule: TypeRule, candidate: StageTask): OrderConflict | null {
    const own = rule.order.get(candidate.work_type_id);
    if (own === undefined) return null;
    let best: OrderConflict | null = null;
    let bestOrder = Infinity;
    for (const t of stages) {
        if (t.id === candidate.id || t.cut_id !== candidate.cut_id) continue;
        const o = rule.order.get(t.work_type_id);
        if (o === undefined || o >= bestOrder || o === own) continue;
        let reason: OrderConflict['reason'] | null;
        if (o < own) {
            reason = isOverlapPair(rule, t.work_type_id, candidate.work_type_id)
                ? (t.start_date > candidate.start_date ? 'early' : null)
                : (t.end_date >= candidate.start_date ? 'earlier' : null);
        } else {
            reason = isOverlapPair(rule, candidate.work_type_id, t.work_type_id)
                ? (t.start_date < candidate.start_date ? 'late' : null)
                : (t.start_date <= candidate.end_date ? 'later' : null);
        }
        if (reason) {
            best = {task: t, reason};
            bestOrder = o;
        }
    }
    return best;
}
