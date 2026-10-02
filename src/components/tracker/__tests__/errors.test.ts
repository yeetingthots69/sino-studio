import {describe, expect, it, vi} from 'vitest';
import {
    ADJUSTMENT_INVALID, ORDER_CONFLICT, OVERLAP_IN_USE, PCT_TOTAL, PROJECT_IMMUTABLE, SHARE_REVOKED, STAFF_ARCHIVED, TYPE_IN_USE, mapDbError, retryDeadlock,
} from '../errors';

describe('mapDbError', () => {
    it.each([
        [{code: 'P0001', message: ORDER_CONFLICT, details: 'task-1'}, {error: 'order_conflict', detail: 'task-1'}],
        [{code: 'P0001', message: OVERLAP_IN_USE, details: 'C-12'}, {error: 'overlap_in_use', detail: 'C-12'}],
        [{code: 'P0001', message: OVERLAP_IN_USE}, {error: 'overlap_in_use'}],
        [{code: 'P0001', message: TYPE_IN_USE}, {error: 'in_use'}],
        [{code: 'P0001', message: PCT_TOTAL}, {error: 'pct_total'}],
        [{code: 'P0001', message: ADJUSTMENT_INVALID}, {error: 'invalid'}],
        [{code: 'P0001', message: PROJECT_IMMUTABLE}, {error: 'invalid'}],
        [{code: 'P0001', message: SHARE_REVOKED}, {error: 'invalid'}],
        [{code: 'P0001', message: STAFF_ARCHIVED}, {error: 'staff_archived'}],
        [{code: 'P0001', message: 'something_else'}, {error: 'generic'}],
        [{code: '23503'}, {error: 'invalid'}],
        [{code: '23505'}, {error: 'duplicate'}],
        [{code: '23514'}, {error: 'invalid'}],
        [{code: 'PGRST116'}, {error: 'not_found'}],
        [{code: '40P01'}, {error: 'generic'}],
        [{code: 'XX000'}, {error: 'generic'}],
    ])('%o → %o', (input, expected) => {
        expect(mapDbError(input)).toEqual(expected);
    });
});

it('maps 23503 to in_use for deletes', () => {
    expect(mapDbError({code: '23503'}, 'in_use')).toEqual({error: 'in_use'});
    expect(mapDbError({code: '23503'}, 'invalid')).toEqual({error: 'invalid'});
});

describe('retryDeadlock', () => {
    const deadlock = {data: null, error: {code: '40P01'}};
    const ok = {data: 1, error: null};

    it('retries a 40P01 once and returns the retry result', async () => {
        const run = vi.fn().mockResolvedValueOnce(deadlock).mockResolvedValueOnce(ok);
        expect(await retryDeadlock(run)).toBe(ok);
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('returns the second deadlock without a third try', async () => {
        const run = vi.fn().mockResolvedValue(deadlock);
        expect(mapDbError((await retryDeadlock(run)).error!)).toEqual({error: 'generic'});
        expect(run).toHaveBeenCalledTimes(2);
    });

    it('does not retry other results', async () => {
        const run = vi.fn().mockResolvedValue({data: null, error: {code: '23505'}});
        await retryDeadlock(run);
        expect(run).toHaveBeenCalledTimes(1);
    });
});
