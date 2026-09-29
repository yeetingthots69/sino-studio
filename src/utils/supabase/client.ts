import {createBrowserClient} from '@supabase/ssr';
import {Database} from '@/types/database.types';

/**
 * Creates a Supabase client for use in Client Components (browser).
 * This client automatically handles cookie-based authentication on the client side.
 *
 * @returns A configured Supabase browser client
 *
 * @example
 * ```
 * 'use client'
 * import { createClient } from '@/utils/supabase/client'
 *
 * const supabase = createClient()
 * const { data: { user } } = await supabase.auth.getUser()
 * ```
 *
 * And yes it is not a typo.
 */
export function createClientClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
}

let browserClient: ReturnType<typeof createClientClient> | null = null;

/** Lazily created, module-level browser client shared by realtime subscriptions. */
export function getBrowserClient() {
    return (browserClient ??= createClientClient());
}
