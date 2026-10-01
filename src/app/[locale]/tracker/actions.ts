'use server';

import {cookies, headers} from 'next/headers';
import {redirect} from 'next/navigation';
import createClient from '@/utils/supabase/server';
import {DEFAULT_LOCALE, isValidLocale, type Locale} from '@/i18n/config';
import {refresh} from 'next/cache';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {isAuthRetryableFetchError, type User} from '@supabase/supabase-js';
import {
    publicTrackerCutsInsertSchema,
    publicTrackerProjectsInsertSchema,
    publicTrackerStaffInsertSchema,
    publicTrackerStrengthsInsertSchema,
} from '@/schemas/generated';
import type {Tables, TablesInsert} from '@/types/database.types';
import {mapDbError, retryDeadlock, type DbError, type FkError, type TrackerError} from '@/components/tracker/errors';
import {DEFAULT_WORK_TYPES} from '@/components/tracker/defaults';
import {cutRange, normalizeCutCode} from '@/components/tracker/cuts';
import {isValidMonth, monthRange} from '@/components/tracker/dates';
import {sanitizeLinks} from '@/components/tracker/links';
import {resourcesMail, scheduleMail, type Mail} from '@/components/tracker/emails/TrackerEmails';
import {deliver, mailFrom, render, sleep, type MailPayload} from '@/services/trackerMail';
import {payloadOk, SEND_GAP_MS} from '@/lib/tracker/mailPlan';
import {SITE_URL} from '@/lib/seo';

type Task = Tables<'tracker_tasks'>;

export type ActionResult<T = undefined> =
    | {ok: true; data: T}
    | {ok: false; error: TrackerError; detail?: string}
    | {ok: false; error: 'conflict'; fresh: Task};

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

type Supabase = Awaited<ReturnType<typeof createClient>>;
// `fresh`: a versioned write matched no row but the row exists → optimistic-concurrency conflict.
// `partial`: `data` was written but a follow-up step failed with `error` (UI shows the row plus the error).
type RunResult<R> = {data: R | null; error: DbError | null; fresh?: Task; partial?: string};
type WriteOptions = {
    // 'none': the board applies the returned row itself (tasks); 'refresh': re-render the tracker RSC tree
    revalidate?: 'none' | 'refresh';
    // 23503 meaning: 'invalid' for inserts/updates (unknown ids), 'in_use' for deletes (row still referenced)
    fk?: FkError;
    // false: the run retries its own first write (multi-step runs whose later steps must not repeat it)
    retry?: boolean;
};
const NO_REVALIDATE = {revalidate: 'none'} as const;

async function writeRow<S extends z.ZodType, R>(
    input: unknown,
    schema: S,
    run: (supabase: Supabase, data: z.output<S>, user: User) => PromiseLike<RunResult<R>>,
    {revalidate = 'refresh', fk = 'invalid', retry = true}: WriteOptions = {},
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
        const user = auth.data.user;
        const go = () => run(supabase, parsed.data, user);
        const {data, error, fresh, partial} = await (retry ? retryDeadlock(go) : go());
        if (error && data && partial) {
            if (revalidate === 'refresh') refresh();
            return {ok: false, error: mapDbError(error, fk).error, detail: partial};
        }
        if (error) return {ok: false, ...mapDbError(error, fk)};
        if (fresh) return {ok: false, error: 'conflict', fresh};
        if (!data) return {ok: false, error: 'not_found'};
        if (revalidate === 'refresh') refresh();
        return {ok: true, data};
    } catch {
        return {ok: false, error: 'generic'};
    }
}

