import {describe, expect, it} from 'vitest';
import {nowICT} from '@/components/tracker/dates';
import {
    bearerOk, chunk, completionPatch, digestKey, payloadOk, planDigest, reminderDue, reminderKey, reminderTargets, shouldRetry,
    type MailStaff, type MailTask, type NoticeRow, type RemovedMailTask,
} from '../mailPlan';

const staff = (over: Partial<MailStaff> = {}): MailStaff =>
    ({id: 's1', name: 'Tôm', email: 'tom@example.com', archived_at: null, ...over});
const task = (over: Partial<MailTask> = {}): MailTask => ({
    id: 't1', staff_id: 's1', start_date: '2026-10-01', end_date: '2026-10-05', progress: 0,
    project_name: 'Demo', project_archived: false, cut_code: 'C1', type_code: 'LO', type_label: 'Layout', ...over,
});
const notice: NoticeRow = {staff_id: 's1', cycle_id: 'c', generation: 3, task_ids: ['t1', 't2'], removed: []};
const snap = (over: Partial<RemovedMailTask> = {}): RemovedMailTask => ({
    task_id: 't9', project_name: 'Demo', cut_code: 'C9', type_code: 'LO', type_label: 'Layout',
    start_date: '2026-10-01', end_date: '2026-10-03', ...over,
});
const TODAY = '2026-10-01';

describe('planDigest', () => {
    it('drops without a recipient', () => {
        expect(planDigest(notice, [task()], null, TODAY)).toEqual({send: false});
        expect(planDigest(notice, [task()], staff({email: null}), TODAY)).toEqual({send: false});
        expect(planDigest(notice, [task()], staff({archived_at: '2026-01-01'}), TODAY)).toEqual({send: false});
    });

    it('drops when every queued task was reassigned away', () => {
        expect(planDigest(notice, [task({staff_id: 's2'}), task({id: 't2', staff_id: 's2'})], staff(), TODAY))
            .toEqual({send: false});
    });

    it('keeps still-assigned changed tasks first, then other open tasks', () => {
        const plan = planDigest(notice, [
            task({id: 't2', cut_code: 'C10'}),
            task({id: 't1', cut_code: 'C2'}),
            task({id: 't3', staff_id: 's1', cut_code: 'C3'}),                 // open → other
            task({id: 't4', progress: 100}),                                   // done → hidden
            task({id: 't5', end_date: '2026-09-30'}),                          // past → hidden
            task({id: 't6', project_archived: true}),                          // archived project → hidden
            task({id: 't7', staff_id: 's2'}),                                  // someone else
        ], staff(), TODAY);
        expect(plan.send).toBe(true);
        if (!plan.send) return;
        expect(plan.changed.map((t) => t.id)).toEqual(['t1', 't2']); // natural cut order C2 < C10
        expect(plan.others.map((t) => t.id)).toEqual(['t3']);
    });

    it('sends a removed-only digest', () => {
        const plan = planDigest({...notice, task_ids: [], removed: [snap()]}, [], staff(), TODAY);
        expect(plan).toEqual({send: true, staff: staff(), changed: [], others: [], removed: [snap()]});
    });

    it('drops removed entries the recipient owns again', () => {
        const n = {...notice, task_ids: ['t9'], removed: [snap()]};
        const plan = planDigest(n, [task({id: 't9'})], staff(), TODAY);
        expect(plan.send && plan.removed).toEqual([]);
        expect(plan.send && plan.changed.map((t) => t.id)).toEqual(['t9']);
        expect(planDigest({...n, task_ids: []}, [task({id: 't9'})], staff(), TODAY)).toEqual({send: false});
    });

    it('collapses duplicate removed entries to the last snapshot', () => {
        const a = snap({end_date: '2026-10-03'});
        const b = snap({end_date: '2026-10-09'});
        const plan = planDigest({...notice, task_ids: [], removed: [a, snap({task_id: 't8'}), b]}, [], staff(), TODAY);
        expect(plan.send && plan.removed).toEqual([b, snap({task_id: 't8'})]);
    });

    it('keys by cycle and generation', () => {
        expect(digestKey(notice)).toBe('assign-c-3');
        expect(reminderKey('s1', '2026-10-02')).toBe('reminder-s1-2026-10-02');
    });
});

