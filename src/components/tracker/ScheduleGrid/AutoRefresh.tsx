'use client';

import {useEffect} from 'react';
import {useRouter} from 'next/navigation';

/** Re-renders the server page every `ms` (a revoked share turns into the 404 on the next refresh). */
export default function AutoRefresh({ms = 60_000}: {ms?: number}) {
    const router = useRouter();
    useEffect(() => {
        const id = setInterval(() => router.refresh(), ms);
        return () => clearInterval(id);
    }, [router, ms]);
    return null;
}
