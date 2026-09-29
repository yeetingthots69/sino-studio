'use client';

import {useEffect, useRef} from 'react';
import {getBrowserClient} from '@/utils/supabase/client';
import type {Tables} from '@/types/database.types';
import type {RealtimeChange} from './realtimeReducer';

type Task = Tables<'tracker_tasks'>;

/**
 * Streams tracker_tasks changes to `onChange` (the board applies them locally, no RSC refresh).
 * No `filter`: DELETE events cannot be filtered; the board ignores other projects' rows.
 * `onResync` (a debounced server refresh) runs on every SUBSCRIBED after the first (events may have
 * been missed) and whenever a payload is unusable (auth error / empty record).
 */
export function useTaskRealtime(
    projectId: string,
    month: string,
    onChange: (change: RealtimeChange) => void,
    onResync: () => void,
) {
    // latest callbacks without resubscribing on every render
    const handlers = useRef({onChange, onResync});
    useEffect(() => {
        handlers.current = {onChange, onResync};
    });

    useEffect(() => {
        const client = getBrowserClient();
        let cancelled = false;
        let channel: ReturnType<typeof client.channel> | null = null;
        let hadFirstSubscribe = false;

        void (async () => {
            // Authorize the socket with the user JWT before joining: an anonymous join gets `record: {}`
            // and "401 Unauthorized" in every payload (RLS). supabase-js re-sets it on later auth events.
            const {data: {session}} = await client.auth.getSession();
            await client.realtime.setAuth(session?.access_token ?? null);
            if (cancelled) return;

            // unique topic per mount: realtime-js reuses a same-topic channel still in `leaving` state on fast remounts
            channel = client
                .channel(`tracker-tasks-${projectId}-${month}-${crypto.randomUUID()}`)
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tracker_tasks'}, (payload) => {
                    const {onChange: apply, onResync: resync} = handlers.current;
                    if (payload.errors?.length) return resync();
                    if (payload.eventType === 'DELETE') {
                        // default replica identity: `old` carries only the primary key
                        const id = (payload.old as Partial<Task>).id;
                        return id ? apply({type: 'DELETE', oldId: id}) : resync();
                    }
                    const row = payload.new as Partial<Task>;
                    if (!row.id || !row.project_id) return resync();
                    apply({type: payload.eventType, newRow: row as Task});
                })
                .subscribe((status) => {
                    if (status !== 'SUBSCRIBED') return;
                    if (hadFirstSubscribe) handlers.current.onResync();
                    hadFirstSubscribe = true;
                });
        })();

        return () => {
            cancelled = true;
            if (channel) void client.removeChannel(channel);
        };
    }, [projectId, month]);
}
