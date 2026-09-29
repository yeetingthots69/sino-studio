import createClient from '@/utils/supabase/server';
import ProjectsTable from '@/components/tracker/ProjectsTable/ProjectsTable';

export default async function ProjectsPage() {
    const supabase = await createClient();
    const {data} = await supabase
        .from('tracker_projects')
        .select('*')
        .order('created_at', {ascending: false});

    return <ProjectsTable projects={data ?? []}/>;
}
