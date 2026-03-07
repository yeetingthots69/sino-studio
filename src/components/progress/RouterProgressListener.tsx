'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { startNavigationProgress, completeNavigationProgress } from '@mantine/nprogress';

/**
 * Listens to App Router navigation changes and drives the Mantine
 * NavigationProgress bar. Must be rendered inside <Suspense> because
 * useSearchParams() requires it in Next.js App Router.
 *
 * Strategy:
 *  - Document-level click listener catches any <a> pointing to a
 *    same-origin path and calls startNavigationProgress().
 *  - useEffect on [pathname, searchParams] fires once the new page
 *    has rendered and calls completeNavigationProgress().
 */
export default function RouterProgressListener() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isFirst = useRef(true);

    // Start the bar on any internal anchor click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            const anchor = (e.target as Element).closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            if (!href) return;

            // Only internal, non-hash, non-external links
            const isInternal =
                href.startsWith('/') &&
                !href.startsWith('//') &&
                !anchor.target &&
                !anchor.hasAttribute('download');

            if (isInternal) {
                startNavigationProgress();
            }
        }

        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Complete the bar once the new route has rendered
    useEffect(() => {
        if (isFirst.current) {
            isFirst.current = false;
            return;
        }
        completeNavigationProgress();
    }, [pathname, searchParams]);

    return null;
}

