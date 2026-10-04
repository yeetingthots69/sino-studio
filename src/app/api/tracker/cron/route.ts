import createAdminClient from '@/utils/supabase/admin';
import {addDays, nowICT} from '@/components/tracker/dates';
import {assignmentMail, reminderMail, type Mail} from '@/components/tracker/emails/TrackerEmails';
import {
    bearerOk, chunk, completionPatch, digestKey, parseRemoved, payloadOk, planDigest, REJECTED_PAYLOAD, reminderDue, reminderKey,
    reminderTargets, SEND_GAP_MS, shouldRetry, toMailTask, type MailStaff, type TaskRow,
} from '@/lib/tracker/mailPlan';
import {deliver, mailFrom, render, sleep, type MailPayload} from '@/services/trackerMail';

// 25 paced deliveries (≤ 25 × (0.55 s + send + one 5 s 429 wait in the worst case)) stay well inside
// the 2-minute claim lease; typical runs take ~20 s.
export const maxDuration = 60;
const CLAIM_EMAILS = 25;

// Email worker (plan §3.7), called by pg_cron → pg_net every 5 min with `Authorization: Bearer $CRON_SECRET`.
// Service role. Counts-only JSON summary; never logs recipients or tokens.

const HEADERS = {'Cache-Control': 'private, no-store'};
const json = (body: unknown, status = 200) => Response.json(body, {status, headers: HEADERS});

type Db = ReturnType<typeof createAdminClient>;

const TASK_COLS = 'id, staff_id, start_date, end_date, progress, is_fix, project:tracker_projects(name, archived_at), cut:tracker_cuts!tracker_tasks_cut_fk(code), type:tracker_work_types!tracker_tasks_type_fk(code, label)';

function fail(step: string, error: unknown): never {
    console.error(`[tracker-cron] ${step} failed:`, (error as {message?: string})?.message ?? error);
    throw new Error(step);
}

async function payload(to: string, mail: Mail): Promise<MailPayload> {
    return {from: mailFrom(), to: [to], subject: mail.subject, html: await render(mail.element)};
}

// 1. Digests: claimed queue rows → one pending log row each (or dropped), queue row deleted if unchanged.
async function digests(db: Db, today: string) {
    const {data: notices, error} = await db.rpc('tracker_claim_notices', {p_limit: 20, p_lease: '2 minutes'});
    if (error) fail('claim_notices', error);
    let queued = 0;
    let dropped = 0;
    for (const n of notices) {
        const [staff, open, ...changed] = await Promise.all([
            db.from('tracker_staff').select('id, name, email, archived_at').eq('id', n.staff_id).maybeSingle(),
            db.from('tracker_tasks').select(TASK_COLS).eq('staff_id', n.staff_id).gte('end_date', today).lt('progress', 100),
            ...chunk(n.task_ids).map((ids) =>
                db.from('tracker_tasks').select(TASK_COLS).eq('staff_id', n.staff_id).in('id', ids)),
        ]);
        const loadErr = staff.error ?? open.error ?? changed.find((r) => r.error)?.error;
        if (loadErr) fail('digest load', loadErr);
        const tasks = new Map<string, TaskRow>();
        for (const r of [open, ...changed]) for (const t of r.data as TaskRow[]) tasks.set(t.id, t);
        const plan = planDigest({...n, removed: parseRemoved(n.removed)},
            [...tasks.values()].map(toMailTask), staff.data as MailStaff | null, today);
        if (plan.send) {
            const mail = assignmentMail({staffName: plan.staff.name, changed: plan.changed, others: plan.others, removed: plan.removed});
            const {error: insErr} = await db.from('tracker_email_log').upsert({
                kind: 'assignment', staff_id: plan.staff.id, to_email: plan.staff.email, subject: mail.subject,
                payload: await payload(plan.staff.email, mail), status: 'pending', idempotency_key: digestKey(n),
            }, {onConflict: 'idempotency_key', ignoreDuplicates: true});
            if (insErr) fail('digest insert', insErr); // lease expires → reclaimed; the insert is idempotent
            queued++;
        } else dropped++;
        // a newer enqueue (higher generation) survives with its lease reset
        const {error: delErr} = await db.from('tracker_notice_queue').delete()
            .eq('staff_id', n.staff_id).eq('cycle_id', n.cycle_id).eq('generation', n.generation);
        if (delErr) fail('digest delete', delErr);
    }
    return {claimed: notices.length, queued, dropped};
}

