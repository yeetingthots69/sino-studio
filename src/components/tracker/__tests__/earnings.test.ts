import {describe, expect, it} from 'vitest';
import {earnings, effectiveMonths, formatVnd, parseMonthFilter, staffRows, totalsByProject, type Adjustment} from '../earnings';

const task = (id: string, project: string, cut: string, type: string, staff: string, progress: number, end: string) =>
    ({id, project_id: project, cut_id: cut, work_type_id: type, staff_id: staff, progress, end_date: end});
const adj = (id: string, a: Partial<Adjustment>): Adjustment => ({
    id, project_id: 'p1', cut_id: 'c1', work_type_id: 'LO', staff_id: 's1', amount: 0,
    created_at: '2026-10-15T00:00:00+00:00', reverses_id: null, ...a,
});

const tasks = [
    task('t1', 'p1', 'c1', 'LO', 's1', 100, '2026-09-30'),
    task('t2', 'p1', 'c1', 'GE', 's2', 40, '2026-10-10'),
    task('t3', 'p2', 'c2', 'LO', 's1', 100, '2026-10-02'),
];
const cuts = [{id: 'c1', budget: 1_000_000, pay_split: null}, {id: 'c2', budget: 2_000_000, pay_split: null}];
const types = [{id: 'LO', pay_pct: 30}, {id: 'GE', pay_pct: 70}];

describe('effectiveMonths', () => {
    it('stage task end month, else created_at month in Asia/Ho_Chi_Minh, reversal = original', () => {
        const adjs = [
            adj('withTask', {amount: 100}),                                                          // t1 → 2026-09
            adj('noTask', {cut_id: 'c9', created_at: '2026-10-31T17:30:00+00:00'}),                  // HCM 2026-11-01
            adj('noTaskUtc', {cut_id: 'c9', created_at: '2026-10-31T16:59:00+00:00'}),               // HCM 2026-10-31
            adj('rev', {reverses_id: 'withTask', cut_id: 'c9', created_at: '2026-12-01T00:00:00Z'}), // original → 2026-09
            adj('revNoTask', {reverses_id: 'noTask', created_at: '2027-01-05T00:00:00Z'}),           // original → 2026-11
        ];
        const m = effectiveMonths(tasks, adjs);
        expect(Object.fromEntries(m)).toEqual({
            withTask: '2026-09', noTask: '2026-11', noTaskUtc: '2026-10', rev: '2026-09', revNoTask: '2026-11',
        });
    });
});

describe('earnings', () => {
    const adjustments = [
        adj('a1', {amount: 50_000}),                                               // t1 → 2026-09
        adj('a2', {amount: -50_000, reverses_id: 'a1', created_at: '2026-11-02T00:00:00Z'}), // reversal → 2026-09
        adj('a3', {project_id: 'p2', cut_id: 'gone', staff_id: 's3', amount: 20_000}), // no task → created 2026-10
    ];
    const data = {tasks, cuts, types, adjustments};

    it('all months, all projects', () => {
        const r = earnings(data, 'all');
        expect(r.totals.get('s1')).toEqual({earned: 300_000 + 600_000, pending: 0, adjustments: 0, total: 900_000});
        expect(r.totals.get('s2')).toEqual({earned: 0, pending: 700_000, adjustments: 0, total: 700_000});
        expect(r.totals.get('s3')).toEqual({earned: 0, pending: 0, adjustments: 20_000, total: 20_000});
    });

    it('month filter: stages by end month, reversal counted in the original month', () => {
        const sep = earnings(data, '2026-09');
        expect(sep.lines.map((l) => l.task_id)).toEqual(['t1']);
        expect(sep.adjustments.map((a) => a.id)).toEqual(['a1', 'a2']);
        expect(sep.totals.get('s1')).toEqual({earned: 300_000, pending: 0, adjustments: 0, total: 300_000});
        const nov = earnings(data, '2026-11');
        expect(nov.adjustments).toEqual([]);
        const oct = earnings(data, '2026-10');
        expect(oct.lines.map((l) => l.task_id)).toEqual(['t2', 't3']);
        expect(oct.adjustments.map((a) => a.id)).toEqual(['a3']);
    });

    it('project scope and per-project breakdown sum to the studio total', () => {
        const p1 = earnings(data, 'all', new Set(['p1']));
        expect(p1.totals.get('s1')?.total).toBe(300_000);
        expect(p1.totals.has('s3')).toBe(false);
        const all = earnings(data, 'all');
        const by = totalsByProject(all.lines, all.adjustments);
        const s1 = [...by.values()].reduce((s, m) => s + (m.get('s1')?.total ?? 0), 0);
        expect(s1).toBe(all.totals.get('s1')?.total);
    });

    it('staffRows sorts stages by end date and adjustments newest first', () => {
        const r = staffRows(earnings(data, 'all'), 's1');
        expect(r.lines.map((l) => l.task_id)).toEqual(['t3', 't1']);
        expect(r.adjustments.map((a) => a.id)).toEqual(['a2', 'a1']);
    });
});

describe('misc', () => {
    it('parseMonthFilter', () => {
        expect(parseMonthFilter('all', '2026-09')).toBe('all');
        expect(parseMonthFilter('2026-10', 'all')).toBe('2026-10');
        expect(parseMonthFilter('2026-13', 'all')).toBe('all');
        expect(parseMonthFilter(['2026-10'], '2026-09')).toBe('2026-09');
    });

    it('formatVnd', () => {
        expect(formatVnd(1_234_000).replace(/\s/g, ' ')).toBe('1.234.000 ₫');
        expect(formatVnd(-200_000, true).replace(/\s/g, ' ')).toBe('-200.000 ₫');
        expect(formatVnd(200_000, true).replace(/\s/g, ' ')).toBe('+200.000 ₫');
    });
});
