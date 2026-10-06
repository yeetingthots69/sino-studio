import {describe, expect, it} from 'vitest';
import {DEFAULT_PREFS, EMPTY_PROJECT_FILTER, isValidCutCode, orderConflictText, parsePrefs, parseProjectFilter, projectFilterKey} from '../boardHelpers';
import {typeRule} from '../../pipeline';

describe('parsePrefs', () => {
    it('defaults for missing / corrupt / wrong-typed values', () => {
        expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
        expect(parsePrefs('{oops')).toEqual(DEFAULT_PREFS);
        expect(parsePrefs('{"sort":"zz","hideStrengths":"yes"}')).toEqual({sort: 'studio', hideStrengths: false});
        // the old global strength filter is ignored (moved to the per-project filter)
        expect(parsePrefs('{"sort":"za","filter":["x"],"hideStrengths":true}')).toEqual({sort: 'za', hideStrengths: true});
    });
});

describe('isValidCutCode', () => {
    it('printable ASCII, 1–20', () => {
        expect(isValidCutCode('C12A')).toBe(true);
        expect(isValidCutCode('')).toBe(false);
        expect(isValidCutCode('CĐ1')).toBe(false);
        expect(isValidCutCode('C'.repeat(21))).toBe(false);
    });
});

describe('orderConflictText', () => {
    const t = {orderEarlier: 'E {stage}', orderLater: 'L {stage}', orderEarly: 'EY {stage}', orderLate: 'LT {stage}', orderPhaseBefore: 'PB {phase} {stage}', orderPhaseAfter: 'PA {phase} {stage}', orderGeneric: 'G'};
    const stages = [{id: 's1', cut_id: 'c', work_type_id: 'lo', start_date: '2026-09-10', end_date: '2026-09-14'}];
    const cuts = new Map([['c', 'C12']]);
    const types = new Map([['lo', {code: 'LO', sort_order: 10}], ['ge', {code: 'GE', sort_order: 20}], ['cl', {code: 'CL', sort_order: 5}]]);
    const rule = (geOverlaps = false) => typeRule([...types].map(([id, w]) => ({id, sort_order: w.sort_order, overlaps_prev: id === 'ge' && geOverlaps, phase_id: 'p'})), []);

    it('names the stage; earlier vs later relative to the candidate type', () => {
        expect(orderConflictText(t, 's1', 'ge', stages, cuts, types, rule())).toBe('E C12 · LO (10/09–14/09)');
        expect(orderConflictText(t, 's1', 'cl', stages, cuts, types, rule())).toBe('L C12 · LO (10/09–14/09)');
    });

    it('flagged adjacent pair → early / late; a non-adjacent pair stays strict', () => {
        // CL(5) → LO(10) → GE(20), GE overlaps LO
        expect(orderConflictText(t, 's1', 'ge', stages, cuts, types, rule(true))).toBe('EY C12 · LO (10/09–14/09)');
        const ge = [{id: 's2', cut_id: 'c', work_type_id: 'ge', start_date: '2026-09-10', end_date: '2026-09-10'}];
        expect(orderConflictText(t, 's2', 'lo', ge, cuts, types, rule(true))).toBe('LT C12 · GE (10/09–10/09)');
        expect(orderConflictText(t, 's2', 'cl', ge, cuts, types, rule(true))).toBe('L C12 · GE (10/09–10/09)');
    });

    it('cross-phase → names the phase (v2.8)', () => {
        const phased = typeRule([{id: 'lo', sort_order: 10, overlaps_prev: false, phase_id: 'an'}, {id: 'ge', sort_order: 20, overlaps_prev: false, phase_id: 'co'}],
            [{id: 'an', name: 'Animation', after: []}, {id: 'co', name: 'Comp', after: ['an']}]);
        expect(orderConflictText(t, 's1', 'ge', stages, cuts, types, phased)).toBe('PB Animation C12 · LO (10/09–14/09)');
        const ge = [{id: 's2', cut_id: 'c', work_type_id: 'ge', start_date: '2026-09-10', end_date: '2026-09-10'}];
        expect(orderConflictText(t, 's2', 'lo', ge, cuts, types, phased)).toBe('PA Comp C12 · GE (10/09–10/09)');
    });

    it('generic when the stage is unknown', () => {
        expect(orderConflictText(t, 'nope', 'ge', stages, cuts, types, rule())).toBe('G');
        expect(orderConflictText(t, undefined, 'ge', stages, cuts, types, rule())).toBe('G');
    });
});

describe('parseProjectFilter', () => {
    it('keeps only string arrays; junk falls back to empty', () => {
        expect(parseProjectFilter(null)).toEqual(EMPTY_PROJECT_FILTER);
        expect(parseProjectFilter('{oops')).toEqual(EMPTY_PROJECT_FILTER);
        expect(parseProjectFilter('"str"')).toEqual(EMPTY_PROJECT_FILTER);
        expect(parseProjectFilter('{"strengths":"lo","departments":[1,"an",null]}')).toEqual({strengths: [], departments: ['an']});
        expect(parseProjectFilter('{"strengths":["lo"],"departments":["an"],"x":1}')).toEqual({strengths: ['lo'], departments: ['an']});
    });

    it('keys are per project', () => {
        expect(projectFilterKey('p1')).toBe('tracker.board.filter.p1');
        expect(projectFilterKey('p1')).not.toBe(projectFilterKey('p2'));
    });
});
