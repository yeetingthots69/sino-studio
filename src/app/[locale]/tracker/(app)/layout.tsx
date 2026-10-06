import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import createClient from '@/utils/supabase/server';
import NotAuthorized from '@/components/tracker/NotAuthorized';
import TrackerShell from '@/components/tracker/TrackerShell/TrackerShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {robots: {index: false, follow: false}};

interface Props {
    children: React.ReactNode;
    params: Promise<{locale: string}>;
}

export default async function TrackerAppLayout({children, params}: Props) {
    const {locale} = await params;
    const supabase = await createClient();
    const {data: {user}} = await supabase.auth.getUser();
    if (!user?.email) redirect(`/${locale}/tracker/login`);

    const email = user.email.toLowerCase();
    const [{data: trackerUser}, {data: projects}] = await Promise.all([
        supabase.from('tracker_users').select('email, display_name').eq('email', email).maybeSingle(),
        supabase.from('tracker_projects').select('id, name, color').is('archived_at', null).order('created_at', {ascending: false}),
    ]);

    if (!trackerUser) return <NotAuthorized email={email}/>;

    const meta = user.user_metadata as {full_name?: string; avatar_url?: string};
    return (
        <TrackerShell
            user={{name: meta.full_name ?? email, avatarUrl: meta.avatar_url ?? null, email}}
            projects={projects ?? []}
            locale={locale}
        >
            {children}
        </TrackerShell>
    );
}
