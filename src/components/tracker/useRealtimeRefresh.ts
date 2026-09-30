'use client';

import {useEffect, useRef} from 'react';
import {getBrowserClient} from '@/utils/supabase/client';
import {useRefreshScheduler} from '@/components/tracker/GanttBoard/useRefreshScheduler';

/** Stable subscription key: order and duplicates of the table list do not matter. */
export function tableKey(tables: readonly string[]): string {
    return [...new Set(tables)].sort().join(',');
}

// Module-level busy registry: any component can defer realtime refreshes while its form is dirty.
const busyKeys = new Set<symbol>();
const idleListeners = new Set<() => void>();

export function setRealtimeBusy(key: symbol, busy: boolean) {
    if (busy) {
        busyKeys.add(key);
        return;
    }
    if (!busyKeys.delete(key) || busyKeys.size) return;
    idleListeners.forEach((l) => l());
}

export const isRealtimeBusy = () => busyKeys.size > 0;

/** Opt-in for a dirty form/modal: refreshes from useRealtimeRefresh wait until `busy` is false (or unmount). */
export function useRealtimeBusy(busy: boolean) {
    const key = useRef<symbol>(null);
    useEffect(() => {
        if (!busy) return;
        const k = (key.current ??= Symbol('realtime-busy'));
        setRealtimeBusy(k, true);
        return () => setRealtimeBusy(k, false);
    }, [busy]);
}

/**
 * One realtime channel listening (unfiltered — DELETE can't be filtered) to every table in `tables`;
 * any event calls `onChange`, and so does every reconnect after the first SUBSCRIBED (events may have been missed).
 */
export function useRealtimeTables(tables: readonly string[], onChange: () => void) {
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    const key = tableKey(tables);

    useEffect(() => {
        const client = getBrowserClient();
        let cancelled = false;
        let channel: ReturnType<typeof client.channel> | null = null;
        let hadFirstSubscribe = false;

        void (async () => {
            // authorize the socket before joining (anonymous joins get empty, 401 payloads under RLS)
            const {data: {session}} = await client.auth.getSession();
            await client.realtime.setAuth(session?.access_token ?? null);
            if (cancelled) return;

            // unique topic per mount: realtime-js reuses a same-topic channel still in `leaving` state on fast remounts
            channel = client.channel(`tracker-refresh-${crypto.randomUUID()}`);
            for (const table of key.split(',')) {
                channel.on('postgres_changes', {event: '*', schema: 'public', table}, () => onChangeRef.current());
            }
            channel.subscribe((status) => {
                if (status !== 'SUBSCRIBED') return;
                if (hadFirstSubscribe) onChangeRef.current();
                hadFirstSubscribe = true;
            });
        })();

        return () => {
            cancelled = true;
            if (channel) void client.removeChannel(channel);
        };
    }, [key]);
}

/**
 * Realtime → debounced router.refresh() (useRefreshScheduler semantics). Deferred while `isBusy()` or any
 * useRealtimeBusy(true) component is dirty; the registry settles itself, callers of `isBusy` call the returned settle().
 */
export function useRealtimeRefresh(tables: readonly string[], opts?: {isBusy?: () => boolean; onRefreshStart?: () => void}) {
    const {requestRefresh, settle} = useRefreshScheduler(opts?.onRefreshStart, () => isRealtimeBusy() || !!opts?.isBusy?.());
    useRealtimeTables(tables, requestRefresh);
    useRealtimeIdle(settle);
    return {settle};
}

/** Calls `settle` whenever the busy registry becomes idle (the last useRealtimeBusy(true) clears). */
export function useRealtimeIdle(settle: () => void) {
    useEffect(() => {
        idleListeners.add(settle);
        return () => {
            idleListeners.delete(settle);
        };
    }, [settle]);
}
