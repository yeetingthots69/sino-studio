import 'server-only';
import type {ReactElement} from 'react';
import {Resend} from 'resend';
import {render as renderHtml} from '@react-email/render';

// Tracker email transport (plan §3.7). Payloads are rendered once, stored in tracker_email_log and
// (re)sent byte-for-byte. Never logs recipients, tokens or bodies.

export type MailPayload = {from: string; to: string[]; reply_to?: string; subject: string; html: string};
export type DeliverResult = {status: 'accepted'; resend_id: string} | {status: 'failed'; error: string};

export const mailFrom = () => process.env.TRACKER_MAIL_FROM || 'Sino Studio <tracker@web.sinostudio.vn>';

export const render = (template: ReactElement) => renderHtml(template);

let client: Resend | null = null;
const MAX_WAIT_MS = 5_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitMs = (retryAfter: string | undefined) => {
    const s = Number(retryAfter);
    return Math.min(Number.isFinite(s) && s > 0 ? s * 1000 : 1000, MAX_WAIT_MS);
};

/** Sends exactly `row.payload` with the row's idempotency key; one retry on 429 (retry-after, ≤ 5 s). */
export async function deliver(row: {payload: unknown; idempotency_key: string}): Promise<DeliverResult> {
    try {
        client ??= new Resend(process.env.RESEND_API_KEY); // throws "Missing API key" when unset
        const p = row.payload as MailPayload;
        const send = () => client!.emails.send(
            {from: p.from, to: p.to, replyTo: p.reply_to, subject: p.subject, html: p.html},
            {idempotencyKey: row.idempotency_key},
        );
        let res = await send();
        if (res.error?.statusCode === 429) {
            await sleep(waitMs(res.headers?.['retry-after']));
            res = await send();
        }
        if (res.error) return {status: 'failed', error: `${res.error.name}: ${res.error.message}`.slice(0, 500)};
        if (!res.data?.id) return {status: 'failed', error: 'no id returned'};
        return {status: 'accepted', resend_id: res.data.id};
    } catch (e) {
        return {status: 'failed', error: (e instanceof Error ? e.message : String(e)).slice(0, 500)};
    }
}
