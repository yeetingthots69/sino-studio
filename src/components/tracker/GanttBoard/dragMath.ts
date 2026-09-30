import {addDays, type ISODate} from '../dates';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

/** Captured at pointerdown from the STORED task dates, never the month-clamped display range. */
export interface DragBaseline {
    start_date: ISODate;
    end_date: ISODate;
}

/** Applies a day delta to the baseline; resizes never go below 1 day (start <= end). */
export function applyDrag(base: DragBaseline, mode: DragMode, deltaDays: number): DragBaseline {
    const start = addDays(base.start_date, deltaDays);
    const end = addDays(base.end_date, deltaDays);
    switch (mode) {
        case 'move':
            return {start_date: start, end_date: end};
        case 'resize-start':
            return {start_date: start < base.end_date ? start : base.end_date, end_date: base.end_date};
        case 'resize-end':
            return {start_date: base.start_date, end_date: end > base.start_date ? end : base.start_date};
    }
}

export function deltaFromPointer(startX: number, currentX: number, dayWidth: number): number {
    return Math.round((currentX - startX) / dayWidth) || 0; // normalize -0
}

/** Day column under a pointer offset inside the track: floor, clamped to 0..days-1. */
export function dayIndexFromX(offsetX: number, dayWidth: number, days: number): number {
    if (days <= 0 || dayWidth <= 0) return 0;
    return Math.min(days - 1, Math.max(0, Math.floor(offsetX / dayWidth)));
}
