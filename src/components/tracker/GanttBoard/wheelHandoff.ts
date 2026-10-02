'use client';

import {useEffect, type RefObject} from 'react';

export type ScrollMetrics = {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    scrollLeft: number;
    scrollWidth: number;
    clientWidth: number;
    overflowX: string;
    overflowY: string;
    /** The page scroller: scrolls regardless of its computed overflow. */
    isDocument: boolean;
};

const LINE_PX = 16;

/** Wheel deltas in pixels (deltaMode 0 = px, 1 = lines, 2 = pages). */
export function normalizeWheel(e: {deltaX: number; deltaY: number; deltaMode: number}, pageHeight: number): {dx: number; dy: number} {
    const k = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? pageHeight : 1;
    return {dx: e.deltaX * k, dy: e.deltaY * k};
}

// the page scrolls with visible/auto/scroll on <html>; only hidden/clip stop it
const scrollable = (overflow: string, isDocument: boolean) =>
    isDocument ? overflow !== 'hidden' && overflow !== 'clip' : overflow === 'auto' || overflow === 'scroll';

// 1 px slack: fractional scroll positions never quite reach the end
const room = (pos: number, size: number, view: number, d: number) => (d > 0 ? pos + view < size - 1 : d < 0 ? pos > 0 : false);

/** True when the element can still scroll in the wheel's direction on either axis. */
export function canConsume(m: ScrollMetrics, dx: number, dy: number): boolean {
    return (scrollable(m.overflowY, m.isDocument) && room(m.scrollTop, m.scrollHeight, m.clientHeight, dy))
        || (scrollable(m.overflowX, m.isDocument) && room(m.scrollLeft, m.scrollWidth, m.clientWidth, dx));
}

function metricsOf(el: Element): ScrollMetrics {
    const isDocument = el === document.documentElement;
    const box = isDocument ? (document.scrollingElement ?? el) : el;
    const cs = getComputedStyle(el);
    return {
        scrollTop: box.scrollTop,
        scrollHeight: box.scrollHeight,
        clientHeight: box.clientHeight,
        scrollLeft: box.scrollLeft,
        scrollWidth: box.scrollWidth,
        clientWidth: box.clientWidth,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        isDocument,
    };
}

/**
 * Wheel anywhere outside the grid scrolls the grid once nothing under the pointer
 * (an overflowing panel, a dropdown, the page itself) can take the wheel any more.
 */
export function useWheelHandoff(scrollRef: RefObject<HTMLElement | null>, enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;
        const onWheel = (e: WheelEvent) => {
            const grid = scrollRef.current;
            const target = e.target;
            if (!grid || e.ctrlKey || e.defaultPrevented || !(target instanceof Element)) return;
            // any open modal: its overlay sits outside the dialog box, so skip the hand-off entirely
            if (grid.contains(target) || document.querySelector('[aria-modal="true"]')) return;
            const {dx, dy} = normalizeWheel(e, window.innerHeight);
            // portalled dropdowns live under <body>, so the parent walk still reaches the page scroller
            for (let el: Element | null = target; el; el = el.parentElement) {
                if (canConsume(metricsOf(el), dx, dy)) return;
            }
            if (!canConsume(metricsOf(grid), dx, dy)) return;
            grid.scrollBy({left: dx, top: dy});
            e.preventDefault();
        };
        document.addEventListener('wheel', onWheel, {passive: false});
        return () => document.removeEventListener('wheel', onWheel);
    }, [scrollRef, enabled]);
}
