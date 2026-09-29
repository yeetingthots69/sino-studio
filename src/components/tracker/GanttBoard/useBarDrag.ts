'use client';

import {useEffect, useRef, useState, type PointerEvent, type RefObject} from 'react';
import {applyDrag, deltaFromPointer, type DragBaseline, type DragMode} from './dragMath';
import {DAY_W, type Task} from './GanttBoard';

interface Options {
    task: Task;
    draggingRef: RefObject<boolean>;
    settle: () => void;
    onCommit: (patch: DragBaseline) => void;
}

/**
 * Pointer drag for a task bar. Handles carry `data-edge="resize-start|resize-end"`; anything else moves.
 * The commit is the day delta applied to the stored dates captured at pointerdown.
 */
export function useBarDrag({task, draggingRef, settle, onCommit}: Options) {
    const [preview, setPreview] = useState<DragBaseline | null>(null);
    const drag = useRef<{mode: DragMode; base: DragBaseline; startX: number; delta: number} | null>(null);

    // the bar can remount mid-drag (tmp- id swapped for the real one): release the busy flag
    useEffect(() => () => {
        if (drag.current) {
            draggingRef.current = false;
            settle();
        }
    }, [draggingRef, settle]);

    const end = () => {
        drag.current = null;
        setPreview(null);
        draggingRef.current = false;
        settle();
    };

    const onPointerDown = (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        const edge = (e.target as HTMLElement).dataset.edge as DragMode | undefined;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
            mode: edge ?? 'move',
            base: {start_date: task.start_date, end_date: task.end_date},
            startX: e.clientX,
            delta: 0,
        };
        draggingRef.current = true;
    };

    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
        const d = drag.current;
        if (!d) return;
        const delta = deltaFromPointer(d.startX, e.clientX, DAY_W);
        if (delta === d.delta) return;
        d.delta = delta;
        setPreview(delta === 0 ? null : applyDrag(d.base, d.mode, delta));
    };

    const onPointerUp = () => {
        const d = drag.current;
        if (!d) return;
        // cleared before capture is released so the lostpointercapture that follows is a no-op
        drag.current = null;
        if (d.delta !== 0) onCommit(applyDrag(d.base, d.mode, d.delta));
        end();
    };

    // pointercancel / lostpointercapture before pointerup: abort, no commit
    const onAbort = () => {
        if (drag.current) end();
    };

    return {
        preview,
        handlers: {onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onAbort, onLostPointerCapture: onAbort},
    };
}
