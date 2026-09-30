'use client';

import {useRef, useState, type PointerEvent} from 'react';
import {dayIndexFromX} from './dragMath';

/** Day indexes are 0-based within the month; `open` = popover shown (drag finished); `id` = one per draft (form reset). */
export type CreateDraft = {id: number; staffId: string; from: number; to: number; open: boolean};

/**
 * Click / drag on the empty track of a staff row → create draft (plan §3.4 F1).
 * Mouse / pen: pointer capture, the ghost follows the drag. Touch: tap only — no capture, so a swipe
 * stays a horizontal scroll (the browser fires pointercancel and nothing opens).
 */
export function useDragCreate(days: number, dayWidth: number) {
    const [draft, setDraft] = useState<CreateDraft | null>(null);
    const dragRef = useRef<{id: number; staffId: string; anchor: number; left: number; touch: boolean} | null>(null);
    const seqRef = useRef(0);

    const dayAt = (clientX: number, left: number) => dayIndexFromX(clientX - left, dayWidth, days);

    const onPointerDown = (e: PointerEvent<HTMLElement>, staffId: string) => {
        // the track itself only: bars own their pointer events
        if (e.target !== e.currentTarget || e.button !== 0) return;
        const left = e.currentTarget.getBoundingClientRect().left;
        const anchor = dayAt(e.clientX, left);
        const touch = e.pointerType === 'touch';
        const id = ++seqRef.current;
        dragRef.current = {id, staffId, anchor, left, touch};
        if (touch) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDraft({id, staffId, from: anchor, to: anchor, open: false});
    };

    const onPointerMove = (e: PointerEvent<HTMLElement>) => {
        const d = dragRef.current;
        if (!d || d.touch) return;
        const i = dayAt(e.clientX, d.left);
        setDraft({id: d.id, staffId: d.staffId, from: Math.min(d.anchor, i), to: Math.max(d.anchor, i), open: false});
    };

    const onPointerUp = () => {
        const d = dragRef.current;
        if (!d) return;
        dragRef.current = null;
        setDraft((p) => (d.touch || !p ? {id: d.id, staffId: d.staffId, from: d.anchor, to: d.anchor, open: true} : {...p, open: true}));
    };

    // swipe (touch pan) or lost capture before pointerup: no popover
    const onAbort = () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        setDraft((p) => (p?.open ? p : null));
    };

    return {
        draft,
        openAt: (staffId: string, day: number) => setDraft({id: ++seqRef.current, staffId, from: day, to: day, open: true}),
        // only an open draft: a new drag started on a track while the popover was open (its outside-click
        // close runs after that pointerdown) survives
        close: () => setDraft((p) => (p?.open ? null : p)),
        trackHandlers: {onPointerMove, onPointerUp, onPointerCancel: onAbort, onLostPointerCapture: onAbort},
        onPointerDown,
    };
}
