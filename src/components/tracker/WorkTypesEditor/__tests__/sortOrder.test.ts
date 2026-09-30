import {describe, expect, it} from 'vitest';
import {insertAt, moveRow} from '../sortOrder';

const r = (sort_order: number, used = false, id = String(sort_order)) => ({id, sort_order, used});
const orders = (rows: {sort_order: number}[] | null) => rows?.map((x) => x.sort_order) ?? null;

describe('sortOrder', () => {
    it('inserts at the midpoint, appends +10, starts at 10', () => {
        expect(orders(insertAt([r(10), r(20)], 1, r(0, false, 'n')))).toEqual([10, 15, 20]);
        expect(orders(insertAt([r(10), r(20)], 2, r(0, false, 'n')))).toEqual([10, 20, 30]);
        expect(orders(insertAt([r(10)], 0, r(0, false, 'n')))).toEqual([5, 10]);
        expect(orders(insertAt([], 0, r(0, false, 'n')))).toEqual([10]);
    });

    it('renumbers only unused rows when there is no gap', () => {
        expect(orders(insertAt([r(10), r(11), r(40, true)], 1, r(0, false, 'n')))).toEqual([10, 20, 30, 40]);
        // gap to the used row is tighter than 10 → smaller step
        expect(orders(insertAt([r(1), r(2), r(8, true)], 1, r(0, false, 'n')))).toEqual([2, 4, 6, 8]);
    });

    it('returns null when used rows leave no room', () => {
        expect(insertAt([r(10, true), r(11, true)], 1, r(0, false, 'n'))).toBeNull();
    });

    it('moves unused rows, also past used ones; used rows never move', () => {
        const rows = [r(10), r(20, true), r(30)];
        expect(moveRow(rows, 1, 1)).toBeNull();
        expect(moveRow(rows, 0, -1)).toBeNull();
        const moved = moveRow(rows, 0, 1)!;
        expect(moved.map((x) => x.id)).toEqual(['20', '10', '30']);
        expect(orders(moved)).toEqual([20, 25, 30]);
        expect(moved[0]).toBe(rows[1]); // used row untouched
    });
});
