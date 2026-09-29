'use server';

import {cookies, headers} from 'next/headers';
import {redirect} from 'next/navigation';
import createClient from '@/utils/supabase/server';
import {DEFAULT_LOCALE, isValidLocale, type Locale} from '@/i18n/config';
import {refresh} from 'next/cache';
import {z} from 'zod';
import {isAuthRetryableFetchError} from '@supabase/supabase-js';
import {publicTrackerProjectsInsertSchema} from '@/schemas/generated';
import {publicTrackerStaffInsertSchema, publicTrackerWorkTypesInsertSchema} from '@/schemas/generated';
import {publicTrackerTasksInsertSchema} from '@/schemas/generated';
import type {Tables} from '@/types/database.types';

export type ActionResult<T = undefined> = {ok: true; data: T} | {ok: false; error: string};

const NEXT_RE = /^\/(en|vi)\/tracker(\/|\?|$)/;
const ALLOWED_ORIGINS = ['https://sinostudio.vn', 'https://www.sinostudio.vn'];
const LOCALHOST_RE = /^http:\/\/localhost:\d+$/;

async function resolveLocale(formData?: FormData): Promise<Locale> {
    const fromForm = String(formData?.get('locale') ?? '');
    if (isValidLocale(fromForm)) return fromForm;
    const fromCookie = (await cookies()).get('NEXT_LOCALE')?.value ?? '';
    return isValidLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

/* ── Auth ──────────────────────────────────────────────────────── */

export async function signInWithGoogle(formData: FormData): Promise<never> {
    const locale = await resolveLocale(formData);
    const rawNext = String(formData.get('next') ?? '');
    const next = NEXT_RE.test(rawNext) ? rawNext : `/${locale}/tracker`;

    const requestOrigin = (await headers()).get('origin') ?? '';
    const origin = ALLOWED_ORIGINS.includes(requestOrigin) || LOCALHOST_RE.test(requestOrigin)
        ? requestOrigin
        : (process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://sinostudio.vn').replace(/\/$/, '');

    const supabase = await createClient();
    const {data, error} = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
            queryParams: {hd: 'sinostudio.vn', prompt: 'select_account'},
        },
    });
    if (error || !data.url) redirect(`/${locale}/tracker/login?error=auth`);
    redirect(data.url);
}

export async function signOut(formData?: FormData): Promise<never> {
    const locale = await resolveLocale(formData);
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect(`/${locale}/tracker/login`);
}

/* ── Data actions ──────────────────────────────────────────────── */

async function writeRow<S extends z.ZodType, R>(
    input: unknown,
    schema: S,
    run: (
        supabase: Awaited<ReturnType<typeof createClient>>,
        data: z.output<S>,
    ) => PromiseLike<{data: R | null; error: {code: string} | null}>,
    // 'none': the board applies the returned row itself (tasks); 'refresh': re-render the tracker RSC tree
    {revalidate = 'refresh'}: {revalidate?: 'none' | 'refresh'} = {},
): Promise<ActionResult<R>> {
    try {
        const supabase = await createClient();
        // A transient network failure reaching Auth (e.g. connect timeout) is retried once and reported
        // as `network`, not as a sign-out. Real auth errors (no / invalid session) are not retried.
        let auth = await supabase.auth.getUser();
        if (isAuthRetryableFetchError(auth.error)) auth = await supabase.auth.getUser();
        if (isAuthRetryableFetchError(auth.error)) return {ok: false, error: 'network'};
        if (!auth.data.user) return {ok: false, error: 'unauthenticated'};
        const parsed = schema.safeParse(input);
        if (!parsed.success) return {ok: false, error: 'invalid'};
        const {data, error} = await run(supabase, parsed.data);
        if (error?.code === '23505') return {ok: false, error: 'duplicate'};
        if (error?.code === 'PGRST116' || (!error && !data)) return {ok: false, error: 'not_found'};
        if (error || !data) return {ok: false, error: 'generic'};
        if (revalidate === 'refresh') refresh();
        return {ok: true, data};
    } catch {
        return {ok: false, error: 'generic'};
    }
}

const archiveSchema = z.object({id: z.uuid(), archived: z.boolean()});
const archivedAt = (archived: boolean) => (archived ? new Date().toISOString() : null);

/* ── Projects ──────────────────────────────────────────────────── */

type Project = Tables<'tracker_projects'>;

