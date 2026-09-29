import {describe, expect, it} from 'vitest';
import {applyDrag, deltaFromPointer} from '../dragMath';

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
});
