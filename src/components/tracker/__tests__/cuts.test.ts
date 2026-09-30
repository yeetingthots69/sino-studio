import {describe, expect, it} from 'vitest';
import {compareCutCodes, cutRange, normalizeCutCode} from '../cuts';
import fixture from './cutCodes.fixture.json';

describe('normalizeCutCode', () => {
    it.each(fixture)('SQL parity: $in → $out', ({in: raw, out}) => {
        expect(normalizeCutCode(raw)).toBe(out);
    });

    it('strips ASCII whitespace only (Postgres \\s parity), keeps NBSP', () => {
        expect(normalizeCutCode('c\t0\n1\r\f\v')).toBe('C1');
        expect(normalizeCutCode('C 1')).toBe('C 1');
    });
});

describe('compareCutCodes', () => {
    it('sorts naturally', () => {
        expect(['C10A', 'C2', 'C10', 'C1', 'OP', 'C100'].sort(compareCutCodes)).toEqual(['C1', 'C2', 'C10', 'C10A', 'C100', 'OP']);
    });

    it('is total (equal only for identical codes)', () => {
        expect(compareCutCodes('C1', 'C1')).toBe(0);
        expect(compareCutCodes('C1-02', 'C1-2')).not.toBe(0);
    });
});

describe('cutRange', () => {
    it('builds inclusive ranges', () => {
        expect(cutRange(9, 11)).toEqual(['C9', 'C10', 'C11']);
        expect(cutRange(1, 200)).toHaveLength(200);
    });

    it('rejects invalid ranges', () => {
        expect(() => cutRange(0, 3)).toThrow(RangeError);
        expect(() => cutRange(5, 4)).toThrow(RangeError);
        expect(() => cutRange(1, 201)).toThrow(RangeError);
        expect(() => cutRange(1.5, 3)).toThrow(RangeError);
        expect(cutRange(99999, 99999)).toEqual(['C99999']);
        expect(() => cutRange(99999, 100000)).toThrow(RangeError);
    });
});
