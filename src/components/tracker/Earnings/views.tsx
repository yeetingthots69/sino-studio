// Server views for the earnings routes (N2); the route files only unwrap params.
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {defaultMonth} from '../dates';
import {earnings, parseMonthFilter, staffRows, totalsByProject, ZERO_TOTALS} from '../earnings';
import ProjectViewTabs from '../ProjectViewTabs/ProjectViewTabs';
import EarningsTable, {type EarningsRow} from './EarningsTable';
import StaffProfile from './StaffProfile';
import loadEarnings from './loadEarnings';

interface Scope {
    locale: string;
    /** Project scope when set; studio scope (all projects, archived included) otherwise. */
    projectId?: string;
    rawMonth: unknown;
}

// Fixed locale + zone so server and client agree.
const dateFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh'});
const dayMonth = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

async function load({locale, projectId, rawMonth}: Scope) {
    if (projectId !== undefined && !z.uuid().safeParse(projectId).success) notFound();
    const month = parseMonthFilter(rawMonth, projectId ? 'all' : defaultMonth());
    const data = await loadEarnings(projectId);
    const project = projectId ? data.projects[0] : undefined;
    if (projectId && (!project || project.archived_at)) notFound();
    const base = `/${locale}/tracker${projectId ? `/${projectId}` : ''}/people`;
    const tabs = projectId && (
        <ProjectViewTabs projectId={projectId} active="people" month={month === 'all' ? undefined : month}/>
    );
    return {month, data, project, base, tabs, result: earnings(data, month)};
}

export async function EarningsListView(scope: Scope) {
    const {month, data, project, base, tabs, result} = await load(scope);
    const byProject = project ? null : totalsByProject(result.lines, result.adjustments);
    const rows: EarningsRow[] = data.staff.flatMap((s) => {
        const totals = result.totals.get(s.id);
        if (!totals) return [];
        const projects = byProject && data.projects.flatMap((p) => {
            const t = byProject.get(p.id)?.get(s.id);
            return t ? [{id: p.id, name: p.name, archived: p.archived_at != null, total: t.total}] : [];
        });
        return [{id: s.id, name: s.name, archived: s.archived_at != null, totals, ...(projects && {projects})}];
    });
    return <EarningsTable rows={rows} month={month} hrefBase={base} projectName={project?.name} tabs={tabs}/>;
}

export async function StaffProfileView({staffId, ...scope}: Scope & {staffId: string}) {
    if (!z.uuid().safeParse(staffId).success) notFound();
    const {month, data, project, base, tabs, result} = await load(scope);
    const staff = data.staff.find((s) => s.id === staffId);
    // Project scope: only staff with a task or adjustment in the project (any month).
    const involved = !project || data.tasks.some((t) => t.staff_id === staffId)
        || data.adjustments.some((a) => a.staff_id === staffId);
    if (!staff || !involved) notFound();

    const byId = <T extends {id: string}>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
    const tasks = byId(data.tasks);
    const cuts = byId(data.cuts);
    const types = byId(data.types);
    const projects = byId(data.projects);
    const strengths = byId(data.strengths);
    const batchSize = new Map<string, number>();
    for (const a of data.adjustments) batchSize.set(a.batch_id, (batchSize.get(a.batch_id) ?? 0) + 1);
    const reversedIds = new Set(data.adjustments.flatMap((a) => (a.reverses_id ? [a.reverses_id] : [])));
    const rows = staffRows(result, staffId);

    return (
        <StaffProfile
            staff={{
                name: staff.name,
                email: staff.email,
                strengths: staff.tracker_staff_strengths.flatMap((x) => strengths.get(x.strength_id)?.label ?? []),
            }}
            totals={result.totals.get(staffId) ?? ZERO_TOTALS}
            stages={rows.lines.map((l) => {
                const task = tasks.get(l.task_id)!;
                const type = types.get(l.work_type_id)!;
                const p = project ? undefined : projects.get(l.project_id);
                return {
                    id: l.task_id,
                    ...(p && {project: {name: p.name, archived: p.archived_at != null}}),
                    cut: cuts.get(l.cut_id)?.code ?? '',
                    type: {label: `${type.code} · ${type.label}`, color: type.color},
                    dates: `${dayMonth(String(task.start_date))}–${dayMonth(l.end_date)}`,
                    earned: l.earned,
                    amount: l.amount,
                };
            })}
            adjustments={rows.adjustments.map((a) => ({
                id: a.id,
                amount: a.amount,
                reason: a.reason,
                author: a.created_by,
                date: dateFmt.format(new Date(a.created_at)),
                batch: (batchSize.get(a.batch_id) ?? 0) > 1,
                reversal: a.reverses_id != null,
                reversed: reversedIds.has(a.id),
            }))}
            month={month}
            backHref={base}
            tabs={tabs}
        />
    );
}
