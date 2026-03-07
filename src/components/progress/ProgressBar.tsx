'use client';

import { Suspense } from 'react';
import { NavigationProgress } from '@mantine/nprogress';
import '@mantine/nprogress/styles.css';
import RouterProgressListener from './RouterProgressListener';

/**
 * Drop this once into the root layout (inside MantineProvider).
 * It renders the progress bar and wires it to App Router navigation.
 */
export default function ProgressBar() {
    return (
        <>
            <NavigationProgress color="var(--color-red)" size={3} />
            <Suspense fallback={null}>
                <RouterProgressListener />
            </Suspense>
        </>
    );
}