// Versioned task write: `mutate` filters on (id, version); no row → reselect to tell conflict from not_found.
function writeVersioned<S extends z.ZodType<{id: string}>, R>(
    input: unknown,
    schema: S,
    mutate: (supabase: Supabase, data: z.output<S>) => PromiseLike<RunResult<R>>,
    {fk}: Pick<WriteOptions, 'fk'> = {},
): Promise<ActionResult<R>> {
    return writeRow(input, schema, async (supabase, d) => {
        const res = await mutate(supabase, d);
        if (res.error || res.data) return res;
        const {data: fresh, error} = await supabase.from('tracker_tasks').select().eq('id', d.id).maybeSingle();
        return {data: null, error, fresh: fresh ?? undefined};
    }, {...NO_REVALIDATE, fk});
}

const idSchema = z.object({id: z.uuid()});
const archiveSchema = z.object({id: z.uuid(), archived: z.boolean()});
const archivedAt = (archived: boolean) => (archived ? new Date().toISOString() : null);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const money = z.number().int().min(0).max(1e10);
const links = z.array(z.object({
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().startsWith('https://').pipe(z.url({protocol: /^https$/})),
})).max(20);
// Update patches must change at least one field.
const nonEmpty = (p: object) => Object.values(p).some((v) => v !== undefined);
const nonEmptyPatch = (d: object) => Object.entries(d).some(([k, v]) => k !== 'id' && v !== undefined);
// Printable ASCII only: JS/Postgres case + whitespace normalisation parity holds only for ASCII.
const cutCodeInput = z.string().regex(/^[\x20-\x7E]+$/).trim().min(1).max(20);

export type Link = z.output<typeof links>[number];

/* ── Projects ──────────────────────────────────────────────────── */

type Project = Tables<'tracker_projects'>;

const projectFields = publicTrackerProjectsInsertSchema.pick({name: true, color: true}).extend({
    name: z.string().trim().min(1).max(80),
    color: hexColor,
});
const updateProjectSchema = projectFields.extend({links}).partial().extend({id: z.uuid()})
    .refine(nonEmptyPatch);

export async function createProject(input: {name: string; color: string}): Promise<ActionResult<Project>> {
    return writeRow(input, projectFields, (supabase, d) =>
        supabase.rpc('tracker_create_project', {p_name: d.name, p_color: d.color, p_types: DEFAULT_WORK_TYPES}));
}

