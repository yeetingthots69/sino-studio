import {redirect} from 'next/navigation';
import createClient from '@/utils/supabase/server';

export default async function TrackerPage({params}: {params: Promise<{locale: string}>}) {
    const {locale} = await params;
    const supabase = await createClient();
    const {data} = await supabase
        .from('tracker_projects')
        .select('id')
        .is('archived_at', null)
        .order('created_at', {ascending: false})
        .limit(1)
        .maybeSingle();

    redirect(data ? `/${locale}/tracker/${data.id}` : `/${locale}/tracker/projects`);
}
