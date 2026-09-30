import {describe, expect, it} from 'vitest';
import {payLines, pctHundredths, pctTotalOk, stagePay, staffTotals} from '../pay';

describe('pay', () => {
    it('pctHundredths rounds float noise', () => {
        expect(pctHundredths(33.33)).toBe(3333);
        expect(pctHundredths(0.1 + 0.2)).toBe(30);
    });

    it('stagePay rounds .5 up on integer hundredths', () => {
        expect(stagePay(1_000_000, 30)).toBe(300_000);
        expect(stagePay(5, 50)).toBe(3); // 2.5 → 3
        expect(stagePay(1, 12.5)).toBe(0); // 0.125 → 0
        expect(stagePay(10_000_000_000, 33.33)).toBe(3_333_000_000);
    });

    it('pctTotalOk with 2 decimals', () => {
        expect(pctTotalOk([33.33, 33.33, 33.34])).toBe(true);
        expect(pctTotalOk([33.33, 33.33, 33.33])).toBe(false);
        expect(pctTotalOk([30, 30, 40])).toBe(true);
        expect(pctTotalOk([100])).toBe(true);
        expect(pctTotalOk([])).toBe(false);
    });

    it('payLines + staffTotals', () => {
        const task = (id: string, staff: string, type: string, progress: number) =>
            ({id, project_id: 'p', cut_id: 'c', work_type_id: type, staff_id: staff, progress, end_date: '2026-10-05'});
        const lines = payLines(
            [task('a', 's1', 'LO', 100), task('b', 's1', 'GE', 50), task('x', 's2', 'NOPE', 100)],
            [{id: 'c', budget: 1_000_000}],
            [{id: 'LO', pay_pct: 30}, {id: 'GE', pay_pct: 30}],
        );
        expect(lines.map((l) => [l.task_id, l.amount, l.earned])).toEqual([['a', 300_000, true], ['b', 300_000, false]]);

        const totals = staffTotals(lines, [
            {staff_id: 's1', amount: -50_000},
            {staff_id: 'helper', amount: 20_000}, // adjustment without a stage task of that staff
        ]);
        expect(totals.get('s1')).toEqual({earned: 300_000, pending: 300_000, adjustments: -50_000, total: 550_000});
        expect(totals.get('helper')).toEqual({earned: 0, pending: 0, adjustments: 20_000, total: 20_000});
    });
});