export async function updateProject(
    input: {id: string; name?: string; color?: string; links?: Link[]},
): Promise<ActionResult<Project>> {
    return writeRow(input, updateProjectSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_projects').update(patch).eq('id', id).select().single());
}

export async function archiveProject(input: {id: string; archived: boolean}): Promise<ActionResult<Project>> {
    return writeRow(input, archiveSchema, (supabase, {id, archived}) =>
        supabase.from('tracker_projects').update({archived_at: archivedAt(archived)}).eq('id', id).select().single());
}

/* ── Work types (per project, saved as a whole list) ───────────── */

type WorkType = Tables<'tracker_work_types'>;

const hundredths = (p: number) => Math.round(p * 100);
const unique = (xs: unknown[]) => new Set(xs).size === xs.length;
const payPct = z.number().min(0).max(100).refine((p) => Math.abs(p * 100 - hundredths(p)) < 1e-6);
const pctSum = (pcts: number[]) => pcts.reduce((sum, p) => sum + hundredths(p), 0) === 10000;

const saveWorkTypesSchema = z.object({
    project_id: z.uuid(),
    types: z.array(z.object({
        id: z.uuid().optional(),
        code: z.string().trim().min(1).max(20),
        label: z.string().trim().min(1).max(80),
        color: hexColor,
        pay_pct: payPct,
        sort_order: z.number().int(),
    })).min(1),
}).refine(({types}) =>
    pctSum(types.map((t) => t.pay_pct))
    && unique(types.map((t) => t.code))
    && unique(types.map((t) => t.sort_order))
    && unique(types.flatMap((t) => (t.id ? [t.id] : []))));

export async function saveWorkTypes(input: {
    project_id: string;
    types: {id?: string; code: string; label: string; color: string; pay_pct: number; sort_order: number}[];
}): Promise<ActionResult<WorkType[]>> {
    return writeRow(input, saveWorkTypesSchema, async (supabase, d) => {
        // The RPC silently skips ids of other projects; refuse them instead (23514 → 'invalid').
        const current = await supabase.from('tracker_work_types').select('id').eq('project_id', d.project_id);
        if (current.error) return {data: null, error: current.error};
        const known = new Set(current.data.map((t) => t.id));
        if (d.types.some((t) => t.id && !known.has(t.id))) return {data: null, error: {code: '23514'}};
        return supabase.rpc('tracker_save_work_types', {p_project: d.project_id, p_types: d.types});
    });
}

/* ── Staff + strengths ─────────────────────────────────────────── */

type Staff = Tables<'tracker_staff'>;
type Strength = Tables<'tracker_strengths'>;

const email = z.string().trim().toLowerCase().transform((s) => s || null).pipe(z.email().nullable()).nullable();
const staffFields = publicTrackerStaffInsertSchema.pick({name: true, sort_order: true, email: true}).extend({
    name: z.string().trim().min(1).max(80),
    sort_order: z.number().int().min(0),
    email: email.optional(),
    strength_ids: z.array(z.uuid()).max(100),
});
const updateStaffSchema = staffFields.partial().extend({id: z.uuid()})
    .refine(nonEmptyPatch);

// Make the staff member's strengths exactly `ids`: delete missing, insert new (idempotent).
async function syncStrengths(supabase: Supabase, staffId: string, ids: string[]): Promise<DbError | null> {
    let del = supabase.from('tracker_staff_strengths').delete().eq('staff_id', staffId);
    if (ids.length) del = del.not('strength_id', 'in', `(${ids.join(',')})`);
    const {error} = await del;
    if (error || !ids.length) return error;
    const rows = ids.map((strength_id) => ({staff_id: staffId, strength_id}));
    return (await supabase.from('tracker_staff_strengths').upsert(rows, {ignoreDuplicates: true})).error;
}

type StaffInput = {name: string; sort_order: number; email?: string | null; strength_ids: string[]};

export async function createStaff(input: StaffInput): Promise<ActionResult<Staff>> {
    return writeRow(input, staffFields, async (supabase, {strength_ids, ...row}) => {
        const res = await retryDeadlock(() => supabase.from('tracker_staff').insert(row).select().single());
        if (res.error) return res;
        return {data: res.data, error: await syncStrengths(supabase, res.data.id, strength_ids), partial: 'strengths'};
    }, {retry: false});
}

export async function updateStaff(input: {id: string} & Partial<StaffInput>): Promise<ActionResult<Staff>> {
    return writeRow(input, updateStaffSchema, async (supabase, {id, strength_ids, ...patch}) => {
        const res = await retryDeadlock(() => nonEmpty(patch)
            ? supabase.from('tracker_staff').update(patch).eq('id', id).select().single()
            : supabase.from('tracker_staff').select().eq('id', id).single());
        if (res.error || !strength_ids) return res;
        return {data: res.data, error: await syncStrengths(supabase, id, strength_ids), partial: 'strengths'};
    }, {retry: false});
}

export async function archiveStaff(input: {id: string; archived: boolean}): Promise<ActionResult<Staff>> {
    return writeRow(input, archiveSchema, (supabase, {id, archived}) =>
        supabase.from('tracker_staff').update({archived_at: archivedAt(archived)}).eq('id', id).select().single());
}

const strengthFields = publicTrackerStrengthsInsertSchema.pick({label: true, all_rounder: true, sort_order: true}).extend({
    label: z.string().trim().min(1).max(40),
    all_rounder: z.boolean(),
    sort_order: z.number().int().min(0),
});
const updateStrengthSchema = strengthFields.partial().extend({id: z.uuid()})
    .refine(nonEmptyPatch);

export async function createStrength(
    input: {label: string; all_rounder: boolean; sort_order: number},
): Promise<ActionResult<Strength>> {
    return writeRow(input, strengthFields, (supabase, d) =>
        supabase.from('tracker_strengths').insert(d).select().single());
}

export async function updateStrength(
    input: {id: string; label?: string; all_rounder?: boolean; sort_order?: number},
): Promise<ActionResult<Strength>> {
    return writeRow(input, updateStrengthSchema, (supabase, {id, ...patch}) =>
        supabase.from('tracker_strengths').update(patch).eq('id', id).select().single());
}

export async function deleteStrength(input: {id: string}): Promise<ActionResult<{id: string}>> {
    return writeRow(input, idSchema, (supabase, {id}) =>
        supabase.from('tracker_strengths').delete().eq('id', id).select('id').single(), {fk: 'in_use'});
}

/* ── Cuts ──────────────────────────────────────────────────────── */

type Cut = Tables<'tracker_cuts'>;

const cutCode = cutCodeInput.transform(normalizeCutCode).pipe(z.string().min(1).max(20));

const createCutsSchema = z.object({
    project_id: z.uuid(),
    from: z.number().int().min(1),
    to: z.number().int(),
    budget: money.optional(),
}).refine((d) => d.to >= d.from && d.to - d.from < 200);

const updateCutSchema = z.object({
    id: z.uuid(),
    patch: publicTrackerCutsInsertSchema.pick({budget: true, links: true, code: true})
        .extend({budget: money, links, code: cutCode}).partial().refine(nonEmpty),
});

const setCutSplitsSchema = z.object({
    project_id: z.uuid(),
    cut_ids: z.array(z.uuid()).min(1).max(5000),
    // {work_type_id: pct} totalling 100 (keys checked against the project in SQL); null = project default
    pay_split: z.record(z.uuid(), payPct).refine((s) => pctSum(Object.values(s))).nullable(),
});

const payPresetSchema = z.object({
    name: z.string().trim().min(1).max(60),
    // by work-type position; codes are display only
    pcts: z.array(payPct).min(1).max(50).refine(pctSum),
    codes: z.array(z.string().trim().min(1).max(20)).max(50),
}).refine((d) => d.codes.length === d.pcts.length);

export async function createCuts(
    input: {project_id: string; from: number; to: number; budget?: number},
): Promise<ActionResult<Cut[]>> {
    return writeRow(input, createCutsSchema, (supabase, {project_id, from, to, budget}) => {
        const rows = cutRange(from, to).map((code) => ({project_id, code, ...(budget === undefined ? {} : {budget})}));
        return supabase.from('tracker_cuts')
            .upsert(rows, {onConflict: 'project_id,code', ignoreDuplicates: true})
            .select();
    });
}

export async function updateCut(
    input: {id: string; patch: {budget?: number; links?: Link[]; code?: string}},
): Promise<ActionResult<Cut>> {
    return writeRow(input, updateCutSchema, (supabase, {id, patch}) =>
        supabase.from('tracker_cuts').update(patch).eq('id', id).select().single());
}

/** One pay split (null = project default) for many cuts at once; all or nothing. */
export async function setCutSplits(
    input: {project_id: string; cut_ids: string[]; pay_split: Record<string, number> | null},
): Promise<ActionResult<Cut[]>> {
    return writeRow(input, setCutSplitsSchema, (supabase, {project_id, cut_ids, pay_split}) =>
        supabase.rpc('tracker_set_cut_splits', {p_project: project_id, p_cuts: cut_ids, p_split: pay_split}));
}

/* ── Pay presets (studio-wide, by work-type position) ─────────── */

export async function createPayPreset(
    input: {name: string; pcts: number[]; codes: string[]},
): Promise<ActionResult<Tables<'tracker_pay_presets'>>> {
    return writeRow(input, payPresetSchema, (supabase, d) =>
        supabase.from('tracker_pay_presets').insert(d).select().single());
}

export async function deletePayPreset(input: {id: string}): Promise<ActionResult<{id: string}>> {
    return writeRow(input, idSchema, (supabase, {id}) =>
        supabase.from('tracker_pay_presets').delete().eq('id', id).select('id').single());
}

export async function deleteCut(input: {id: string}): Promise<ActionResult<{id: string}>> {
    return writeRow(input, idSchema, (supabase, {id}) =>
        supabase.from('tracker_cuts').delete().eq('id', id).select('id').single(), {fk: 'in_use'});
}

/* ── Tasks ─────────────────────────────────────────────────────── */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const datesOrdered = (d: {start_date?: string; end_date?: string}) =>
    !d.start_date || !d.end_date || d.end_date >= d.start_date;

const createTaskSchema = z.object({
    project_id: z.uuid(),
    staff_id: z.uuid(),
    work_type_id: z.uuid(),
    cut_code: cutCodeInput,
    start_date: isoDate,
    end_date: isoDate,
    budget: money.optional(),
}).refine(datesOrdered);

const taskPatch = z.object({
    cut_code: cutCodeInput,
    staff_id: z.uuid(),
    work_type_id: z.uuid(),
    start_date: isoDate,
    end_date: isoDate,
    progress: z.number().int().min(0).max(100),
    links,
}).partial().refine(datesOrdered).refine(nonEmpty);

const updateTaskSchema = z.object({id: z.uuid(), expected_version: z.number().int().min(1), patch: taskPatch});
const deleteTaskSchema = z.object({id: z.uuid(), expected_version: z.number().int().min(1)});

export type TaskPatch = z.input<typeof taskPatch>;

export async function createTask(input: {
    project_id: string;
    staff_id: string;
    work_type_id: string;
    cut_code: string;
    start_date: string;
    end_date: string;
    budget?: number;
}): Promise<ActionResult<{task: Task; cut: Cut}>> {
    return writeRow(input, createTaskSchema, async (supabase, d) => {
        const {data, error} = await supabase.rpc('tracker_create_task', {
            p_project: d.project_id,
            p_staff: d.staff_id,
            p_type: d.work_type_id,
            p_cut_code: d.cut_code,
            p_start: d.start_date,
            p_end: d.end_date,
            p_budget: d.budget,
        });
        return {data: data as {task: Task; cut: Cut} | null, error};
    }, NO_REVALIDATE);
}

export async function updateTask(
    input: {id: string; expected_version: number; patch: TaskPatch},
): Promise<ActionResult<Task>> {
    return writeVersioned(input, updateTaskSchema, async (supabase, {id, expected_version, patch}) => {
        const {cut_code, ...rest} = patch;
        let cut_id: string | undefined;
        if (cut_code !== undefined) {
            // An orphan empty cut left by a later conflict is accepted (plan §3.3).
            const task = await supabase.from('tracker_tasks').select('project_id').eq('id', id).maybeSingle();
            if (task.error || !task.data) return {data: null, error: task.error};
            const cut = await supabase.rpc('tracker_ensure_cut', {p_project: task.data.project_id, p_code: cut_code});
            if (cut.error) return {data: null, error: cut.error};
            cut_id = cut.data.id;
        }
        return supabase.from('tracker_tasks')
            .update(cut_id ? {...rest, cut_id} : rest)
            .eq('id', id).eq('version', expected_version)
            .select().maybeSingle();
    });
}

export async function deleteTask(input: {id: string; expected_version: number}): Promise<ActionResult<{id: string}>> {
    return writeVersioned(input, deleteTaskSchema, (supabase, {id, expected_version}) =>
        supabase.from('tracker_tasks').delete().eq('id', id).eq('version', expected_version).select('id').maybeSingle(),
        {fk: 'in_use'});
}

/* ── Pay adjustments ───────────────────────────────────────────── */

type Adjustment = Tables<'tracker_pay_adjustments'>;

const reason = z.string().trim().min(3).max(500);

const addAdjustmentsSchema = z.object({
    op_id: z.uuid(),
    project_id: z.uuid(),
    reason,
    entries: z.array(z.object({
        cut_id: z.uuid(),
        work_type_id: z.uuid(),
        staff_id: z.uuid(),
        amount: z.number().int().refine((a) => a !== 0 && Math.abs(a) <= 1e10),
        reason: reason.optional(),
    })).min(1).max(100),
});

const reverseAdjustmentSchema = z.object({op_id: z.uuid(), id: z.uuid(), reason});

export async function addAdjustments(input: z.input<typeof addAdjustmentsSchema>): Promise<ActionResult<Adjustment[]>> {
    return writeRow(input, addAdjustmentsSchema, (supabase, d) =>
        supabase.rpc('tracker_add_adjustments', {
            p_batch: d.op_id, p_project: d.project_id, p_reason: d.reason, p_entries: d.entries,
        }));
}

export async function reverseAdjustment(input: {op_id: string; id: string; reason: string}): Promise<ActionResult<Adjustment>> {
    return writeRow(input, reverseAdjustmentSchema, async (supabase, {op_id, id, reason}) => {
        const orig = await supabase.from('tracker_pay_adjustments').select().eq('id', id).single();
        if (orig.error) return orig;
        const {project_id, cut_id, work_type_id, staff_id, amount} = orig.data;
        const {data, error} = await supabase.rpc('tracker_add_adjustments', {
            p_batch: op_id,
            p_project: project_id,
            p_reason: reason,
            p_entries: [{cut_id, work_type_id, staff_id, amount: -amount, reverses_id: id}],
        });
        return {data: data?.[0] ?? null, error};
    });
}

/* ── Shares ────────────────────────────────────────────────────── */

type Share = Tables<'tracker_shares'>;

const createShareSchema = z.object({
    project_id: z.uuid(),
    staff_ids: z.array(z.uuid()).min(1).max(50).refine(unique),
    label: z.string().trim().max(80).transform((s) => s || null).nullable().optional(),
});

export async function createShare(
    input: {project_id: string; staff_ids: string[]; label?: string | null},
): Promise<ActionResult<Share>> {
    return writeRow(input, createShareSchema, async (supabase, d) => {
        // only active, known staff (23514 → 'invalid')
        const staff = await supabase.from('tracker_staff').select('id').in('id', d.staff_ids).is('archived_at', null);
        if (staff.error) return {data: null, error: staff.error};
        if (staff.data.length !== d.staff_ids.length) return {data: null, error: {code: '23514'}};
        // token (DB default) and created_by (trigger) are not insertable by users (column grant)
        return supabase.from('tracker_shares')
            .insert(d as TablesInsert<'tracker_shares'>)
            .select().single();
    });
}

export async function revokeShare(input: {id: string}): Promise<ActionResult<Share>> {
    // already revoked → no row → 'not_found' (the DB also refuses any update of a revoked share)
    return writeRow(input, idSchema, (supabase, {id}) =>
        supabase.from('tracker_shares').update({revoked_at: new Date().toISOString()})
            .eq('id', id).is('revoked_at', null).select().maybeSingle());
}

/* ── Email (plan §3.7) ─────────────────────────────────────────── */

export type MailResult = {sent: number; skippedNoEmail: string[]; skippedArchived: string[]; failed: number};
type Outgoing = {kind: 'resources' | 'schedule'; staff_id: string; to: string; mail: Mail; task_id?: string; cut_id?: string};
type Skipped = {noEmail: string[]; archived: string[]};
type MailTarget = {name: string; email: string | null; archived_at: string | null};

// Archived staff and staff without email are never sent to; both are reported by name.
function sendable(s: MailTarget, skipped: Skipped): s is MailTarget & {email: string} {
    if (s.archived_at) skipped.archived.push(s.name);
    else if (!s.email) skipped.noEmail.push(s.name);
    return !s.archived_at && !!s.email;
}

// Persist every payload as a 'pending' log row first (leased so the worker does not race this send;
// a crash leaves it to the worker's retry pass), then deliver (paced) and finalise each row.
async function sendMails(
    supabase: Supabase, replyTo: string | undefined, out: Outgoing[], skipped: Skipped,
): Promise<RunResult<MailResult>> {
    const result = (sent: number, failed: number) =>
        ({data: {sent, skippedNoEmail: skipped.noEmail, skippedArchived: skipped.archived, failed}, error: null});
    if (!out.length) return result(0, 0);
    const from = mailFrom();
    const claimed_until = new Date(Date.now() + out.length * 10_000 + 60_000).toISOString();
    const rows = await Promise.all(out.map(async (o) => {
        const payload: MailPayload = {
            from, to: [o.to], ...(replyTo ? {reply_to: replyTo} : {}), subject: o.mail.subject, html: await render(o.mail.element),
        };
        return {
            kind: o.kind, staff_id: o.staff_id, to_email: o.to, subject: o.mail.subject, payload, status: 'pending',
            idempotency_key: `manual-${randomUUID()}`, task_id: o.task_id ?? null, cut_id: o.cut_id ?? null, claimed_until,
        };
    }));
    // same invariant the worker enforces before (re)sending (`to` comes from the staff row)
    if (rows.some((r) => !payloadOk(r.payload, r.to_email, r.to_email, from))) return {data: null, error: {code: '23514'}};
    const ins = await supabase.from('tracker_email_log').insert(rows).select('id, payload, idempotency_key');
    if (ins.error) return {data: null, error: ins.error};
    let sent = 0;
    for (const [i, row] of ins.data.entries()) {
        if (i) await sleep(SEND_GAP_MS);
        const r = await deliver(row);
        if (r.status === 'accepted') sent++;
        // a failed finalise leaves the row pending → the worker retries it with the same key;
        // never downgrade a row the worker already marked accepted
        await supabase.from('tracker_email_log').update(r.status === 'accepted'
            ? {status: 'accepted', resend_id: r.resend_id, error: null, attempts: 1}
            : {status: 'failed', error: r.error, attempts: 1}).eq('id', row.id).neq('status', 'accepted');
    }
    return result(sent, ins.data.length - sent);
}

const sendResourcesSchema = z.union([z.object({task_id: z.uuid()}).strict(), z.object({cut_id: z.uuid()}).strict()]);

/** Task → its assignee; cut → every assignee of the cut. Staff without email are skipped and reported. */
export async function sendResources(input: {task_id: string} | {cut_id: string}): Promise<ActionResult<MailResult>> {
    return writeRow(input, sendResourcesSchema, async (supabase, d, user) => {
        const taskId = 'task_id' in d ? d.task_id : undefined;
        let cutId = 'cut_id' in d ? d.cut_id : '';
        if (taskId) {
            const t = await supabase.from('tracker_tasks').select('cut_id').eq('id', taskId).maybeSingle();
            if (t.error || !t.data) return {data: null, error: t.error};
            cutId = t.data.cut_id;
        }
        let taskQuery = supabase.from('tracker_tasks')
            .select('id, staff_id, start_date, end_date, links, type:tracker_work_types!tracker_tasks_type_fk(code, label, sort_order), staff:tracker_staff(name, email, archived_at)')
            .eq('cut_id', cutId);
        if (taskId) taskQuery = taskQuery.eq('id', taskId);
        const [cut, tasks] = await Promise.all([
            supabase.from('tracker_cuts').select('code, links, project:tracker_projects(name, links)').eq('id', cutId).maybeSingle(),
            taskQuery,
        ]);
        if (cut.error || tasks.error || !cut.data) return {data: null, error: cut.error ?? tasks.error};
        const {code, links: cutLinks, project} = cut.data;
        const byStaff = new Map<string, typeof tasks.data>();
        for (const t of tasks.data) byStaff.set(t.staff_id, [...(byStaff.get(t.staff_id) ?? []), t]);
        const out: Outgoing[] = [];
        const skipped: Skipped = {noEmail: [], archived: []};
        for (const [staffId, list] of byStaff) {
            const staff = list[0].staff ?? {name: staffId, email: null, archived_at: null};
            if (!sendable(staff, skipped)) continue;
            out.push({
                kind: 'resources', staff_id: staffId, to: staff.email, task_id: taskId, cut_id: cutId,
                mail: resourcesMail({
                    staffName: staff.name,
                    projectName: project?.name ?? '',
                    cutCode: code,
                    stages: list
                        .sort((a, b) => (a.type?.sort_order ?? 0) - (b.type?.sort_order ?? 0))
                        .map((t) => ({
                            type_code: t.type?.code ?? '', type_label: t.type?.label ?? '',
                            start_date: t.start_date, end_date: t.end_date, links: sanitizeLinks(t.links),
                        })),
                    cutLinks: sanitizeLinks(cutLinks),
                    projectLinks: sanitizeLinks(project?.links),
                }),
            });
        }
        return sendMails(supabase, user.email, out, skipped);
    }, NO_REVALIDATE);
}

const sendScheduleSchema = z.object({share_id: z.uuid(), month: z.string().refine(isValidMonth)});

/** Every member of the share with an email: their tasks of the month, the share link and their calendar URL. */
export async function sendSchedule(input: {share_id: string; month: string}): Promise<ActionResult<MailResult>> {
    return writeRow(input, sendScheduleSchema, async (supabase, {share_id, month}, user) => {
        const share = await supabase.from('tracker_shares')
            .select('token, project_id, staff_ids, project:tracker_projects(name)')
            .eq('id', share_id).is('revoked_at', null).maybeSingle();
        if (share.error || !share.data) return {data: null, error: share.error};
        const {token, project_id, staff_ids, project} = share.data;
        const {start, end} = monthRange(month);
        const [staff, tasks] = await Promise.all([
            supabase.from('tracker_staff').select('id, name, email, archived_at').in('id', staff_ids),
            supabase.from('tracker_tasks')
                .select('id, staff_id, start_date, end_date, progress, cut:tracker_cuts!tracker_tasks_cut_fk(code), type:tracker_work_types!tracker_tasks_type_fk(code, label)')
                .eq('project_id', project_id).in('staff_id', staff_ids)
                .lte('start_date', end).gte('end_date', start)
                .order('start_date'),
        ]);
        if (staff.error || tasks.error) return {data: null, error: staff.error ?? tasks.error};
        const projectName = project?.name ?? '';
        const out: Outgoing[] = [];
        const skipped: Skipped = {noEmail: [], archived: []};
        for (const id of staff_ids) {
            const s = staff.data.find((x) => x.id === id);
            if (!s || !sendable(s, skipped)) continue;
            out.push({
                kind: 'schedule', staff_id: s.id, to: s.email,
                mail: scheduleMail({
                    staffName: s.name,
                    projectName,
                    month,
                    tasks: tasks.data.filter((t) => t.staff_id === s.id).map((t) => ({
                        id: t.id, staff_id: t.staff_id, start_date: t.start_date, end_date: t.end_date, progress: t.progress,
                        project_name: projectName, project_archived: false,
                        cut_code: t.cut?.code ?? '', type_code: t.type?.code ?? '', type_label: t.type?.label ?? '',
                    })),
                    shareUrl: `${SITE_URL}/vi/share/${token}?m=${month}`,
                    calendarUrl: `${SITE_URL}/api/tracker/ics/${token}/${s.id}`,
                }),
            });
        }
        return sendMails(supabase, user.email, out, skipped);
    }, NO_REVALIDATE);
}
