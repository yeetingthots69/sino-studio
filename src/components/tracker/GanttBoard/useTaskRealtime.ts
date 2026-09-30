'use client';

import {useEffect, useRef} from 'react';
import {getBrowserClient} from '@/utils/supabase/client';
import type {Tables} from '@/types/database.types';

export type RowChange<T> = {type: 'upsert'; row: T} | {type: 'delete'; id: string};

interface Handlers {
    onTask: (change: RowChange<Tables<'tracker_tasks'>>) => void;
    onCut: (change: RowChange<Tables<'tracker_cuts'>>) => void;
    /** Debounced server refresh: every SUBSCRIBED after the first (events may have been missed) and unusable payloads. */
    onResync: () => void;
}

/**
 * Streams tracker_tasks and tracker_cuts changes on one channel (the board applies them locally, no RSC refresh).
 * No `filter`: DELETE events cannot be filtered; the board ignores other projects' rows.
 */
export function useTaskRealtime(projectId: string, month: string, handlers: Handlers) {
    // latest callbacks without resubscribing on every render
    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const client = getBrowserClient();
        let cancelled = false;
        let channel: ReturnType<typeof client.channel> | null = null;
        let hadFirstSubscribe = false;

        // default replica identity: DELETE `old` carries only the primary key
        const toChange = <T extends {id: string}>(payload: {eventType: string; new: object; old: object; errors?: unknown[] | null}, required: keyof T): RowChange<T> | null => {
            if (payload.errors?.length) return null;
            if (payload.eventType === 'DELETE') {
                const id = (payload.old as Partial<T>).id;
                return id ? {type: 'delete', id} : null;
            }
            const row = payload.new as Partial<T>;
            return row.id && row[required] ? {type: 'upsert', row: row as T} : null;
        };

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
                    const change = toChange<Tables<'tracker_tasks'>>(payload, 'project_id');
                    if (change) handlersRef.current.onTask(change);
                    else handlersRef.current.onResync();
                })
                .on('postgres_changes', {event: '*', schema: 'public', table: 'tracker_cuts'}, (payload) => {
                    const change = toChange<Tables<'tracker_cuts'>>(payload, 'project_id');
                    if (change) handlersRef.current.onCut(change);
                    else handlersRef.current.onResync();
                })
                .subscribe((status) => {
                    if (status !== 'SUBSCRIBED') return;
                    if (hadFirstSubscribe) handlersRef.current.onResync();
                    hadFirstSubscribe = true;
                });
        })();

        return () => {
            cancelled = true;
            if (channel) void client.removeChannel(channel);
        };
    }, [projectId, month]);
}
