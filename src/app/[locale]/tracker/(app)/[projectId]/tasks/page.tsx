import {notFound} from 'next/navigation';
import {z} from 'zod';
import createClient from '@/utils/supabase/server';
import TaskListView from '@/components/tracker/TaskListView/TaskListView';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';
import {selectAll} from '@/components/tracker/Earnings/keyset';
import {isValidMonth} from '@/components/tracker/dates';

const TABLES = ['tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_staff'];

/** A failed query throws (error boundary): a refresh must never deliver an empty snapshot. */
function must<T>({data, error}: {data: T | null; error: unknown}): T {
    if (error) throw error;
    return data as T;
}

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function TasksPage({params, searchParams}: Props) {
    const [{projectId}, {m}] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(projectId).success) notFound();

    const supabase = await createClient();
    const [project, workTypes, cuts, tasks, staff] = await Promise.all([
        supabase.from('tracker_projects').select('*').eq('id', projectId).is('archived_at', null).maybeSingle().then(must),
        supabase.from('tracker_work_types').select('*').eq('project_id', projectId).order('sort_order').then(must),
        selectAll(() => supabase.from('tracker_cuts').select('id, code').eq('project_id', projectId)),
        selectAll(() => supabase.from('tracker_tasks')
            .select('id, cut_id, work_type_id, staff_id, start_date, end_date, progress, is_fix')
            .eq('project_id', projectId)),
        supabase.from('tracker_staff').select('id, name, archived_at').order('sort_order').order('name').then(must),
    ]);
    if (!project) notFound();

    return (
        <>
            <RealtimeRefresh tables={TABLES}/>
            <TaskListView
                project={project}
                month={isValidMonth(m) ? m : undefined}
                workTypes={workTypes}
                cuts={cuts}
                tasks={tasks}
                staff={staff}
            />
        </>
    );
}
