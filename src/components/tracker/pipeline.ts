import type {ISODate} from './dates';

export type StageTask = {id: string; cut_id: string; work_type_id: string; start_date: ISODate; end_date: ISODate};

/**
 * Same rule as the SQL trigger private.tracker_task_order: within the candidate's cut, an earlier stage
 * must end before the candidate starts and a later stage must start after it ends. Returns the offending
 * task with the lowest type order (SQL `order by sort_order limit 1`) or null. The candidate's own id is
 * skipped; types without an order entry are ignored.
 */
export function orderConflict(stages: StageTask[], typeOrder: Map<string, number>, candidate: StageTask): StageTask | null {
    const own = typeOrder.get(candidate.work_type_id);
    if (own === undefined) return null;
    let best: StageTask | null = null;
    let bestOrder = Infinity;
    for (const t of stages) {
        if (t.id === candidate.id || t.cut_id !== candidate.cut_id) continue;
        const o = typeOrder.get(t.work_type_id);
        if (o === undefined || o >= bestOrder) continue;
        if ((o < own && t.end_date >= candidate.start_date) || (o > own && t.start_date <= candidate.end_date)) {
            best = t;
            bestOrder = o;
        }
    }
    return best;
}
