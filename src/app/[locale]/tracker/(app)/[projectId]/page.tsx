import {notFound} from 'next/navigation';
import {z} from 'zod';
import createClient from '@/utils/supabase/server';
import GanttBoard from '@/components/tracker/GanttBoard/GanttBoard';
import ShareModal from '@/components/tracker/ShareModal/ShareModal';
import {defaultMonth, isValidMonth, monthRange} from '@/components/tracker/dates';
import {selectAll} from '@/components/tracker/Earnings/keyset';

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

/** A failed query throws (error boundary): a refresh must never deliver an empty snapshot. */
function must<T>({data, error}: {data: T | null; error: unknown}): T {
    if (error) throw error;
    return data as T;
}

export default async function BoardPage({params, searchParams}: Props) {
    const {locale, projectId} = await params;
    const {m: rawMonth} = await searchParams;
    if (!z.uuid().safeParse(projectId).success) notFound();

    const month = isValidMonth(rawMonth) ? rawMonth : defaultMonth();
    const {start, end} = monthRange(month);

    const supabase = await createClient();
    // growing tables are keyset-paged (PostgREST caps a response at 1000 rows); selectAll throws on error
    const [project, workTypes, allStaff, strengths, staffStrengths, cuts, tasks, stages, shares] = await Promise.all([
        supabase.from('tracker_projects').select('*').eq('id', projectId).is('archived_at', null).maybeSingle().then(must),
        supabase.from('tracker_work_types').select('*').eq('project_id', projectId).order('sort_order').then(must),
        supabase.from('tracker_staff').select('*').order('sort_order').order('name').then(must),
        supabase.from('tracker_strengths').select('*').order('sort_order').order('label').then(must),
        // composite key, no `id` to page on; one row per staff × strength
        supabase.from('tracker_staff_strengths').select('*').then(must),
        selectAll(() => supabase.from('tracker_cuts').select('*').eq('project_id', projectId)),
        // render set: tasks overlapping the month
        selectAll(() => supabase.from('tracker_tasks').select('*').eq('project_id', projectId).lte('start_date', end).gte('end_date', start)),
        // stage index: every task of the project (order pre-checks, one-task-per-stage chips across months)
        selectAll(() => supabase
            .from('tracker_tasks')
            .select('id, cut_id, work_type_id, staff_id, start_date, end_date, version, is_fix')
            .eq('project_id', projectId)),
        // active share links (ShareModal)
        supabase.from('tracker_shares').select('*').eq('project_id', projectId).is('revoked_at', null)
            .order('created_at', {ascending: false}).then(must),
    ]);
    if (!project) notFound();

    // active staff first, then archived staff that still own a loaded task
    const taskStaffIds = new Set(tasks.map((t) => t.staff_id));
    const staff = allStaff;
    const activeStaff = staff.filter((s) => s.archived_at == null);
    const archivedStaff = staff.filter((s) => s.archived_at != null && taskStaffIds.has(s.id));

    return (
        // month navigation remounts the board: task sync state is per project + month
        <GanttBoard
            key={`${projectId}-${month}`}
            project={project}
            month={month}
            locale={locale}
            staff={[...activeStaff, ...archivedStaff]}
            workTypes={workTypes}
            strengths={strengths}
            staffStrengths={staffStrengths}
            cuts={cuts}
            tasks={tasks}
            stages={stages}
            shareSlot={<ShareModal key="share" projectId={projectId} locale={locale} month={month} staff={staff.map(({id, name, email, archived_at}) => ({id, name, email, archived_at}))} shares={shares}/>}
        />
    );
}
