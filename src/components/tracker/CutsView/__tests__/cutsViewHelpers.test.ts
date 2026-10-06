import {describe, expect, it} from 'vitest';
import type {PayLine} from '../../pay';
import {
    amountOk, auditChanges, budgetEntries, cellState, footerTotals, formatAmountInput, netByStaff, parseAmount, phaseSplitLabel,
    pickPhase, presetToDraft, stagePeople, waitingFor,
} from '../cutsViewHelpers';

const types = [{code: 'LO', phase_id: 'A'}, {code: 'GE', phase_id: 'A'}, {code: 'DO', phase_id: 'A'}];

describe('cutsViewHelpers', () => {
    it('cellState', () => {
        expect(cellState(undefined)).toBe('empty');
        expect(cellState({progress: 0})).toBe('progress');
        expect(cellState({progress: 99})).toBe('progress');
        expect(cellState({progress: 100})).toBe('done');
    });

    it('waitingFor: nearest earlier existing stage below 100 %', () => {
        expect(waitingFor(types, [{progress: 50}, undefined, undefined], 1)).toBe(types[0]);
        expect(waitingFor(types, [{progress: 50}, undefined, undefined], 2)).toBe(types[0]); // skips missing GE
        expect(waitingFor(types, [{progress: 50}, {progress: 100}, {progress: 0}], 2)).toBe(types[0]); // done GE skipped
        expect(waitingFor(types, [{progress: 100}, {progress: 100}, {progress: 0}], 2)).toBeNull();
        expect(waitingFor(types, [{progress: 100}, {progress: 30}, undefined], 2)).toBe(types[1]);
        expect(waitingFor(types, [{progress: 50}, {progress: 100}, undefined], 1)).toBeNull(); // this stage done
        expect(waitingFor(types, [undefined, undefined, {progress: 0}], 2)).toBeNull();
        expect(waitingFor(types, [{progress: 0}, undefined, undefined], 0)).toBeNull();
    });

    it('waitingFor stays in the type phase (v2.8)', () => {
        const phased = [{code: 'BG', phase_id: 'A'}, {code: 'LO', phase_id: 'B'}, {code: 'GE', phase_id: 'B'}];
        expect(waitingFor(phased, [{progress: 50}, undefined, undefined], 1)).toBeNull();
        expect(waitingFor(phased, [{progress: 50}, undefined, {progress: 0}], 2)).toBeNull();
        expect(waitingFor(phased, [{progress: 50}, {progress: 10}, {progress: 0}], 2)).toEqual({code: 'LO', phase_id: 'B'});
    });

    it('stagePeople: assignee base + helpers with adjustments only', () => {
        const line: PayLine = {
            task_id: 't', project_id: 'p', cut_id: 'c', work_type_id: 'w', staff_id: 'a',
            amount: 300_000, earned: false, end_date: '2026-10-01',
        };
        const rows = stagePeople(line, [
            {staff_id: 'z', amount: 100_000},
            {staff_id: 'a', amount: -50_000},
            {staff_id: 'b', amount: 20_000},
            {staff_id: 'b', amount: -20_000},
        ], (x, y) => x.localeCompare(y));
        expect(rows.map((r) => r.staff_id)).toEqual(['a', 'b', 'z']);
        expect(rows[0]).toMatchObject({assignee: true, base: 300_000, totals: {pending: 300_000, adjustments: -50_000, total: 250_000}});
        expect(rows[1]).toMatchObject({assignee: false, base: 0, totals: {adjustments: 0, total: 0}});
        expect(rows[2]).toMatchObject({assignee: false, base: 0, totals: {total: 100_000}});
        expect(stagePeople(undefined, [{staff_id: 'x', amount: 5}], () => 0)).toMatchObject([{staff_id: 'x', assignee: false, base: 0}]);
    });

    it('netByStaff mixes signs per person and skips incomplete rows', () => {
        expect(netByStaff([
            {staff_id: 'tom', amount: -200_000},
            {staff_id: 'vu', amount: 200_000},
            {staff_id: 'tom', amount: 50_000},
            {staff_id: null, amount: 10},
            {staff_id: 'x', amount: 0},
        ])).toEqual([['tom', -150_000], ['vu', 200_000]]);
    });

    it('auditChanges', () => {
        expect(auditChanges({id: '1', budget: 1, code: 'C1', updated_at: 'a'}, {id: '1', budget: 2, code: 'C1', updated_at: 'b'}))
            .toEqual([{field: 'budget', from: 1, to: 2}]);
        expect(auditChanges(null, {id: '1', code: 'C1', links: []})).toEqual([
            {field: 'code', from: undefined, to: 'C1'},
            {field: 'links', from: undefined, to: []},
        ]);
        expect(auditChanges({links: [{a: 1}]}, {links: [{a: 1}]})).toEqual([]);
    });

    it('parseAmount / amountOk: vi grouping, no clamping', () => {
        expect(parseAmount('200.000')).toBe(200_000);
        expect(parseAmount('200,000')).toBe(200_000);
        expect(parseAmount(' 1 500 000 ')).toBe(1_500_000);
        expect(parseAmount('0')).toBe(0);
        expect(parseAmount('')).toBeNull();
        expect(parseAmount('-5')).toBeNull();
        expect(parseAmount('12a')).toBeNull();
        expect(amountOk(parseAmount('0'))).toBe(false);
        expect(amountOk(parseAmount('200.000'))).toBe(true);
        expect(amountOk(10_000_000_001)).toBe(false);
        expect(amountOk(null)).toBe(false);
        expect(formatAmountInput('200000')).toBe('200.000');
        expect(formatAmountInput('abc')).toBe('abc');
    });
});

