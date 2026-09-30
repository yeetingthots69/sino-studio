'use client';

import {useRealtimeRefresh} from './useRealtimeRefresh';

/** Lets server pages subscribe to realtime refreshes for `tables`; renders nothing. */
export default function RealtimeRefresh({tables}: {tables: string[]}) {
    useRealtimeRefresh(tables);
    return null;
}
