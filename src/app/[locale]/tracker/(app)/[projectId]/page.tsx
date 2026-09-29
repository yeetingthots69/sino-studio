import {notFound} from 'next/navigation';
import {z} from 'zod';
import createClient from '@/utils/supabase/server';
import GanttBoard from '@/components/tracker/GanttBoard/GanttBoard';
import {defaultMonth, isValidMonth, monthRange} from '@/components/tracker/dates';

interface Props {
    params: Promise<{locale: string; projectId: string}>;
    searchParams: Promise<{m?: string | string[]}>;
}

export default async function BoardPage({params, searchParams}: Props) {
    const {locale, projectId} = await params;
    const {m: rawMonth} = await searchParams;
    if (!z.uuid().safeParse(projectId).success) notFound();

    const month = isValidMonth(rawMonth) ? rawMonth : defaultMonth();
    const {start, end} = monthRange(month);

    const supabase = await createClient();
    const [{data: project}, {data: workTypes}, {data: allStaff}, {data: tasks}] = await Promise.all([
        supabase.from('tracker_projects').select('*').eq('id', projectId).is('archived_at', null).maybeSingle(),
        // all work types (archived ones still color existing tasks); the board filters active ones for pickers
        supabase.from('tracker_work_types').select('*').order('sort_order').order('code'),
        supabase.from('tracker_staff').select('*').order('sort_order').order('name'),
        supabase
            .from('tracker_tasks')
            .select('*')
            .eq('project_id', projectId)
            .lte('start_date', end)
            .gte('end_date', start),
    ]);
    if (!project) notFound();

    // active staff first, then archived staff that still own a loaded task
    const taskStaffIds = new Set((tasks ?? []).map((t) => t.staff_id));
    const staff = allStaff ?? [];
    const activeStaff = staff.filter((s) => s.archived_at == null);
    const archivedStaff = staff.filter((s) => s.archived_at != null && taskStaffIds.has(s.id));

    return (
        <GanttBoard
            project={project}
            month={month}
            staff={[...activeStaff, ...archivedStaff]}
            workTypes={workTypes ?? []}
            tasks={tasks ?? []}
            locale={locale}
        />
    );
}