describe('presetToDraft', () => {
    const types = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
    it('maps by position when the counts match', () => {
        expect(presetToDraft([30, 30, 40], types)).toEqual({draft: {a: 30, b: 30, c: 40}, missing: [], extra: []});
    });
    it('fills missing types with 0 and flags them', () => {
        expect(presetToDraft([50, 50], types)).toEqual({draft: {a: 50, b: 50, c: 0}, missing: ['c'], extra: []});
    });
    it('returns values past the last type as extra', () => {
        expect(presetToDraft([30, 30, 30, 10], types)).toEqual({draft: {a: 30, b: 30, c: 30}, missing: [], extra: [10]});
    });

    it('pickPhase: saved id when present, else the first', () => {
        const phases = [{id: 'A'}, {id: 'B'}];
        expect(pickPhase(phases, 'B')?.id).toBe('B');
        expect(pickPhase(phases, 'gone')?.id).toBe('A');
        expect(pickPhase(phases, null)?.id).toBe('A');
        expect(pickPhase([], 'A')).toBeUndefined();
    });

    it('footerTotals: per type of the phase, phase total, all-phase total', () => {
        const lines = [{work_type_id: 'lo', amount: 100}, {work_type_id: 'lo', amount: 50}, {work_type_id: 'ge', amount: 30}, {work_type_id: 'bg', amount: 7}];
        const r = footerTotals(lines, ['lo', 'ge', 'do']);
        expect([...r.byType]).toEqual([['lo', 150], ['ge', 30], ['do', 0]]);
        expect(r.phase).toBe(180);
        expect(r.all).toBe(187);
    });

    it('phaseSplitLabel: one phase only; custom = that phase overridden', () => {
        const anim = [{id: 'lo', pay_pct: 40}, {id: 'ge', pay_pct: 60}];
        const bg = [{id: 'bg', pay_pct: 100}];
        const cut = {pay_split: {lo: 30, ge: 70}};
        expect(phaseSplitLabel(cut, anim)).toEqual({text: '30 · 70%', custom: true});
        expect(phaseSplitLabel(cut, bg)).toEqual({text: '100%', custom: false});
        expect(phaseSplitLabel({pay_split: null}, anim)).toEqual({text: '40 · 60%', custom: false});
    });

    it('budgetEntries: audit budgets by phase name, in phase order', () => {
        const phases = [{id: 'A', name: 'BG'}, {id: 'B', name: 'Animation'}];
        expect(budgetEntries({B: 500, A: 0}, phases)).toEqual([['BG', 0], ['Animation', 500]]);
        expect(budgetEntries({}, phases)).toEqual([]);
        expect(budgetEntries(null, phases)).toEqual([]);
    });
});