const projectFields = publicTrackerProjectsInsertSchema.pick({name: true, color: true}).extend({
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const updateProjectSchema = projectFields.partial().extend({id: z.uuid()});

export async function createProject(input: {name: string; color: string}): Promise<ActionResult<Project>> {
    return writeRow(input, projectFields, (supabase, d) =>
        supabase.from('tracker_projects').insert(d).select().single());
}

export async function updateProject(input: {id: string; name?: string; color?: string}): Promise<ActionResult<Project>> {
    return writeRow(input, updateProjectSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_projects').update(patch).eq('id', id).select().single());
}

export async function archiveProject(input: {id: string; archived: boolean}): Promise<ActionResult<Project>> {
    return writeRow(input, archiveSchema, (supabase, {id, archived}) =>
        supabase.from('tracker_projects').update({archived_at: archivedAt(archived)}).eq('id', id).select().single());
}

/* ── Staff + Work types ────────────────────────────────────────── */

type Staff = Tables<'tracker_staff'>;
type WorkType = Tables<'tracker_work_types'>;

const staffFields = publicTrackerStaffInsertSchema.pick({name: true, strengths: true, sort_order: true}).extend({
    name: z.string().trim().min(1).max(80),
    strengths: z.string().trim().max(500),
    sort_order: z.number().int().min(0),
});
const updateStaffSchema = staffFields.partial().extend({id: z.uuid()});

export async function createStaff(input: {name: string; strengths: string; sort_order: number}): Promise<ActionResult<Staff>> {
    return writeRow(input, staffFields, (supabase, d) =>
        supabase.from('tracker_staff').insert(d).select().single());
}

export async function updateStaff(
    input: {id: string; name?: string; strengths?: string; sort_order?: number},
): Promise<ActionResult<Staff>> {
    return writeRow(input, updateStaffSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_staff').update(patch).eq('id', id).select().single());
}

export async function archiveStaff(input: {id: string; archived: boolean}): Promise<ActionResult<Staff>> {
    return writeRow(input, archiveSchema, (supabase, {id, archived}) =>
        supabase.from('tracker_staff').update({archived_at: archivedAt(archived)}).eq('id', id).select().single());
}

const workTypeFields = publicTrackerWorkTypesInsertSchema.pick({code: true, label: true, color: true, sort_order: true}).extend({
    code: z.string().trim().min(1).max(20),
    label: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    sort_order: z.number().int().min(0),
});
const updateWorkTypeSchema = workTypeFields.partial().extend({id: z.uuid()});

export async function createWorkType(
    input: {code: string; label: string; color: string; sort_order: number},
): Promise<ActionResult<WorkType>> {
    return writeRow(input, workTypeFields, (supabase, d) =>
        supabase.from('tracker_work_types').insert(d).select().single());
}

export async function updateWorkType(
    input: {id: string; code?: string; label?: string; color?: string; sort_order?: number},
): Promise<ActionResult<WorkType>> {
    return writeRow(input, updateWorkTypeSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_work_types').update(patch).eq('id', id).select().single());
}

export async function archiveWorkType(input: {id: string; archived: boolean}): Promise<ActionResult<WorkType>> {
    return writeRow(input, archiveSchema, (supabase, {id, archived}) =>
        supabase.from('tracker_work_types').update({archived_at: archivedAt(archived)}).eq('id', id).select().single());
}

/* ── Tasks ─────────────────────────────────────────────────────── */

type Task = Tables<'tracker_tasks'>;
const NO_REVALIDATE = {revalidate: 'none'} as const;
type TaskPatch = Partial<Pick<Task, 'name' | 'staff_id' | 'work_type_id' | 'start_date' | 'end_date' | 'progress'>>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const datesOrdered = (d: {start_date?: string; end_date?: string}) =>
    !d.start_date || !d.end_date || d.end_date >= d.start_date;

const taskFields = publicTrackerTasksInsertSchema
    .pick({project_id: true, staff_id: true, work_type_id: true, name: true, start_date: true, end_date: true, progress: true})
    .extend({
        project_id: z.uuid(),
        staff_id: z.uuid(),
        work_type_id: z.uuid(),
        name: z.string().trim().min(1).max(80),
        start_date: isoDate,
        end_date: isoDate,
        progress: z.number().int().min(0).max(100).optional(),
    });
const createTaskSchema = taskFields.refine(datesOrdered);
const updateTaskSchema = taskFields.omit({project_id: true}).partial().extend({id: z.uuid()}).refine(datesOrdered);

export async function createTask(input: {
    project_id: string;
    staff_id: string;
    work_type_id: string;
    name: string;
    start_date: string;
    end_date: string;
    progress?: number;
}): Promise<ActionResult<Task>> {
    return writeRow(input, createTaskSchema, (supabase, d) =>
        supabase.from('tracker_tasks').insert(d).select().single(), NO_REVALIDATE);
}

export async function updateTask(input: {id: string} & TaskPatch): Promise<ActionResult<Task>> {
    return writeRow(input, updateTaskSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_tasks').update(patch).eq('id', id).select().single(), NO_REVALIDATE);
}

export async function deleteTask(input: {id: string}): Promise<ActionResult<{id: string}>> {
    return writeRow(input, z.object({id: z.uuid()}), (supabase, {id}) =>
        supabase.from('tracker_tasks').delete().eq('id', id).select('id').single(), NO_REVALIDATE);
}
