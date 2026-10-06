import {describe, expect, it} from 'vitest';
import {draftIssues, draftToPayload, linkAllowed, moveBefore, phaseNameKey, removePhase, setAfter, type PhaseDraft} from '../phaseDraft';

const type = (code: string, pay_pct: number | string = 100, overlaps_prev = false) =>
    ({key: code, code, label: code, color: '#888888', pay_pct, sort_order: 10, overlaps_prev, used: false});
const phase = (key: string, after: string[] = [], types = [type(key.toUpperCase())]): PhaseDraft =>
    ({key, name: key, after, types});

// bg ∥ anim → comp
const graph = () => [phase('comp', ['bg', 'anim']), phase('anim'), phase('bg')];

describe('draftToPayload', () => {
    it('sends topological order (ties = draft order) with after as earlier indexes', () => {
        const out = draftToPayload(graph());
        expect(out.map((p) => p.name)).toEqual(['anim', 'bg', 'comp']);
        expect(out.map((p) => p.after)).toEqual([[], [], [0, 1]]);
    });

    it('trims, coerces pay % and drops overlaps on the first stage of each phase', () => {
        const [p] = draftToPayload([{key: 'a', name: '  Anim ', after: [], types: [type(' LO ', '40', true), type('GE', 60, true)]}]);
        expect(p.name).toBe('Anim');
        expect(p.types.map((t) => [t.code, t.pay_pct, t.overlaps_prev])).toEqual([['LO', 40, false], ['GE', 60, true]]);
    });
});

describe('graph edits', () => {
    it('linkAllowed refuses self, duplicates and cycles', () => {
        const d = graph();
        expect(linkAllowed(d, 'bg', 'bg')).toBe(false);
        expect(linkAllowed(d, 'bg', 'comp')).toBe(false);
        expect(linkAllowed(d, 'comp', 'bg')).toBe(false);
        expect(linkAllowed(d, 'anim', 'bg')).toBe(true);
    });

    it('setAfter / removePhase keep after consistent', () => {
        expect(setAfter(graph(), 'bg', 'comp', false)[0].after).toEqual(['anim']);
        expect(removePhase(graph(), 'anim').map((p) => [p.key, p.after])).toEqual([['comp', ['bg']], ['bg', []]]);
    });

    it('moveBefore reorders within the draft array', () => {
        expect(moveBefore(graph(), 'bg', 'anim', 'anim').map((p) => p.key)).toEqual(['comp', 'bg', 'anim']);
        expect(moveBefore(graph(), 'anim', null, 'bg').map((p) => p.key)).toEqual(['comp', 'bg', 'anim']);
    });
});

describe('draftIssues', () => {
    it('accepts a valid graph', () => {
        expect(draftIssues(graph())).toEqual([]);
    });

    it('flags names, duplicates, codes and per-phase totals', () => {
        expect(phaseNameKey('  Back   Ground ')).toBe('back ground');
        const d = [phase('a'), {...phase('b'), name: ' A '}, {...phase('c'), name: ' '}];
        expect(draftIssues(d)).toEqual(['phaseName', 'phaseNameDup']);
        expect(draftIssues([phase('a', [], [type('X', 50)]), phase('b', [], [type('X', 100)])])).toEqual(['codeDup', 'pctTotal']);
        expect(draftIssues(Array.from({length: 9}, (_, i) => phase(`p${i}`)))).toEqual(['phaseCount']);
    });

    it('locked (edit) mode checks only labels and per-phase totals', () => {
        const d = [{...phase('a', [], [type('X', 50)]), name: ''}, phase('b', [], [type('X', 100)])];
        expect(draftIssues(d, true)).toEqual(['pctTotal']);
    });
});
