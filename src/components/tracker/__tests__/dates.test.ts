import {describe, expect, it} from 'vitest';
import {addDays, assignLanes, clampToMonth, daysBetween, defaultMonth, isValidMonth, monthRange, weekdayLabel} from '../dates';

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
