// Pure decision logic for the tracker email worker (plan §3.7). No I/O; unit-tested.
import {timingSafeEqual} from 'node:crypto';
import {addDays, type ISODate} from '@/components/tracker/dates';
import {compareCutCodes} from '@/components/tracker/cuts';

export type MailStaff = {id: string; name: string; email: string | null; archived_at: string | null};
export type MailTask = {
    id: string;
    staff_id: string;
    start_date: ISODate;
    end_date: ISODate;
    progress: number;
    project_name: string;
    project_archived: boolean;
    cut_code: string;
    type_code: string;
    type_label: string;
};
/** Snapshot of a task moved away from the recipient (queue column `removed`). */
export type RemovedMailTask = {
    task_id: string;
    project_name: string;
    cut_code: string;
    type_code: string;
    type_label: string;
    start_date: ISODate;
    end_date: ISODate;
};
export type NoticeRow = {staff_id: string; cycle_id: string; generation: number; task_ids: string[]; removed: RemovedMailTask[]};
export type Recipient = MailStaff & {email: string};

export const MAX_ATTEMPTS = 5;
export const RETRY_WINDOW_MS = 23 * 3_600_000; // Resend idempotency keys live 24 h
export const REMINDER_HOUR = 8; // ICT, first hour of the enqueue window
export const REMINDER_LAST_HOUR = 10; // ICT, last hour of the enqueue window (inclusive)
export const SEND_GAP_MS = 550; // pacing between sends (Resend default rate limit: 2 req/s)
export const REJECTED_PAYLOAD = 'rejected_payload';

export const digestKey = (n: Pick<NoticeRow, 'cycle_id' | 'generation'>) => `assign-${n.cycle_id}-${n.generation}`;
export const reminderKey = (staffId: string, date: ISODate) => `reminder-${staffId}-${date}`;

/** Constant-time `Authorization: Bearer <secret>` check (lengths compared first, as timingSafeEqual requires). */
export function bearerOk(header: string | null, secret: string): boolean {
    if (!secret || !header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(`Bearer ${secret}`);
    return a.length === b.length && timingSafeEqual(a, b);
}

const recipient = (s: MailStaff | null | undefined): s is Recipient => !!s && !!s.email && !s.archived_at;
const byDate = (a: MailTask, b: MailTask) =>
    a.start_date.localeCompare(b.start_date) || compareCutCodes(a.cut_code, b.cut_code) || a.type_code.localeCompare(b.type_code);
const open = (t: MailTask, today: ISODate) => !t.project_archived && t.progress < 100 && t.end_date >= today;

export type DigestPlan =
    | {send: false}
    | {send: true; staff: Recipient; changed: MailTask[]; others: MailTask[]; removed: RemovedMailTask[]};

/**
 * One claimed queue row → drop or send. Changed = queued task ids still assigned to this staff;
 * others = the staff's other open tasks (end >= today ICT, progress < 100, non-archived projects);
 * removed = moved-away snapshots deduped by task (last wins), minus tasks the staff holds again.
 */
export function planDigest(n: NoticeRow, tasks: MailTask[], staff: MailStaff | null, today: ISODate): DigestPlan {
    if (!recipient(staff)) return {send: false};
    const ids = new Set(n.task_ids);
    const mine = tasks.filter((t) => t.staff_id === n.staff_id);
    const changed = mine.filter((t) => ids.has(t.id)).sort(byDate);
    const mineIds = new Set(mine.map((t) => t.id));
    const removed = [...new Map(n.removed.map((r) => [r.task_id, r])).values()].filter((r) => !mineIds.has(r.task_id));
    if (!changed.length && !removed.length) return {send: false};
    const others = mine.filter((t) => !ids.has(t.id) && open(t, today)).sort(byDate);
    return {send: true, staff, changed, others, removed};
}

/** Reminders for tomorrow (ICT): active staff with email and open tasks ending tomorrow in non-archived projects. */
export function reminderTargets(tasks: MailTask[], staff: MailStaff[], today: ISODate): {
    staff: Recipient; date: ISODate; tasks: MailTask[];
}[] {
    const date = addDays(today, 1);
    const byStaff = new Map<string, MailTask[]>();
    for (const t of tasks) {
        if (t.end_date !== date || !open(t, today)) continue;
        byStaff.set(t.staff_id, [...(byStaff.get(t.staff_id) ?? []), t]);
    }
    return staff.filter(recipient).flatMap((s) => {
        const list = byStaff.get(s.id);
        return list ? [{staff: s, date, tasks: list.sort(byDate)}] : [];
    });
}

/** Reminders are enqueued only by runs between 08:00 and 10:59 ICT (once per day via the unique key). */
export const reminderDue = (hourICT: number) => hourICT >= REMINDER_HOUR && hourICT <= REMINDER_LAST_HOUR;

/** Split ids into PostgREST-safe chunks (URL length). */
export function chunk<T>(xs: T[], size = 100): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
    return out;
}

/**
 * Integrity check before a payload is stored or (re)sent: from = the configured sender, exactly one
 * recipient equal to the row's to_email, and that address is the staff member's current email.
 */
export function payloadOk(payload: unknown, toEmail: string, staffEmail: string | null | undefined, from: string): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as {from?: unknown; to?: unknown};
    return p.from === from
        && Array.isArray(p.to) && p.to.length === 1 && p.to[0] === toEmail
        && !!staffEmail && staffEmail === toEmail;
}

/**
 * Worker completion update. A rejected payload can never succeed: it is retired (attempts = MAX_ATTEMPTS)
 * so the claim RPC skips it; it still shows in the "Gửi lỗi" query.
 */
export function completionPatch(r: {status: 'accepted'; resend_id: string} | {status: 'failed'; error: string}) {
    if (r.status === 'accepted') return {status: 'accepted', resend_id: r.resend_id, error: null, claimed_until: null};
    return {
        status: 'failed', error: r.error, claimed_until: null,
        ...(r.error === REJECTED_PAYLOAD ? {attempts: MAX_ATTEMPTS} : {}),
    };
}

/** A claimed row may be (re)sent: not accepted, under the attempt cap, inside the 23 h idempotency window. */
export function shouldRetry(row: {status: string; attempts: number; created_at: string}, now: Date): boolean {
    return row.status !== 'accepted'
        && row.attempts <= MAX_ATTEMPTS // the claim RPC already counted this attempt
        && now.getTime() - Date.parse(row.created_at) < RETRY_WINDOW_MS;
}
