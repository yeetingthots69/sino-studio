import {describe, expect, it} from 'vitest';
import {applyDrag, createDragLatch, dayIndexFromX, deltaFromPointer, exceedsSlop, targetStaff} from '../dragMath';

const el = (attrs: Record<string, string>) => ({getAttribute: (n: string) => attrs[n] ?? null});

describe('dragMath', () => {
    it('move shifts both dates across a month boundary', () => {
        expect(applyDrag({start_date: '2026-09-28', end_date: '2026-10-03'}, 'move', 2))
            .toEqual({start_date: '2026-09-30', end_date: '2026-10-05'});
    });

    it('resize-end clamps to start (min 1 day)', () => {
        expect(applyDrag({start_date: '2026-09-05', end_date: '2026-09-08'}, 'resize-end', -10))
            .toEqual({start_date: '2026-09-05', end_date: '2026-09-05'});
    });

    it('resize-start clamps to end (min 1 day)', () => {
        expect(applyDrag({start_date: '2026-09-05', end_date: '2026-09-08'}, 'resize-start', 10))
            .toEqual({start_date: '2026-09-08', end_date: '2026-09-08'});
        expect(applyDrag({start_date: '2026-09-05', end_date: '2026-09-08'}, 'resize-start', -2))
            .toEqual({start_date: '2026-09-03', end_date: '2026-09-08'});
    });

    it('deltaFromPointer rounds at half a day', () => {
        expect(deltaFromPointer(100, 119, 40)).toBe(0);
        expect(deltaFromPointer(100, 120, 40)).toBe(1);
        expect(deltaFromPointer(100, 79, 40)).toBe(-1);
        expect(deltaFromPointer(100, 81, 40)).toBe(0);
    });

    it('dayIndexFromX floors and clamps to the month', () => {
        expect(dayIndexFromX(0, 32, 30)).toBe(0);
        expect(dayIndexFromX(31.9, 32, 30)).toBe(0);
        expect(dayIndexFromX(32, 32, 30)).toBe(1);
        expect(dayIndexFromX(-5, 32, 30)).toBe(0);
        expect(dayIndexFromX(32 * 40, 32, 30)).toBe(29);
        expect(dayIndexFromX(100, 0, 30)).toBe(0);
        expect(dayIndexFromX(100, 32, 0)).toBe(0);
    });

    it('exceedsSlop latches at 4 px on either axis', () => {
        expect(exceedsSlop(3, -3)).toBe(false);
        expect(exceedsSlop(4, 0)).toBe(true);
        expect(exceedsSlop(0, -4)).toBe(true);
        expect(exceedsSlop(-3.9, 3.9)).toBe(false);
    });

    it('createDragLatch sets at 4 px, reads once, resets', () => {
        const l = createDragLatch();
        l.track(3, 3);
        expect(l.read()).toBe(false);
        l.track(0, 4);
        l.track(0, 0); // returning to the origin keeps it set
        expect(l.read()).toBe(true);
        expect(l.read()).toBe(false);
        l.track(-5, 0);
        l.reset();
        expect(l.read()).toBe(false);
    });

    it('targetStaff returns the first foreign drop row', () => {
        const own = el({'data-drop': '1', 'data-staff-id': 'a'});
        const other = el({'data-drop': '1', 'data-staff-id': 'b'});
        const archived = el({'data-staff-id': 'c'});
        const bar = el({});
        expect(targetStaff([bar, other], 'a')).toBe('b');
        expect(targetStaff([bar, own], 'a')).toBeNull();
        expect(targetStaff([archived], 'a')).toBeNull();
        expect(targetStaff([archived, other], 'a')).toBe('b');
        expect(targetStaff([el({'data-drop': '1'})], 'a')).toBeNull();
        expect(targetStaff([], 'a')).toBeNull();
    });
});