// 2. Reminders for tomorrow (ICT): enqueued by the first run at or after 08:00 ICT.
async function reminders(db: Db, today: string, hour: number) {
    if (!reminderDue(hour)) return {queued: 0};
    const date = addDays(today, 1);
    const done = await db.from('tracker_email_log').select('id').eq('kind', 'reminder').eq('ref_date', date).limit(1);
    if (done.error) fail('reminder check', done.error);
    if (done.data.length) return {queued: 0};
    const [staff, tasks] = await Promise.all([
        db.from('tracker_staff').select('id, name, email, archived_at').is('archived_at', null).not('email', 'is', null),
        db.from('tracker_tasks').select(TASK_COLS).eq('end_date', date).lt('progress', 100),
    ]);
    if (staff.error || tasks.error) fail('reminder load', staff.error ?? tasks.error);
    const targets = reminderTargets((tasks.data as TaskRow[]).map(toMailTask), staff.data, today);
    if (!targets.length) return {queued: 0};
    const rows = await Promise.all(targets.map(async (r) => {
        const mail = reminderMail({staffName: r.staff.name, date: r.date, tasks: r.tasks});
        return {
            kind: 'reminder', staff_id: r.staff.id, to_email: r.staff.email, subject: mail.subject,
            payload: await payload(r.staff.email, mail), status: 'pending',
            idempotency_key: reminderKey(r.staff.id, r.date), ref_date: r.date,
        };
    }));
    const {error} = await db.from('tracker_email_log').upsert(rows, {onConflict: 'idempotency_key', ignoreDuplicates: true});
    if (error) fail('reminder insert', error);
    return {queued: rows.length};
}

// 3. Deliver / retry: claimed rows (≤ 50) resend their stored payload; completion is conditioned on the claim token.
async function deliveries(db: Db, now: Date) {
    const {data: rows, error} = await db.rpc('tracker_claim_emails', {p_limit: CLAIM_EMAILS, p_lease: '2 minutes'});
    if (error) fail('claim_emails', error);
    const staffIds = [...new Set(rows.flatMap((r) => (r.staff_id ? [r.staff_id] : [])))];
    const emails = new Map<string, string | null>();
    for (const ids of chunk(staffIds)) {
        const res = await db.from('tracker_staff').select('id, email').in('id', ids);
        if (res.error) fail('delivery staff', res.error);
        for (const s of res.data) emails.set(s.id, s.email);
    }
    const from = mailFrom();
    let accepted = 0;
    let sent = false;
    for (const row of rows) {
        let r: Awaited<ReturnType<typeof deliver>>;
        if (!shouldRetry(row, now)) r = {status: 'failed', error: row.error ?? 'retry window closed'};
        else if (!payloadOk(row.payload, row.to_email, row.staff_id ? emails.get(row.staff_id) : null, from)) {
            r = {status: 'failed', error: REJECTED_PAYLOAD};
        } else {
            if (sent) await sleep(SEND_GAP_MS);
            sent = true;
            r = await deliver(row);
        }
        if (r.status === 'accepted') accepted++;
        else console.error('[tracker-cron] delivery failed, log row', row.id); // reason is in tracker_email_log.error
        const {error: upErr} = await db.from('tracker_email_log')
            .update(completionPatch(r))
            .eq('id', row.id).eq('claim_token', row.claim_token!);
        if (upErr) console.error('[tracker-cron] completion update failed:', row.id, upErr.message);
    }
    return {claimed: rows.length, accepted, failed: rows.length - accepted};
}

export async function POST(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[tracker-cron] CRON_SECRET is not set');
        return json({error: 'not_configured'}, 500);
    }
    if (!bearerOk(req.headers.get('authorization'), secret)) return json({error: 'unauthorized'}, 401);

    const now = new Date();
    const {today, hour} = nowICT(now);
    const db = createAdminClient();
    const summary: Record<string, unknown> = {};
    let ok = true;
    // each step runs even if an earlier one failed (a stuck digest must not block retries)
    for (const [name, step] of [
        ['digests', () => digests(db, today)],
        ['reminders', () => reminders(db, today, hour)],
        ['deliveries', () => deliveries(db, now)],
    ] as const) {
        try {
            summary[name] = await step();
        } catch {
            ok = false;
            summary[name] = 'error';
        }
    }
    return json(summary, ok ? 200 : 500);
}
