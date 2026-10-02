import {describe, expect, it} from 'vitest';
import {canConsume, normalizeWheel, type ScrollMetrics} from '../wheelHandoff';

const box = (over: Partial<ScrollMetrics> = {}): ScrollMetrics => ({
    scrollTop: 100, scrollHeight: 1000, clientHeight: 400,
    scrollLeft: 100, scrollWidth: 1000, clientWidth: 400,
    overflowX: 'auto', overflowY: 'auto', isDocument: false,
    ...over,
});

describe('normalizeWheel', () => {
    it('keeps pixels, scales lines and pages', () => {
        expect(normalizeWheel({deltaX: 3, deltaY: -5, deltaMode: 0}, 800)).toEqual({dx: 3, dy: -5});
        expect(normalizeWheel({deltaX: 1, deltaY: 3, deltaMode: 1}, 800)).toEqual({dx: 16, dy: 48});
        expect(normalizeWheel({deltaX: 0, deltaY: -1, deltaMode: 2}, 800)).toEqual({dx: 0, dy: -800});
    });
});

describe('canConsume', () => {
    it('vertical: room in the middle, none past the ends', () => {
        expect(canConsume(box(), 0, 10)).toBe(true);
        expect(canConsume(box(), 0, -10)).toBe(true);
        expect(canConsume(box({scrollTop: 0}), 0, -10)).toBe(false);
        expect(canConsume(box({scrollTop: 600}), 0, 10)).toBe(false);
        expect(canConsume(box({scrollTop: 599.5}), 0, 10)).toBe(false);
        expect(canConsume(box({scrollTop: 0}), 0, 10)).toBe(true);
    });

    it('horizontal: left and right ends', () => {
        expect(canConsume(box({scrollLeft: 0}), -10, 0)).toBe(false);
        expect(canConsume(box({scrollLeft: 0}), 10, 0)).toBe(true);
        expect(canConsume(box({scrollLeft: 600}), 10, 0)).toBe(false);
        expect(canConsume(box({scrollLeft: 600}), -10, 0)).toBe(true);
    });

    it('either axis with room is enough', () => {
        expect(canConsume(box({scrollTop: 600, scrollLeft: 0}), 10, 10)).toBe(true);
        expect(canConsume(box({scrollTop: 600, scrollLeft: 600}), 10, 10)).toBe(false);
    });

    it('overflow hidden/visible is not consumable unless it is the document', () => {
        expect(canConsume(box({overflowY: 'hidden'}), 0, 10)).toBe(false);
        expect(canConsume(box({overflowY: 'visible'}), 0, 10)).toBe(false);
        expect(canConsume(box({overflowY: 'scroll'}), 0, 10)).toBe(true);
        expect(canConsume(box({overflowX: 'hidden'}), 10, 0)).toBe(false);
        expect(canConsume(box({overflowY: 'visible', isDocument: true}), 0, 10)).toBe(true);
        expect(canConsume(box({overflowX: 'hidden', isDocument: true}), 10, 0)).toBe(false);
        expect(canConsume(box({overflowX: 'clip', isDocument: true}), 10, 0)).toBe(false);
        expect(canConsume(box({overflowY: 'hidden', isDocument: true}), 0, 10)).toBe(false);
    });

    it('no content overflow means no room', () => {
        expect(canConsume(box({scrollTop: 0, scrollHeight: 400}), 0, 10)).toBe(false);
        expect(canConsume(box(), 0, 0)).toBe(false);
    });
});
