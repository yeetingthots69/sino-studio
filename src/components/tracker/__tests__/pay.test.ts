import {describe, expect, it} from 'vitest';
import {payLines, pctHundredths, pctTotalOk, stagePay, stagePct, staffTotals} from '../pay';

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
            [{id: 'c', budget: 1_000_000, pay_split: null}],
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

    it('a cut split overrides the type defaults; types it omits get 0', () => {
        const task = (id: string, cut: string, type: string) =>
            ({id, project_id: 'p', cut_id: cut, work_type_id: type, staff_id: 's', progress: 0, end_date: '2026-10-05'});
        const types = [{id: 'LO', pay_pct: 30}, {id: 'GE', pay_pct: 30}, {id: 'DO', pay_pct: 40}];
        const cuts = [
            {id: 'c1', budget: 1_000_000, pay_split: null},
            {id: 'c2', budget: 1_000_000, pay_split: {LO: 30, GE: 20, DO: 50}},
            {id: 'c3', budget: 1_000_000, pay_split: {LO: 50, GE: 50}},
        ];
        const lines = payLines(
            ['c1', 'c2', 'c3'].flatMap((c) => types.map((t) => task(c + t.id, c, t.id))),
            cuts,
            types,
        );
        expect(lines.map((l) => l.amount)).toEqual([300_000, 300_000, 400_000, 300_000, 200_000, 500_000, 500_000, 500_000, 0]);
        expect(stagePct(cuts[1], types[1])).toBe(20);
        expect(stagePct(cuts[0], types[1])).toBe(30);
    });
});
