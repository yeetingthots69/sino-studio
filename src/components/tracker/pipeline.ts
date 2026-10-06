import type {ISODate} from './dates';
import {ancestors} from './phases';

export type StageTask = {id: string; cut_id: string; work_type_id: string; start_date: ISODate; end_date: ISODate; is_fix: boolean};

/**
 * Project type order (v2.8: by phase): global sort order, direct predecessor inside the type's phase (by
 * sort_order), the overlaps_prev flags, each type's phase, each phase's ancestor closure over `after`, and
 * phase names (for messages). With no phases loaded `anc` is empty, so phases are only partitions.
 */
export type TypeRule = {
    order: Map<string, number>;
    prev: Map<string, string | null>;
    overlaps: Set<string>;
    phaseOf: Map<string, string>;
    anc: Map<string, Set<string>>;
    phaseName: Map<string, string>;
};

type PhaseLink = {id: string; name: string; after: string[]};

export function typeRule(
    workTypes: {id: string; sort_order: number; overlaps_prev: boolean; phase_id: string}[],
    phases: PhaseLink[],
): TypeRule {
    const sorted = [...workTypes].sort((a, b) => a.sort_order - b.sort_order);
    const last = new Map<string, string>();
    const prev = new Map<string, string | null>();
    for (const w of sorted) {
        prev.set(w.id, last.get(w.phase_id) ?? null);
        last.set(w.phase_id, w.id);
    }
    return {
        order: new Map(sorted.map((w) => [w.id, w.sort_order])),
        prev,
        overlaps: new Set(sorted.filter((w) => w.overlaps_prev).map((w) => w.id)),
        phaseOf: new Map(sorted.map((w) => [w.id, w.phase_id])),
        anc: new Map(phases.map((p) => [p.id, ancestors(phases, p.id)])),
        phaseName: new Map(phases.map((p) => [p.id, p.name])),
    };
}

/** 'before' when phase `b` must finish before phase `a` starts (b is an ancestor of a), 'after' when b is a descendant of a, else null. */
export function phaseRelation(rule: TypeRule, a: string | undefined, b: string | undefined): 'before' | 'after' | null {
    if (a === undefined || b === undefined || a === b) return null;
    if (rule.anc.get(a)?.has(b)) return 'before';
    if (rule.anc.get(b)?.has(a)) return 'after';
    return null;
}

/** True when the later type `b` may overlap the earlier type `a` (b flagged, a its direct predecessor in its phase). */
export const isOverlapPair = (rule: TypeRule, a: string, b: string) => rule.overlaps.has(b) && rule.prev.get(b) === a;

export type OrderConflict = {task: StageTask; reason: 'earlier' | 'later' | 'early' | 'late' | 'phaseBefore' | 'phaseAfter'};

/**
 * Same rule as the SQL trigger private.tracker_task_order: within the candidate's cut and phase, an earlier
 * stage must end before the candidate starts and a later stage must start after it ends, except for an
 * overlap pair (later type flagged overlaps_prev, earlier type its direct predecessor in the phase), which
 * only needs later.start >= earlier.start. 'earlier'/'later' = strict pair, 'early' = the candidate starts
 * before its predecessor, 'late' = the candidate starts after its overlapping successor. v2.8: a stage in an
 * ancestor phase must end before the candidate starts ('phaseBefore'), one in a descendant phase must start
 * after the candidate ends ('phaseAfter'); unrelated phases never conflict. Returns the offending task with
 * the lowest global type order (SQL `order by sort_order limit 1`) or null. The candidate's own id is
 * skipped; types without an order entry are ignored. Fix tasks (v2.6) are outside the rule: a fix
 * candidate never conflicts and fix rows never block.
 */
export function orderConflict(stages: StageTask[], rule: TypeRule, candidate: StageTask): OrderConflict | null {
    const own = rule.order.get(candidate.work_type_id);
    if (own === undefined || candidate.is_fix) return null;
    const ownPhase = rule.phaseOf.get(candidate.work_type_id);
    let best: OrderConflict | null = null;
    let bestOrder = Infinity;
    for (const t of stages) {
        if (t.id === candidate.id || t.is_fix || t.cut_id !== candidate.cut_id) continue;
        const o = rule.order.get(t.work_type_id);
        if (o === undefined || o >= bestOrder || o === own) continue;
        const peerPhase = rule.phaseOf.get(t.work_type_id);
        let reason: OrderConflict['reason'] | null;
        if (peerPhase !== ownPhase) {
            const rel = phaseRelation(rule, ownPhase, peerPhase);
            reason = rel === 'before' ? (t.end_date >= candidate.start_date ? 'phaseBefore' : null)
                : rel === 'after' ? (t.start_date <= candidate.end_date ? 'phaseAfter' : null)
                : null;
        } else if (o < own) {
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
