'use client';

import {useCallback, useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';

/**
 * Debounces server refreshes (150 ms) and defers them while the user is dragging a bar
 * or has an unsaved panel draft; settle() runs the deferred refresh once the user is idle.
 * `onRefreshStart` runs right before every router.refresh() (taskSync `refreshStart`);
 * `isBusy` adds a caller-defined deferral condition (the caller calls settle() once it clears).
 */
export function useRefreshScheduler(onRefreshStart?: () => void, isBusy?: () => boolean) {
    const router = useRouter();
    const dragging = useRef(false);
    const panelDirty = useRef(false);
    const pending = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const startRef = useRef(onRefreshStart);
    const busyRef = useRef(isBusy);
    useEffect(() => {
        startRef.current = onRefreshStart;
        busyRef.current = isBusy;
    });
    const busy = useCallback(() => dragging.current || panelDirty.current || !!busyRef.current?.(), []);

    const refreshNow = useCallback(() => {
        startRef.current?.();
        router.refresh();
    }, [router]);

    const requestRefresh = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            if (busy()) {
                pending.current = true;
                return;
            }
            refreshNow();
        }, 150);
    }, [busy, refreshNow]);

    const settle = useCallback(() => {
        if (!pending.current || busy()) return;
        pending.current = false;
        refreshNow();
    }, [busy, refreshNow]);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {dragging, panelDirty, requestRefresh, settle};
}
