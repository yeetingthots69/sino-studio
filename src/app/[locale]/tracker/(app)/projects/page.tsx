import createClient from '@/utils/supabase/server';
import ProjectsTable from '@/components/tracker/ProjectsTable/ProjectsTable';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';

export default async function ProjectsPage() {
    const supabase = await createClient();
    const [projects, types] = await Promise.all([
        supabase.from('tracker_projects').select('*').order('created_at', {ascending: false}),
        // tracker_tasks(count): a type with tasks is locked (no delete, no reorder) in the editor
        supabase.from('tracker_work_types').select('*, tracker_tasks(count)').order('sort_order'),
    ]);
    // Throw to the error boundary: empty data would show an empty editor whose save deletes existing types.
    if (projects.error) throw projects.error;
    if (types.error) throw types.error;
    const workTypes = types.data.map(({tracker_tasks, ...t}) => ({
        ...t,
        used: (tracker_tasks[0]?.count ?? 0) > 0,
    }));

    return (
        <>
            <RealtimeRefresh tables={['tracker_projects', 'tracker_work_types']}/>
            <ProjectsTable projects={projects.data} workTypes={workTypes}/>
        </>
    );
}
