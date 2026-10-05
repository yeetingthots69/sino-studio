import {notFound} from 'next/navigation';
import {z} from 'zod';
import createClient from '@/utils/supabase/server';
import MembersView from '@/components/tracker/MembersView/MembersView';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';
import {selectAll} from '@/components/tracker/Earnings/keyset';
import {isValidMonth} from '@/components/tracker/dates';

const MEMBER_TABLES = ['tracker_departments', 'tracker_member_departments', 'tracker_staff', 'tracker_staff_strengths', 'tracker_tasks'];

/** A failed query throws (error boundary): a refresh must never deliver an empty snapshot. */
function must<T>({data, error}: {data: T | null; error: unknown}): T {
    if (error) throw error;
    return data as T;
}

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function MembersPage({params, searchParams}: Props) {
    const [{projectId}, {m}] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(projectId).success) notFound();

    const supabase = await createClient();
    const [project, departments, members, staff, strengths, staffStrengths, tasks, projects] = await Promise.all([
        supabase.from('tracker_projects').select('*').eq('id', projectId).is('archived_at', null).maybeSingle().then(must),
        supabase.from('tracker_departments').select('id, name, color, sort_order')
            .eq('project_id', projectId).order('sort_order').order('name').then(must),
        selectAll(() => supabase.from('tracker_member_departments')
            .select('id, project_id, staff_id, department_id').eq('project_id', projectId)),
        supabase.from('tracker_staff').select('id, name, archived_at, sort_order').order('sort_order').order('name').then(must),
        supabase.from('tracker_strengths').select('id, label').order('sort_order').order('label').then(must),
        // composite key, no `id` to page on; one row per staff × strength
        supabase.from('tracker_staff_strengths').select('staff_id, strength_id').then(must),
        selectAll(() => supabase.from('tracker_tasks').select('id, staff_id').eq('project_id', projectId)),
        // copy sources
        supabase.from('tracker_projects').select('id, name').is('archived_at', null).neq('id', projectId)
            .order('created_at', {ascending: false}).then(must),
    ]);
    if (!project) notFound();

    return (
        <>
            <RealtimeRefresh tables={MEMBER_TABLES}/>
            <MembersView
                project={project}
                month={isValidMonth(m) ? m : undefined}
                departments={departments}
                members={members}
                staff={staff}
                strengths={strengths}
                staffStrengths={staffStrengths}
                tasks={tasks}
                projects={projects}
            />
        </>
    );
}
