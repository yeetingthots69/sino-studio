import {describe, expect, it} from 'vitest';
import {ancestors, phaseLevels, phaseState, sortPhases, topoOrder, wouldCycle} from '../phases';

const ph = (id: string, after: string[] = [], sort_order = 0) => ({id, name: id, sort_order, after});
// BG and Animation in parallel, Comp after both.
const studio = [ph('BG', [], 10), ph('AN', [], 20), ph('Comp', ['BG', 'AN'], 30)];
const chain = [ph('A'), ph('B', ['A']), ph('C', ['B'])];
const diamond = [ph('A'), ph('B', ['A']), ph('C', ['A']), ph('D', ['B', 'C'])];

describe('phases', () => {
    it('sortPhases by sort_order', () => {
        expect(sortPhases([studio[2], studio[0], studio[1]]).map((p) => p.id)).toEqual(['BG', 'AN', 'Comp']);
    });

    it('ancestors: chain and diamond', () => {
        expect([...ancestors(chain, 'C')].sort()).toEqual(['A', 'B']);
        expect([...ancestors(chain, 'A')]).toEqual([]);
        expect([...ancestors(diamond, 'D')].sort()).toEqual(['A', 'B', 'C']);
        expect([...ancestors(studio, 'Comp')].sort()).toEqual(['AN', 'BG']);
    });

    it('phaseLevels', () => {
        expect(Object.fromEntries(phaseLevels(studio))).toEqual({BG: 0, AN: 0, Comp: 1});
        expect(Object.fromEntries(phaseLevels(chain))).toEqual({A: 0, B: 1, C: 2});
        expect(Object.fromEntries(phaseLevels(diamond))).toEqual({A: 0, B: 1, C: 1, D: 2});
    });

    it('phaseState: done / started / empty', () => {
        const stages = new Map([['LO', {progress: 100}], ['GE', {progress: 40}], ['DO', {progress: 100}]]);
        const stage = (id: string) => stages.get(id);
        expect(phaseState(['LO', 'DO'], stage)).toBe('done');
        expect(phaseState(['LO', 'GE'], stage)).toBe('started');
        expect(phaseState(['LO', 'SH'], stage)).toBe('started');
        expect(phaseState(['SH', 'XX'], stage)).toBe('empty');
        expect(phaseState([], stage)).toBe('empty');
    });

    it('wouldCycle: self, direct and transitive back edges', () => {
        expect(wouldCycle(chain, 'A', 'A')).toBe(true);
        expect(wouldCycle(chain, 'C', 'A')).toBe(true); // A after C, but C is (transitively) after A
        expect(wouldCycle(chain, 'B', 'A')).toBe(true);
        expect(wouldCycle(chain, 'A', 'C')).toBe(false); // C after A: already implied, no cycle
        expect(wouldCycle(studio, 'BG', 'AN')).toBe(false);
        expect(wouldCycle(studio, 'Comp', 'BG')).toBe(true);
    });

    it('topoOrder: by level, then tieBreak, then name', () => {
        expect(topoOrder(studio).map((p) => p.id)).toEqual(['AN', 'BG', 'Comp']);
        expect(topoOrder(studio, ['BG', 'AN']).map((p) => p.id)).toEqual(['BG', 'AN', 'Comp']);
        expect(topoOrder([...diamond].reverse(), ['C']).map((p) => p.id)).toEqual(['A', 'C', 'B', 'D']);
    });
});
