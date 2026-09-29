'use client';

import {useCallback, useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';

/**
 * Debounces server refreshes (150 ms) and defers them while the user is dragging a bar
 * or has an unsaved name draft; settle() runs the deferred refresh once the user is idle.
 */
export function useRefreshScheduler() {
    const router = useRouter();
    const dragging = useRef(false);
    const panelDirty = useRef(false);
    const pending = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const requestRefresh = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            if (dragging.current || panelDirty.current) {
                pending.current = true;
                return;
            }
            router.refresh();
        }, 150);
    }, [router]);

    const settle = useCallback(() => {
        if (!pending.current || dragging.current || panelDirty.current) return;
        pending.current = false;
        router.refresh();
    }, [router]);

    useEffect(() => () => clearTimeout(timer.current), []);

    return {dragging, panelDirty, requestRefresh, settle};
}
