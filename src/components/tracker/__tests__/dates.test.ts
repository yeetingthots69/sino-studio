import {describe, expect, it} from 'vitest';
import {addDays, assignLanes, clampToMonth, daysBetween, defaultMonth, isValidMonth, monthRange, parseMonthInput, shiftMonth, weekdayLabel} from '../dates';

describe('dates', () => {
    it('monthRange', () => {
        expect(monthRange('2026-09')).toEqual({start: '2026-09-01', end: '2026-09-30', days: 30});
        expect(monthRange('2028-02').days).toBe(29);
    });

    it('weekdayLabel', () => {
        expect(weekdayLabel('2026-09-01')).toBe('T3');
        expect(weekdayLabel('2026-09-06')).toBe('CN');
        expect(weekdayLabel('2026-09-07')).toBe('T2');
    });

    it('addDays / daysBetween', () => {
        expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
        expect(daysBetween('2026-09-05', '2026-09-01')).toBe(-4);
    });

    it('clampToMonth', () => {
        expect(clampToMonth({start_date: '2026-09-28', end_date: '2026-10-03'}, '2026-09'))
            .toEqual({colStart: 28, colEnd: 30, clippedStart: false, clippedEnd: true});
        expect(clampToMonth({start_date: '2026-08-28', end_date: '2026-09-03'}, '2026-09'))
            .toEqual({colStart: 1, colEnd: 3, clippedStart: true, clippedEnd: false});
    });

    it('assignLanes', () => {
        const t = (s: number, e: number) => ({start_date: `2026-09-0${s}`, end_date: `2026-09-0${e}`});
        const a = t(1, 4), b = t(3, 6), c = t(5, 8);
        const lanes = assignLanes([c, a, b]);
        expect([lanes.get(a), lanes.get(b), lanes.get(c)]).toEqual([0, 1, 0]);
    });

    describe('assignLanes by cut', () => {
        const d = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
        const t = (cut: string | null, s: number, e: number) => ({cut_id: cut, start_date: d(s), end_date: d(e)});

        it('keeps all stages of a cut in one lane, overlapping cut in another', () => {
            const lo = t('A', 1, 3), an = t('A', 4, 8), cl = t('A', 9, 10), b = t('B', 5, 6);
            const lanes = assignLanes([b, cl, lo, an]);
            expect([lanes.get(lo), lanes.get(an), lanes.get(cl)]).toEqual([0, 0, 0]);
            expect(lanes.get(b)).toBe(1);
        });

        it('non-overlapping cuts share lane 0', () => {
            const a1 = t('A', 1, 2), a2 = t('A', 3, 4), b = t('B', 10, 12);
            const lanes = assignLanes([a1, b, a2]);
            expect([lanes.get(a1), lanes.get(a2), lanes.get(b)]).toEqual([0, 0, 0]);
        });

        it('touching blocks share a lane', () => {
            const a = t('A', 1, 5), b = t('B', 6, 8);
            const lanes = assignLanes([b, a]);
            expect([lanes.get(a), lanes.get(b)]).toEqual([0, 0]);
        });

        it('orders ties by block start, end, then cut_id', () => {
            const long = t('A', 1, 9), short = t('B', 1, 3);
            let lanes = assignLanes([long, short]);
            expect([lanes.get(short), lanes.get(long)]).toEqual([0, 1]);
            const z = t('Z', 1, 3), m = t('M', 1, 3);
            lanes = assignLanes([z, m]);
            expect([lanes.get(m), lanes.get(z)]).toEqual([0, 1]);
        });

        it('null cut_id is a single-task block', () => {
            const n1 = t(null, 1, 3), n2 = t(null, 5, 6), n3 = t(null, 2, 4);
            const lanes = assignLanes([n1, n2, n3]);
            expect([lanes.get(n1), lanes.get(n3), lanes.get(n2)]).toEqual([0, 1, 0]);
        });

        it('date-only input yields a valid non-overlapping packing', () => {
            const rows = [[1, 4], [3, 6], [5, 8], [2, 2], [7, 9], [1, 9]].map(([s, e]) => ({start_date: d(s), end_date: d(e)}));
            const lanes = assignLanes(rows);
            expect(lanes.size).toBe(rows.length);
            for (const a of rows) for (const b of rows) {
                if (a !== b && lanes.get(a) === lanes.get(b)) {
                    expect(a.end_date < b.start_date || b.end_date < a.start_date).toBe(true);
                }
            }
        });
    });

    it('parseMonthInput', () => {
        for (const s of ['10/2026', '10-2026', '10 2026', '10.2026', '2026-10', '2026/10', '10/26', 'T10/2026', 'thg 10 2026', 'tháng 10 2026']) {
            expect(parseMonthInput(s), s).toBe('2026-10');
        }
        for (const s of ['13/2026', '0/2026', 'abc', '10/1999', '', '12026']) {
            expect(parseMonthInput(s), s).toBeNull();
        }
    });

    it('parseMonthInput: spaces around separator', () => {
        for (const s of ['10 / 2026', '10 /2026', '10  2026', '2026 - 10']) expect(parseMonthInput(s), s).toBe('2026-10');
        expect(parseMonthInput('1/2026')).toBe('2026-01');
    });

    it('parseMonthInput: decomposed (NFD) input', () => {
        expect(parseMonthInput('tháng 10 2026'.normalize('NFD'))).toBe('2026-10');
    });

    it('shiftMonth', () => {
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    });

    it('isValidMonth / defaultMonth', () => {
        expect(isValidMonth('abc')).toBe(false);
        expect(isValidMonth('2026-13')).toBe(false);
        expect(isValidMonth('2026-09')).toBe(true);
        expect(isValidMonth('1999-12')).toBe(false);
        expect(isValidMonth('2100-01')).toBe(false);
        expect(isValidMonth('2099-12')).toBe(true);
        expect(defaultMonth(new Date('2026-10-01T00:30:00Z'))).toBe('2026-10');
    });
});
