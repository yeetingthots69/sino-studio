import {createClient} from '@supabase/supabase-js';
import {Database} from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleSecret = process.env.SUPABASE_SECRET_KEY!;

export default function createAdminClient() {
    return createClient<Database>(supabaseUrl, serviceRoleSecret, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
}
