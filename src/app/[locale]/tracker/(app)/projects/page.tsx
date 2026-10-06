import createClient from '@/utils/supabase/server';
import ProjectsTable from '@/components/tracker/ProjectsTable/ProjectsTable';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

export default async function ProjectsPage() {
    const supabase = await createClient();
    const [projects, types, phases] = await Promise.all([
        supabase.from('tracker_projects').select('*').order('created_at', {ascending: false}),
        supabase.from('tracker_work_types').select('*').order('sort_order'),
        supabase.from('tracker_phases').select('id, project_id, name, sort_order, after').order('sort_order'),
    ]);
    // Throw to the error boundary: empty data would show an empty editor for an existing project.
    if (projects.error) throw projects.error;
    if (types.error) throw types.error;
    if (phases.error) throw phases.error;

    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_work_types']}/>
            <ProjectsTable projects={projects.data} workTypes={types.data} phases={phases.data}/>
        </>
    );
}
