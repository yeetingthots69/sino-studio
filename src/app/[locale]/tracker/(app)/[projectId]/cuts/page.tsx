import {notFound} from 'next/navigation';
import {z} from 'zod';
import createClient from '@/utils/supabase/server';
import CutsView from '@/components/tracker/CutsView/CutsView';
import RealtimeRefresh from '@/components/tracker/RealtimeRefresh';
import {selectAll} from '@/components/tracker/Earnings/keyset';
import {isValidMonth} from '@/components/tracker/dates';

const PAY_TABLES = ['tracker_projects', 'tracker_tasks', 'tracker_cuts', 'tracker_work_types', 'tracker_pay_adjustments', 'tracker_staff', 'tracker_member_departments'];

/** A failed query throws (error boundary): a refresh must never deliver an empty snapshot. */
function must<T>({data, error}: {data: T | null; error: unknown}): T {
    if (error) throw error;
    return data as T;
}

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function CutsPage({params, searchParams}: Props) {
    const [{projectId}, {m}] = await Promise.all([params, searchParams]);
    if (!z.uuid().safeParse(projectId).success) notFound();

    const supabase = await createClient();
    const [project, workTypes, phases, cuts, tasks, staff, adjustments, audit, presets, memberRows, departments] = await Promise.all([
        supabase.from('tracker_projects').select('*').eq('id', projectId).is('archived_at', null).maybeSingle().then(must),
        supabase.from('tracker_work_types').select('*').eq('project_id', projectId).order('sort_order').then(must),
        supabase.from('tracker_phases').select('id, name, sort_order, after').eq('project_id', projectId).order('sort_order').then(must),
        selectAll(() => supabase.from('tracker_cuts').select('*').eq('project_id', projectId)),
        selectAll(() => supabase.from('tracker_tasks')
            .select('id, project_id, cut_id, work_type_id, staff_id, progress, start_date, end_date, is_fix')
            .eq('project_id', projectId)),
        supabase.from('tracker_staff').select('id, name, email, sort_order, archived_at').order('sort_order').order('name').then(must),
        selectAll(() => supabase.from('tracker_pay_adjustments')
            .select('id, batch_id, project_id, cut_id, work_type_id, staff_id, amount, reason, reverses_id, created_by, created_at')
            .eq('project_id', projectId)),
        // latest 200 audit rows of the project's cuts and types (project_id is in both row images)
        supabase.from('tracker_audit_log')
            .select('*')
            .in('table_name', ['tracker_cuts', 'tracker_work_types'])
            .or(`new->>project_id.eq.${projectId},old->>project_id.eq.${projectId}`)
            .order('at', {ascending: false})
            .limit(200)
            .then(must),
        supabase.from('tracker_pay_presets').select('*').order('name').then(must),
        selectAll(() => supabase.from('tracker_member_departments')
            .select('id, project_id, staff_id, department_id')
            .eq('project_id', projectId)),
        supabase.from('tracker_departments').select('id, name, color, sort_order').eq('project_id', projectId).then(must),
    ]);
    if (!project) notFound();

    return (
        <>
            <RealtimeRefresh tables={PAY_TABLES}/>
            <CutsView
                project={project}
                month={isValidMonth(m) ? m : undefined}
                workTypes={workTypes}
                phases={phases}
                cuts={cuts}
                tasks={tasks}
                staff={staff}
                adjustments={adjustments}
                audit={audit}
                presets={presets}
                memberRows={memberRows}
                departments={departments}
            />
        </>
    );
}
