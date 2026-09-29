import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {Database} from '@/types/database.types';

/**
 * Creates a Supabase client for use in Server Components, Server Actions, and Route Handlers.
 * This client automatically handles cookie-based authentication.
 *
 * @returns A configured Supabase server client
 *
 * @example
 * // In a Server Component
 * const supabase = await createClient()
 * const { data: { user } } = await supabase.auth.getUser()
 *
 * @example
 * // In a Server Action
 * 'use server'
 * async function myAction() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('table').select()
 * }
 */
export default async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({name, value, options}) => cookieStore.set(name, value, options));
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have proxy refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}
