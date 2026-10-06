import {describe, expect, it} from 'vitest';
import type {Json} from '@/types/database.types';
import {cutBudget, cutTotal, movableAdjustments, payLines, pctHundredths, pctTotalOk, phaseSplit, stagePay, stagePct, staffTotals} from '../pay';

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
            ({id, project_id: 'p', cut_id: 'c', work_type_id: type, staff_id: staff, progress, end_date: '2026-10-05', is_fix: false});
        const lines = payLines(
            [task('a', 's1', 'LO', 100), task('b', 's1', 'GE', 50), task('x', 's2', 'NOPE', 100)],
            [{id: 'c', budgets: {P: 1_000_000}, pay_split: null}],
            [{id: 'LO', pay_pct: 30, phase_id: 'P'}, {id: 'GE', pay_pct: 30, phase_id: 'P'}],
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
            ({id, project_id: 'p', cut_id: cut, work_type_id: type, staff_id: 's', progress: 0, end_date: '2026-10-05', is_fix: false});
        const types = [{id: 'LO', pay_pct: 30, phase_id: 'P'}, {id: 'GE', pay_pct: 30, phase_id: 'P'}, {id: 'DO', pay_pct: 40, phase_id: 'P'}];
        const cuts = [
            {id: 'c1', budgets: {P: 1_000_000}, pay_split: null},
            {id: 'c2', budgets: {P: 1_000_000}, pay_split: {LO: 30, GE: 20, DO: 50}},
            {id: 'c3', budgets: {P: 1_000_000}, pay_split: {LO: 50, GE: 50}},
        ];
        const lines = payLines(
            ['c1', 'c2', 'c3'].flatMap((c) => types.map((t) => task(c + t.id, c, t.id))),
            cuts,
            types,
        );
        expect(lines.map((l) => l.amount)).toEqual([300_000, 300_000, 400_000, 300_000, 200_000, 500_000, 500_000, 500_000, 0]);
        expect(stagePct(cuts[1], types[1], ['LO', 'GE', 'DO'])).toBe(20);
        expect(stagePct(cuts[0], types[1], ['LO', 'GE', 'DO'])).toBe(30);
    });

    it('payLines: a fix (v2.6) emits no line; totals equal the data without it', () => {
        const base = {project_id: 'p', cut_id: 'c', work_type_id: 'LO', progress: 100, end_date: '2026-10-05'};
        const stage = {...base, id: 'lo', staff_id: 'A', is_fix: false};
        const fix = {...base, id: 'fx', staff_id: 'B', is_fix: true};
        const cuts = [{id: 'c', budgets: {P: 1_000_000}, pay_split: null}];
        const types = [{id: 'LO', pay_pct: 30, phase_id: 'P'}];
        const withFix = payLines([stage, fix], cuts, types);
        expect(withFix.map((l) => l.task_id)).toEqual(['lo']);
        expect(staffTotals(withFix, [])).toEqual(staffTotals(payLines([stage], cuts, types), []));
    });

    describe('phases (v2.8)', () => {
        const types = [
            {id: 'sketch', pay_pct: 20, phase_id: 'BG'}, {id: 'colour', pay_pct: 30, phase_id: 'BG'}, {id: 'final', pay_pct: 50, phase_id: 'BG'},
            {id: 'LO', pay_pct: 30, phase_id: 'AN'}, {id: 'GE', pay_pct: 30, phase_id: 'AN'}, {id: 'DO', pay_pct: 30, phase_id: 'AN'}, {id: 'SH', pay_pct: 10, phase_id: 'AN'},
        ];
        const anIds = ['LO', 'GE', 'DO', 'SH'];
        const task = (type: string, extra: Partial<{is_fix: boolean; id: string}> = {}) =>
            ({id: type, project_id: 'p', cut_id: 'c', work_type_id: type, staff_id: 's', progress: 0, end_date: '2026-10-05', is_fix: false, ...extra});
        const amounts = (cut: {budgets: Json; pay_split: Json}, ids = types.map((t) => t.id)) =>
            Object.fromEntries(payLines(ids.map((id) => task(id)), [{id: 'c', ...cut}], types).map((l) => [l.work_type_id, l.amount]));
        const budgets = {BG: 1_000_000, AN: 2_000_000};

        it('each stage is paid from its phase budget', () => {
            const a = amounts({budgets, pay_split: null});
            expect(a.sketch).toBe(200_000);
            expect(a.SH).toBe(200_000);
            expect(a.final).toBe(500_000);
        });

        it('an override of one phase leaves the other phase on its defaults', () => {
            const a = amounts({budgets, pay_split: {LO: 40, GE: 40, DO: 20, SH: 0}});
            expect(a.SH).toBe(0);
            expect(a.LO).toBe(800_000);
            expect(a.sketch).toBe(200_000);
            expect(stagePct({pay_split: {LO: 40, GE: 40, DO: 20, SH: 0}}, types[0], ['sketch', 'colour', 'final'])).toBe(20);
        });

        it('an override that omits a type of its phase → 0', () => {
            expect(amounts({budgets, pay_split: {LO: 50, GE: 50}}).DO).toBe(0);
            expect(phaseSplit({pay_split: {LO: 50, GE: 50}}, anIds)).toEqual({LO: 50, GE: 50});
            expect(phaseSplit({pay_split: {LO: 50, GE: 50}}, ['sketch'])).toBeNull();
            expect(phaseSplit({pay_split: null}, anIds)).toBeNull();
        });

        it('no budget for a phase → 0', () => {
            const a = amounts({budgets: {AN: 2_000_000}, pay_split: null});
            expect(a.sketch).toBe(0);
            expect(a.LO).toBe(600_000);
        });

        it('a fix task → no line', () => {
            expect(payLines([task('LO', {is_fix: true})], [{id: 'c', budgets, pay_split: null}], types)).toEqual([]);
        });

        it('rounding matches stagePay', () => {
            const t = [{id: 'x', pay_pct: 33.33, phase_id: 'BG'}, {id: 'y', pay_pct: 66.67, phase_id: 'BG'}];
            const [line] = payLines([task('x')], [{id: 'c', budgets: {BG: 1_000_001}, pay_split: null}], t);
            expect(line.amount).toBe(stagePay(1_000_001, 33.33));
        });

        it('cutBudget / cutTotal count only finite non-negative numbers', () => {
            const cut = {budgets: {BG: 1_000_000, AN: 2_000_000, bad: -1, str: '5', nil: null}};
            expect(cutBudget(cut, 'BG')).toBe(1_000_000);
            expect(cutBudget(cut, 'bad')).toBe(0);
            expect(cutBudget(cut, 'str')).toBe(0);
            expect(cutBudget(cut, 'none')).toBe(0);
            expect(cutTotal(cut)).toBe(3_000_000);
            for (const budgets of [null, [], 5, {}] as Json[]) expect(cutTotal({budgets})).toBe(0);
        });
    });

    describe('movableAdjustments', () => {
        const key = {staff_id: 's1', cut_id: 'c1', work_type_id: 't1'};
        const row = (id: string, amount: number, extra: Partial<{staff_id: string; cut_id: string; work_type_id: string; reverses_id: string | null}> = {}) =>
            ({id, amount, ...key, reverses_id: null, ...extra});

        it('keeps open originals of the key only', () => {
            const rows = [
                row('a', 100),
                row('b', -50),
                row('b-rev', 50, {reverses_id: 'b'}), // reversal: excluded, and b is excluded as reversed
                row('x', 10, {staff_id: 's2'}),
                row('y', 10, {cut_id: 'c2'}),
                row('z', 10, {work_type_id: 't2'}),
            ];
            expect(movableAdjustments(rows, key).map((r) => r.id)).toEqual(['a']);
        });

        it('excludes a reversal row even when nothing else matches', () => {
            expect(movableAdjustments([row('r', -10, {reverses_id: 'gone'})], key)).toEqual([]);
        });

        it('empty input → empty', () => {
            expect(movableAdjustments([], key)).toEqual([]);
        });
    });
});
