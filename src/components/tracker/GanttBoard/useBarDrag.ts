'use client';

import {useEffect, useRef, useState, type PointerEvent, type RefObject} from 'react';
import type {ISODate} from '../dates';
import {applyDrag, createDragLatch, deltaFromPointer, targetStaff, type DragBaseline, type DragMode} from './dragMath';
import type {Task} from './GanttBoard';

export interface MoveTarget {
    staff_id: string;
    start_date: ISODate;
    end_date: ISODate;
}

interface Options {
    task: Task;
    /** The bar's own row (`task.staff_id`); never a drop target. */
    staffId: string;
    /** Current day column width in px; read at each pointermove. */
    dayWidth: number;
    draggingRef: RefObject<boolean>;
    settle: () => void;
    /** `baseline` = the task's confirmed version at pointerdown (taskSync). */
    onCommit: (patch: DragBaseline, baseline: number) => void;
    /** Drop on another staff row (move mode only); replaces `onCommit` for that gesture. Absent = no vertical move. */
    onMove?: (target: MoveTarget, baseline: number) => void;
    /** Targeted foreign row changed (null when none / drag ended). */
    onDropTarget?: (staffId: string | null) => void;
    /** Dragged task id, null when the drag ends (board presence `editing`); must be stable. */
    onDrag?: (id: string | null) => void;
}

interface DragState {
    mode: DragMode;
    base: DragBaseline;
    version: number;
    startX: number;
    startY: number;
    delta: number;
    drop: string | null;
}

/**
 * Pointer drag for a task bar. Handles carry `data-edge="resize-start|resize-end"`; anything else moves.
 * The commit is the day delta applied to the stored dates captured at pointerdown.
 * A move released over another staff row (`data-drop="1"` + `data-staff-id`) goes to `onMove` instead.
 */
export function useBarDrag({task, staffId, dayWidth, draggingRef, settle, onCommit, onMove, onDropTarget, onDrag}: Options) {
    const [preview, setPreview] = useState<DragBaseline | null>(null);
    const [dropStaffId, setDropStaffId] = useState<string | null>(null);
    const [dy, setDy] = useState(0);
    const drag = useRef<DragState | null>(null);
    // ≥ DRAG_SLOP px travelled in the current/last gesture; read-and-reset by wasDrag()
    const [latch] = useState(createDragLatch);
    // latest callbacks: inline lambdas from the board must not re-run the unmount cleanup mid-drag
    const onMoveRef = useRef(onMove);
    const onDropTargetRef = useRef(onDropTarget);
    useEffect(() => {
        onMoveRef.current = onMove;
        onDropTargetRef.current = onDropTarget;
    });

    // unmounted mid-drag (task deleted / left the month): release the busy flag
    useEffect(() => () => {
        if (drag.current) {
            if (drag.current.drop) onDropTargetRef.current?.(null);
            draggingRef.current = false;
            onDrag?.(null);
            settle();
        }
    }, [draggingRef, settle, onDrag]);

    const end = (hadDrop: boolean) => {
        drag.current = null;
        setPreview(null);
        setDropStaffId(null);
        setDy(0);
        if (hadDrop) onDropTargetRef.current?.(null);
        draggingRef.current = false;
        onDrag?.(null);
        settle();
    };

    const onPointerDown = (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        latch.reset();
        const edge = (e.target as HTMLElement).dataset.edge as DragMode | undefined;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = {
            mode: edge ?? 'move',
            base: {start_date: task.start_date, end_date: task.end_date},
            version: task.version,
            startX: e.clientX,
            startY: e.clientY,
            delta: 0,
            drop: null,
        };
        draggingRef.current = true;
        onDrag?.(task.id);
    };

    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
        const d = drag.current;
        if (!d) return;
        const offY = e.clientY - d.startY;
        latch.track(e.clientX - d.startX, offY);
        if (d.mode === 'move' && onMoveRef.current) {
            const drop = targetStaff(document.elementsFromPoint(e.clientX, e.clientY), staffId);
            if (drop !== d.drop) {
                d.drop = drop;
                setDropStaffId(drop);
                onDropTargetRef.current?.(drop);
            }
            setDy(drop ? offY : 0);
        }
        const delta = deltaFromPointer(d.startX, e.clientX, dayWidth);
        if (delta === d.delta) return;
        d.delta = delta;
        setPreview(delta === 0 ? null : applyDrag(d.base, d.mode, delta));
    };

    const onPointerUp = () => {
        const d = drag.current;
        if (!d) return;
        // cleared before capture is released so the lostpointercapture that follows is a no-op
        drag.current = null;
        if (d.drop) onMoveRef.current?.({staff_id: d.drop, ...applyDrag(d.base, d.mode, d.delta)}, d.version);
        else if (d.delta !== 0) onCommit(applyDrag(d.base, d.mode, d.delta), d.version);
        end(d.drop !== null);
    };

    // pointercancel / lostpointercapture before pointerup: abort, no commit
    const onAbort = () => {
        const d = drag.current;
        if (!d) return;
        latch.reset(); // a cancelled drag must not swallow the next keyboard click
        end(d.drop !== null);
    };

    /** True once after a gesture that travelled ≥ 4 px on either axis (suppresses the trailing click). */
    const wasDrag = () => latch.read();

    return {
        preview,
        dropStaffId,
        dy,
        wasDrag,
        handlers: {onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onAbort, onLostPointerCapture: onAbort},
    };
}
