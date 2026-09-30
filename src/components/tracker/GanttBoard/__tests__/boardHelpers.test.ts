import {describe, expect, it} from 'vitest';
import {DEFAULT_PREFS, isValidCutCode, orderConflictText, parsePrefs} from '../boardHelpers';

describe('parsePrefs', () => {
    it('defaults for missing / corrupt / wrong-typed values', () => {
        expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
        expect(parsePrefs('{oops')).toEqual(DEFAULT_PREFS);
        expect(parsePrefs('{"sort":"zz","filter":[1,"a"],"hideStrengths":"yes"}')).toEqual({sort: 'studio', filter: ['a'], hideStrengths: false});
        expect(parsePrefs('{"sort":"za","filter":["x"],"hideStrengths":true}')).toEqual({sort: 'za', filter: ['x'], hideStrengths: true});
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
    const t = {orderEarlier: 'E {stage}', orderLater: 'L {stage}', orderGeneric: 'G'};
    const stages = [{id: 's1', cut_id: 'c', work_type_id: 'lo', start_date: '2026-09-10', end_date: '2026-09-14'}];
    const cuts = new Map([['c', 'C12']]);
    const types = new Map([['lo', {code: 'LO', sort_order: 10}], ['ge', {code: 'GE', sort_order: 20}], ['cl', {code: 'CL', sort_order: 5}]]);

    it('names the stage; earlier vs later relative to the candidate type', () => {
        expect(orderConflictText(t, 's1', 'ge', stages, cuts, types)).toBe('E C12 · LO (10/09–14/09)');
        expect(orderConflictText(t, 's1', 'cl', stages, cuts, types)).toBe('L C12 · LO (10/09–14/09)');
    });

    it('generic when the stage is unknown', () => {
        expect(orderConflictText(t, 'nope', 'ge', stages, cuts, types)).toBe('G');
        expect(orderConflictText(t, undefined, 'ge', stages, cuts, types)).toBe('G');
    });
});
