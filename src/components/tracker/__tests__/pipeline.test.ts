import {describe, expect, it} from 'vitest';
import {orderConflict, typeRule, type StageTask} from '../pipeline';

const ORDER = typeRule([{id: 'LO', sort_order: 10, overlaps_prev: false, phase_id: 'P'}, {id: 'GE', sort_order: 20, overlaps_prev: false, phase_id: 'P'}, {id: 'DS', sort_order: 30, overlaps_prev: false, phase_id: 'P'}], []);
const t = (id: string, type: string, start: string, end: string, cut = 'c1', is_fix = false): StageTask =>
    ({id, cut_id: cut, work_type_id: type, start_date: start, end_date: end, is_fix});
const hit = (stages: StageTask[], rule: ReturnType<typeof typeRule>, c: StageTask) => orderConflict(stages, rule, c)?.task ?? null;

describe('orderConflict', () => {
    const lo = t('lo', 'LO', '2026-10-01', '2026-10-05');

    it('earlier stage ending on the candidate start day conflicts (equal dates)', () => {
        expect(orderConflict([lo], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-08'))).toEqual({task: lo, reason: 'earlier'});
        expect(orderConflict([lo], ORDER, t('ge', 'GE', '2026-10-06', '2026-10-08'))).toBeNull();
    });

    it('later stage starting on the candidate end day conflicts', () => {
        const ge = t('ge', 'GE', '2026-10-06', '2026-10-08');
        expect(orderConflict([lo, ge], ORDER, {...lo, end_date: '2026-10-06'})).toEqual({task: ge, reason: 'later'});
        expect(orderConflict([lo, ge], ORDER, lo)).toBeNull();
    });

    it('missing middle stage is fine (DO + SH without GE)', () => {
        expect(hit([lo], ORDER, t('ds', 'DS', '2026-10-06', '2026-10-09'))).toBeNull();
        expect(hit([lo], ORDER, t('ds', 'DS', '2026-10-05', '2026-10-09'))).toBe(lo);
    });

    it('returns the conflicting task with the lowest type order (SQL order by sort_order)', () => {
        const ds = t('ds', 'DS', '2026-10-02', '2026-10-09');
        const ge = t('ge', 'GE', '2026-10-01', '2026-10-09');
        expect(hit([ds, lo], ORDER, ge)).toBe(lo);
        expect(hit([ds, ge], ORDER, {...lo, end_date: '2026-10-09'})).toBe(ge);
    });

    it('ignores the same id, other cuts and unordered types', () => {
        expect(hit([lo], ORDER, {...lo, start_date: '2026-10-02'})).toBeNull();
        expect(hit([t('x', 'LO', '2026-10-01', '2026-10-09', 'c2')], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-06'))).toBeNull();
        expect(hit([t('x', 'ZZ', '2026-10-01', '2026-10-09')], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-06'))).toBeNull();
        expect(hit([lo], ORDER, t('z', 'ZZ', '2026-10-01', '2026-10-09'))).toBeNull();
    });

    it('fix tasks (v2.6): a fix candidate never conflicts; a fix row never blocks', () => {
        const ge = t('ge', 'GE', '2026-10-06', '2026-10-08');
        expect(orderConflict([lo, ge], ORDER, t('fx', 'LO', '2026-10-07', '2026-10-09', 'c1', true))).toBeNull();
        expect(orderConflict([lo, ge], ORDER, t('fx', 'GE', '2026-10-01', '2026-10-01', 'c1', true))).toBeNull();
        const loFix = t('fx', 'LO', '2026-10-06', '2026-10-20', 'c1', true);
        expect(orderConflict([lo, loFix], ORDER, ge)).toBeNull();
        expect(orderConflict([loFix], ORDER, t('ds', 'DS', '2026-10-10', '2026-10-12'))).toBeNull();
    });
});

describe('orderConflict with overlaps_prev (v2.5)', () => {
    // GE → DO → SH (SH flagged) → CL; listed out of order to check the predecessor is by sort_order
    const types = (flags: Partial<Record<string, boolean>> = {}) => typeRule([
        {id: 'CL', sort_order: 50, overlaps_prev: !!flags.CL, phase_id: 'P'},
        {id: 'GE', sort_order: 10, overlaps_prev: !!flags.GE, phase_id: 'P'},
        {id: 'SH', sort_order: 40, overlaps_prev: flags.SH ?? true, phase_id: 'P'},
        {id: 'DO', sort_order: 30, overlaps_prev: !!flags.DO, phase_id: 'P'},
    ], []);
    const rule = types();
    const doT = t('do', 'DO', '2026-10-10', '2026-10-14');

    it('typeRule: order, direct predecessor and flags', () => {
        expect(rule.order.get('SH')).toBe(40);
        expect(rule.prev.get('GE')).toBeNull();
        expect(rule.prev.get('SH')).toBe('DO');
        expect([...rule.overlaps]).toEqual(['SH']);
    });

    it('same-day start is OK', () => {
        expect(orderConflict([doT], rule, t('sh', 'SH', '2026-10-10', '2026-10-10'))).toBeNull();
    });

    it('B starting before A starts → early', () => {
        expect(orderConflict([doT], rule, t('sh', 'SH', '2026-10-09', '2026-10-12'))).toEqual({task: doT, reason: 'early'});
    });

    it('A starting after B has started → late', () => {
        const sh = t('sh', 'SH', '2026-10-10', '2026-10-10');
        expect(orderConflict([sh], rule, {...doT, start_date: '2026-10-11'})).toEqual({task: sh, reason: 'late'});
        expect(orderConflict([sh], rule, doT)).toBeNull();
    });

    it('1-day B inside A is OK; extending A past B’s end is OK', () => {
        const sh = t('sh', 'SH', '2026-10-12', '2026-10-12');
        expect(orderConflict([doT], rule, sh)).toBeNull();
        expect(orderConflict([sh], rule, {...doT, end_date: '2026-10-20'})).toBeNull();
    });

    it('unflagged C must clear both A’s and B’s end', () => {
        const sh = t('sh', 'SH', '2026-10-10', '2026-10-10');
        expect(orderConflict([doT, sh], rule, t('cl', 'CL', '2026-10-14', '2026-10-15'))).toEqual({task: doT, reason: 'earlier'});
        expect(orderConflict([doT, sh], rule, t('cl', 'CL', '2026-10-15', '2026-10-15'))).toBeNull();
        // strict from the other side: moving A's end onto C
        const cl = t('cl', 'CL', '2026-10-15', '2026-10-15');
        expect(orderConflict([sh, cl], rule, {...doT, end_date: '2026-10-15'})).toEqual({task: cl, reason: 'later'});
    });

    it('chained flags: C flagged only needs C.start >= B.start; A → C stays strict', () => {
        const chain = types({CL: true});
        const sh = t('sh', 'SH', '2026-10-12', '2026-10-12');
        expect(orderConflict([sh], chain, t('cl', 'CL', '2026-10-12', '2026-10-12'))).toBeNull();
        expect(orderConflict([sh], chain, t('cl', 'CL', '2026-10-11', '2026-10-12'))).toEqual({task: sh, reason: 'early'});
        expect(orderConflict([doT, sh], chain, t('cl', 'CL', '2026-10-12', '2026-10-12'))).toEqual({task: doT, reason: 'earlier'});
    });

    it('a non-adjacent type stays strict', () => {
        const ge = t('ge', 'GE', '2026-10-01', '2026-10-05');
        const sh = t('sh', 'SH', '2026-10-05', '2026-10-05');
        expect(orderConflict([ge], rule, sh)).toEqual({task: ge, reason: 'earlier'});
        expect(orderConflict([sh], rule, ge)).toEqual({task: sh, reason: 'later'});
    });

    it('a flag on the first type has no effect', () => {
        const first = types({GE: true});
        const ge = t('ge', 'GE', '2026-10-01', '2026-10-05');
        expect(orderConflict([ge], first, t('do', 'DO', '2026-10-05', '2026-10-06'))).toEqual({task: ge, reason: 'earlier'});
        expect(orderConflict([], first, ge)).toBeNull();
    });
});

describe('orderConflict by phase (v2.8, SQL S5–S9)', () => {
    // BG (sketch, colour, final) → Animation (LO, GE, DO, SH flagged) → Comp (pre, prod, post; after BG + AN)
    const phases = [{id: 'BG', name: 'BG', after: []}, {id: 'AN', name: 'Animation', after: []}, {id: 'CO', name: 'Comp', after: ['BG', 'AN']}];
    const types = (preOverlaps = false) => typeRule([
        ...['sketch', 'colour', 'final'].map((id, i) => ({id, sort_order: 10 + i * 10, overlaps_prev: false, phase_id: 'BG'})),
        ...['LO', 'GE', 'DO', 'SH'].map((id, i) => ({id, sort_order: 40 + i * 10, overlaps_prev: id === 'SH', phase_id: 'AN'})),
        ...['pre', 'prod', 'post'].map((id, i) => ({id, sort_order: 80 + i * 10, overlaps_prev: id === 'pre' && preOverlaps, phase_id: 'CO'})),
    ], phases);
    const rule = types();
    const sh = t('sh', 'SH', '2026-10-05', '2026-10-10');

    it('typeRule: prev per phase, phaseOf, ancestor closure', () => {
        expect(rule.prev.get('LO')).toBeNull();
        expect(rule.prev.get('pre')).toBeNull();
        expect(rule.prev.get('GE')).toBe('LO');
        expect(rule.phaseOf.get('prod')).toBe('CO');
        expect([...rule.anc.get('CO')!].sort()).toEqual(['AN', 'BG']);
        expect(rule.anc.get('BG')!.size).toBe(0);
    });

    it('S5: ancestor must end before; descendant must start after', () => {
        expect(orderConflict([sh], rule, t('pre', 'pre', '2026-10-10', '2026-10-12'))).toEqual({task: sh, reason: 'phaseBefore'});
        const pre = t('pre', 'pre', '2026-10-11', '2026-10-12');
        expect(orderConflict([sh], rule, pre)).toBeNull();
        expect(orderConflict([sh, pre], rule, t('final', 'final', '2026-10-01', '2026-10-12'))).toEqual({task: pre, reason: 'phaseAfter'});
        expect(orderConflict([sh, pre], rule, t('final', 'final', '2026-10-01', '2026-10-10'))).toBeNull();
    });

    it('S6: transitive A → B → C with B absent', () => {
        const chain = typeRule([
            {id: 'a', sort_order: 10, overlaps_prev: false, phase_id: 'A'},
            {id: 'b', sort_order: 20, overlaps_prev: false, phase_id: 'B'},
            {id: 'c', sort_order: 30, overlaps_prev: false, phase_id: 'C'},
        ], [{id: 'A', name: 'A', after: []}, {id: 'B', name: 'B', after: ['A']}, {id: 'C', name: 'C', after: ['B']}]);
        const a = t('a', 'a', '2026-10-01', '2026-10-05');
        expect(orderConflict([a], chain, t('c', 'c', '2026-10-05', '2026-10-06'))).toEqual({task: a, reason: 'phaseBefore'});
        expect(orderConflict([a], chain, t('c', 'c', '2026-10-06', '2026-10-06'))).toBeNull();
        expect(orderConflict([t('c', 'c', '2026-10-05', '2026-10-06')], chain, a)?.reason).toBe('phaseAfter');
    });

    it('S7: parallel phases never conflict; no loaded phases = no cross-phase rule', () => {
        const bg = t('final', 'final', '2026-10-01', '2026-10-20');
        expect(orderConflict([bg], rule, sh)).toBeNull();
        expect(orderConflict([sh], rule, bg)).toBeNull();
        const flat = typeRule([{id: 'SH', sort_order: 70, overlaps_prev: false, phase_id: 'AN'}, {id: 'pre', sort_order: 80, overlaps_prev: false, phase_id: 'CO'}], []);
        expect(orderConflict([sh], flat, t('pre', 'pre', '2026-10-01', '2026-10-02'))).toBeNull();
    });

    it('S8: intra-phase rule unchanged; overlaps_prev never crosses phases', () => {
        const lo = t('lo', 'LO', '2026-10-01', '2026-10-05');
        expect(orderConflict([lo], rule, t('ge', 'GE', '2026-10-05', '2026-10-06'))).toEqual({task: lo, reason: 'earlier'});
        const doT = t('do', 'DO', '2026-10-05', '2026-10-08');
        expect(orderConflict([doT], rule, t('sh', 'SH', '2026-10-05', '2026-10-06'))).toBeNull();
        expect(orderConflict([sh], types(true), t('pre', 'pre', '2026-10-10', '2026-10-12'))).toEqual({task: sh, reason: 'phaseBefore'});
    });

    it('picks the lowest global sort_order across phases (O6)', () => {
        const final = t('final', 'final', '2026-10-01', '2026-10-10');
        expect(orderConflict([sh, final], rule, t('pre', 'pre', '2026-10-10', '2026-10-12'))?.task).toBe(final);
    });

    it('S9: fixes exempt on both sides', () => {
        expect(orderConflict([sh], rule, t('fx', 'pre', '2026-10-01', '2026-10-02', 'c1', true))).toBeNull();
        expect(orderConflict([{...sh, is_fix: true}], rule, t('pre', 'pre', '2026-10-01', '2026-10-02'))).toBeNull();
    });
});
