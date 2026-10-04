// Pure shaping of the public share DTO (no pay, no emails). Loaded by shareData.ts (server-only).
import type {ISODate} from '@/components/tracker/dates';

export type ShareLink = {label: string; url: string};
export type ShareType = {id: string; code: string; label: string; color: string; sort_order: number};
export type ShareCut = {id: string; code: string; links: ShareLink[]};
export type ShareTask = {
    id: string; staff_id: string; cut_id: string; work_type_id: string;
    start_date: ISODate; end_date: ISODate; progress: number; links: ShareLink[]; is_fix: boolean;
};
export type ShareDto = {
    project: {name: string};
    month: string;
    staff: {id: string; name: string}[];
    types: ShareType[];
    cuts: ShareCut[];
    tasks: ShareTask[];
};

export type IcsTask = {
    id: string; cut_code: string; type_code: string; start_date: ISODate; end_date: ISODate;
    links: ShareLink[]; version: number; updated_at: string; is_fix: boolean;
};

/** Suffix of a fix task's label ("C1 · LO · Fix"); empty for a stage task. */
export const fixSuffix = (t: {is_fix: boolean}) => (t.is_fix ? ' · Fix' : '');
/** Background layer drawn over a fix bar (share grid and PNG). */
export const FIX_STRIPE = 'repeating-linear-gradient(45deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 4px, transparent 4px, transparent 8px)';

/** DB row of the ICS member query → IcsTask. */
export const toIcsTask = (t: {
    id: string; start_date: ISODate; end_date: ISODate; links: unknown; version: number; updated_at: string; is_fix: boolean;
    cut: {code: string} | null; type: {code: string} | null;
}): IcsTask => ({
    id: t.id,
    cut_code: t.cut?.code ?? '',
    type_code: t.type?.code ?? '',
    start_date: t.start_date,
    end_date: t.end_date,
    links: sanitizeLinks(t.links),
    version: t.version,
    updated_at: t.updated_at,
    is_fix: t.is_fix,
});

export const icsSummary = (t: IcsTask) => `${t.cut_code} · ${t.type_code}${fixSuffix(t)}`;

/** Keeps only well-formed https links with a non-empty label (capped at 80) from a jsonb `links` column. */
export function sanitizeLinks(raw: unknown): ShareLink[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((l) => {
        const {label, url} = (l ?? {}) as Record<string, unknown>;
        const text = typeof label === 'string' ? label.trim().slice(0, 80) : '';
        return text && typeof url === 'string' && url.startsWith('https://') ? [{label: text, url}] : [];
    });
}

type TaskRow = Omit<ShareTask, 'links'> & {links: unknown};

/** Explicit field picks; cuts and types only when a returned task references them. */
export function shapeShare(input: {
    project: {name: string};
    month: string;
    staff: {id: string; name: string}[];
    types: ShareType[];
    cuts: (Omit<ShareCut, 'links'> & {links: unknown})[];
    tasks: TaskRow[];
}): ShareDto {
    const staffIds = new Set(input.staff.map((s) => s.id));
    const tasks = input.tasks
        .filter((t) => staffIds.has(t.staff_id))
        .map((t) => ({
            id: t.id, staff_id: t.staff_id, cut_id: t.cut_id, work_type_id: t.work_type_id,
            start_date: t.start_date, end_date: t.end_date, progress: t.progress, links: sanitizeLinks(t.links), is_fix: t.is_fix,
        }));
    const cutIds = new Set(tasks.map((t) => t.cut_id));
    const typeIds = new Set(tasks.map((t) => t.work_type_id));
    return {
        project: {name: input.project.name},
        month: input.month,
        staff: input.staff.map(({id, name}) => ({id, name})),
        types: input.types
            .filter((w) => typeIds.has(w.id))
            .map(({id, code, label, color, sort_order}) => ({id, code, label, color, sort_order}))
            .sort((a, b) => a.sort_order - b.sort_order),
        cuts: input.cuts
            .filter((c) => cutIds.has(c.id))
            .map((c) => ({id: c.id, code: c.code, links: sanitizeLinks(c.links)})),
        tasks,
    };
}

/** `dd/mm–dd/mm` */
export const dateRange = (s: ISODate, e: ISODate) =>
    `${s.slice(8, 10)}/${s.slice(5, 7)}–${e.slice(8, 10)}/${e.slice(5, 7)}`;

/** A share row is usable only when not revoked and its project exists and is not archived. */
export function shareScope(row: {
    project_id: string; staff_ids: string[]; revoked_at: string | null;
    project: {name: string; archived_at: string | null} | null;
} | null): {project_id: string; staff_ids: string[]; project: {name: string}} | null {
    if (!row || row.revoked_at || !row.project || row.project.archived_at) return null;
    return {project_id: row.project_id, staff_ids: row.staff_ids, project: {name: row.project.name}};
}
