import 'server-only';
import createAdminClient from '@/utils/supabase/admin';
import {monthRange} from '@/components/tracker/dates';
import {sanitizeLinks, shapeShare, shareScope, type IcsTask, type ShareDto} from './shareShape';

// Public share reads (service role). Scope comes only from the share row; explicit column lists;
// never budget, pay_pct, email, adjustments or staff outside `staff_ids`. Tokens are never logged.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function must<T>(res: {data: T; error: unknown}): T {
    if (res.error) throw new Error('share query failed');
    return res.data;
}
const list = <T,>(res: {data: T[] | null; error: unknown}): T[] => must(res) ?? [];

async function activeShare(token: string) {
    if (!TOKEN_RE.test(token)) return null;
    const db = createAdminClient();
    const row = must(await db.from('tracker_shares')
        .select('project_id, staff_ids, revoked_at, project:tracker_projects(name, archived_at)')
        .eq('token', token).maybeSingle());
    // revoked share or archived project → null (page, ICS and PNG all 404)
    const share = shareScope(row);
    return share ? {db, share} : null;
}

export async function loadShare(token: string, month: string): Promise<ShareDto | null> {
    const s = await activeShare(token);
    if (!s) return null;
    const {db, share: {project_id, staff_ids, project}} = s;
    const {start, end} = monthRange(month);
    const [staff, tasks] = await Promise.all([
        db.from('tracker_staff').select('id, name').in('id', staff_ids).order('sort_order').order('name').then(list),
        db.from('tracker_tasks')
            .select('id, staff_id, cut_id, work_type_id, start_date, end_date, progress, links')
            .eq('project_id', project_id).in('staff_id', staff_ids)
            .lte('start_date', end).gte('end_date', start)
            .order('start_date').then(list),
    ]);
    const cutIds = [...new Set(tasks.map((t) => t.cut_id))];
    const typeIds = [...new Set(tasks.map((t) => t.work_type_id))];
    const [cuts, types] = await Promise.all([
        cutIds.length
            ? db.from('tracker_cuts').select('id, code, links').eq('project_id', project_id).in('id', cutIds).then(list)
            : [],
        typeIds.length
            ? db.from('tracker_work_types').select('id, code, label, color, sort_order')
                .eq('project_id', project_id).in('id', typeIds).then(list)
            : [],
    ]);
    return shapeShare({project, month, staff, types, cuts, tasks});
}

export async function loadShareMember(token: string, staffId: string): Promise<{
    project: {name: string}; staff: {name: string}; tasks: IcsTask[];
} | null> {
    if (!UUID_RE.test(staffId)) return null;
    const s = await activeShare(token);
    if (!s || !s.share.staff_ids.includes(staffId)) return null;
    const {db, share: {project_id, project}} = s;
    const [staff, tasks] = await Promise.all([
        db.from('tracker_staff').select('name').eq('id', staffId).maybeSingle().then(must),
        db.from('tracker_tasks')
            .select('id, start_date, end_date, links, version, updated_at, cut:tracker_cuts!tracker_tasks_cut_fk(code), type:tracker_work_types!tracker_tasks_type_fk(code)')
            .eq('project_id', project_id).eq('staff_id', staffId)
            .order('start_date').then(list),
    ]);
    if (!staff) return null;
    return {
        project,
        staff,
        tasks: tasks.map((t) => ({
            id: t.id,
            cut_code: t.cut?.code ?? '',
            type_code: t.type?.code ?? '',
            start_date: t.start_date,
            end_date: t.end_date,
            links: sanitizeLinks(t.links),
            version: t.version,
            updated_at: t.updated_at,
        })),
    };
}
