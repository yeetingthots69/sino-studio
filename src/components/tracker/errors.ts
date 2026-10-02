// SQL `raise exception ... message = '<key>'` keys from the tracker_v2 migration (errcode P0001).
export const ORDER_CONFLICT = 'order_conflict';
export const TYPE_IN_USE = 'type_in_use';
export const PCT_TOTAL = 'pct_total';
export const ADJUSTMENT_INVALID = 'adjustment_invalid';
export const PROJECT_IMMUTABLE = 'project_immutable';
export const SHARE_REVOKED = 'share_revoked'; // migration tracker_v2_shares_token
export const STAFF_ARCHIVED = 'staff_archived'; // migration tracker_v23_move_task
export const OVERLAP_IN_USE = 'overlap_in_use'; // migration tracker_v25_overlap

export type TrackerError =
    | 'network' | 'unauthenticated' | 'invalid' | 'duplicate' | 'not_found'
    | 'in_use' | 'order_conflict' | 'overlap_in_use' | 'pct_total' | 'staff_archived' | 'generic';

/** What a 23503 (foreign key) means: unknown id on insert/update, still referenced on delete. */
export type FkError = 'invalid' | 'in_use';

export type DbError = {code: string; message?: string; details?: string | null};

const P0001: Record<string, TrackerError> = {
    [ORDER_CONFLICT]: 'order_conflict',
    [TYPE_IN_USE]: 'in_use',
    [PCT_TOTAL]: 'pct_total',
    [ADJUSTMENT_INVALID]: 'invalid',
    [PROJECT_IMMUTABLE]: 'invalid',
    [SHARE_REVOKED]: 'invalid',
    [STAFF_ARCHIVED]: 'staff_archived',
    [OVERLAP_IN_USE]: 'overlap_in_use',
};
const BY_CODE: Record<string, TrackerError> = {
    '23505': 'duplicate',
    '23514': 'invalid',
    PGRST116: 'not_found',
};

export function mapDbError(e: DbError, fk: FkError = 'invalid'): {error: TrackerError; detail?: string} {
    if (e.code === '23503') return {error: fk};
    if (e.code === 'P0001') {
        const error = P0001[e.message ?? ''] ?? 'generic';
        const withDetail = error === 'order_conflict' || error === 'overlap_in_use';
        return withDetail && e.details ? {error, detail: e.details} : {error};
    }
    return {error: BY_CODE[e.code] ?? 'generic'};
}

/** 40P01 (deadlock: task row lock vs project advisory lock) → run once more; a second deadlock is returned as-is. */
export async function retryDeadlock<T extends {error: DbError | null}>(run: () => PromiseLike<T>): Promise<T> {
    const first = await run();
    return first.error?.code === '40P01' ? run() : first;
}