describe('reminderTargets', () => {
    it('groups open tasks ending tomorrow per active staff with email', () => {
        const res = reminderTargets([
            task({id: 'a', end_date: '2026-10-02'}),
            task({id: 'b', end_date: '2026-10-02', progress: 100}),
            task({id: 'c', end_date: '2026-10-03'}),
            task({id: 'd', end_date: '2026-10-02', project_archived: true}),
            task({id: 'e', end_date: '2026-10-02', staff_id: 's2'}),
            task({id: 'f', end_date: '2026-10-02', staff_id: 's3'}),
        ], [staff(), staff({id: 's2', email: null}), staff({id: 's3', archived_at: 'x'})], TODAY);
        expect(res).toHaveLength(1);
        expect(res[0].date).toBe('2026-10-02');
        expect(res[0].tasks.map((t) => t.id)).toEqual(['a']);
    });

    it('is due only between 08:00 and 10:59 ICT', () => {
        expect(reminderDue(7)).toBe(false);
        expect(reminderDue(8)).toBe(true);
        expect(reminderDue(10)).toBe(true);
        expect(reminderDue(11)).toBe(false);
        expect(reminderDue(23)).toBe(false);
        expect(reminderDue(0)).toBe(false);
        // 01:00 UTC = 08:00 ICT; 16:59 UTC on the 30th = 23:59 ICT on the 30th; 17:00 UTC = next day 00:00 ICT
        expect(nowICT(new Date('2026-09-30T01:00:00Z'))).toEqual({today: '2026-09-30', hour: 8});
        expect(nowICT(new Date('2026-09-30T17:00:00Z'))).toEqual({today: '2026-10-01', hour: 0});
    });
});

describe('shouldRetry', () => {
    const now = new Date('2026-10-02T00:00:00Z');
    const row = {status: 'failed', attempts: 2, created_at: '2026-10-01T12:00:00Z'};
    it('retries failed / pending rows inside the window and attempt cap', () => {
        expect(shouldRetry(row, now)).toBe(true);
        expect(shouldRetry({...row, status: 'pending'}, now)).toBe(true);
        expect(shouldRetry({...row, attempts: 5}, now)).toBe(true);
    });
    it('stops after 5 attempts, 23 h, or acceptance', () => {
        expect(shouldRetry({...row, attempts: 6}, now)).toBe(false);
        expect(shouldRetry({...row, created_at: '2026-10-01T00:59:00Z'}, now)).toBe(false);
        expect(shouldRetry({...row, status: 'accepted'}, now)).toBe(false);
    });
});

describe('chunk', () => {
    it('splits into ≤ 100-id chunks', () => {
        const ids = Array.from({length: 250}, (_, i) => String(i));
        expect(chunk(ids).map((c) => c.length)).toEqual([100, 100, 50]);
        expect(chunk(ids).flat()).toEqual(ids);
        expect(chunk([])).toEqual([]);
        expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    });
});

describe('payloadOk', () => {
    const FROM = 'Sino Studio <tracker@web.sinostudio.vn>';
    const p = {from: FROM, to: ['a@b.vn'], subject: 's', html: 'h'};
    it('accepts the configured sender, one recipient = to_email = staff email', () => {
        expect(payloadOk(p, 'a@b.vn', 'a@b.vn', FROM)).toBe(true);
    });
    it('rejects any mismatch', () => {
        expect(payloadOk({...p, from: 'evil@x.vn'}, 'a@b.vn', 'a@b.vn', FROM)).toBe(false);
        expect(payloadOk({...p, to: ['a@b.vn', 'c@d.vn']}, 'a@b.vn', 'a@b.vn', FROM)).toBe(false);
        expect(payloadOk({...p, to: 'a@b.vn'}, 'a@b.vn', 'a@b.vn', FROM)).toBe(false);
        expect(payloadOk({...p, to: ['c@d.vn']}, 'a@b.vn', 'a@b.vn', FROM)).toBe(false);
        expect(payloadOk(p, 'a@b.vn', 'new@b.vn', FROM)).toBe(false); // staff email changed since enqueue
        expect(payloadOk(p, 'a@b.vn', null, FROM)).toBe(false);       // staff removed its email / row gone
        expect(payloadOk(null, 'a@b.vn', 'a@b.vn', FROM)).toBe(false);
    });
});

describe('completionPatch', () => {
    it('retires rejected payloads, keeps ordinary failures retryable', () => {
        expect(completionPatch({status: 'failed', error: 'rejected_payload'}))
            .toEqual({status: 'failed', error: 'rejected_payload', claimed_until: null, attempts: 5});
        expect(completionPatch({status: 'failed', error: 'rate_limit_exceeded: x'}))
            .toEqual({status: 'failed', error: 'rate_limit_exceeded: x', claimed_until: null});
        expect(completionPatch({status: 'accepted', resend_id: 're_1'}))
            .toEqual({status: 'accepted', resend_id: 're_1', error: null, claimed_until: null});
    });
});

describe('bearerOk', () => {
    it('accepts only the exact bearer', () => {
        expect(bearerOk('Bearer s3cret', 's3cret')).toBe(true);
        expect(bearerOk('Bearer s3creT', 's3cret')).toBe(false);
        expect(bearerOk('Bearer s3cret ', 's3cret')).toBe(false);
        expect(bearerOk('s3cret', 's3cret')).toBe(false);
        expect(bearerOk(null, 's3cret')).toBe(false);
        expect(bearerOk('Bearer ', '')).toBe(false);
    });
});
