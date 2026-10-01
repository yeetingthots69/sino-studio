import createClient from '@/utils/supabase/server';
import {selectAll as all} from './keyset';

/**
 * Everything the earnings list/profile need, for one project or (no id) the whole studio, archived projects included.
 * ponytail: the studio scope loads every project's tasks, cuts, types and adjustments per render and computes with
 * payLines/staffTotals — fine for a few thousand tasks; add a SQL aggregate only if measured slow, never a second pay formula.
 */
export default async function loadEarnings(projectId?: string) {
    const supabase = await createClient();
    const scoped = <Q extends {eq: (col: 'project_id', v: string) => Q}>(q: Q) => (projectId ? q.eq('project_id', projectId) : q);
    const [projects, tasks, cuts, types, adjustments, staff, strengths] = await Promise.all([
        all(() => {
            const q = supabase.from('tracker_projects').select('id, name, archived_at, created_at');
            return projectId ? q.eq('id', projectId) : q;
        }),
        all(() => scoped(supabase.from('tracker_tasks')
            .select('id, project_id, cut_id, work_type_id, staff_id, progress, start_date, end_date'))),
        all(() => scoped(supabase.from('tracker_cuts').select('id, project_id, code, budget, pay_split'))),
        all(() => scoped(supabase.from('tracker_work_types').select('id, project_id, code, label, color, pay_pct'))),
        all(() => scoped(supabase.from('tracker_pay_adjustments')
            .select('id, batch_id, project_id, cut_id, work_type_id, staff_id, amount, reason, created_by, created_at, reverses_id'))),
        all(() => supabase.from('tracker_staff')
            .select('id, name, email, archived_at, sort_order, tracker_staff_strengths(strength_id)')),
        all(() => supabase.from('tracker_strengths').select('id, label, sort_order')),
    ]);
    // Keyset paging orders by id; restore display order here.
    projects.sort((a, b) => a.created_at.localeCompare(b.created_at));
    staff.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
    strengths.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'vi'));
    return {projects, tasks, cuts, types, adjustments, staff, strengths};
}

export type EarningsData = Awaited<ReturnType<typeof loadEarnings>>;
