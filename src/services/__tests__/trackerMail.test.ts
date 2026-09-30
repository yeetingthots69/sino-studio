import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

vi.mock('server-only', () => ({}));
const send = vi.fn();
vi.mock('resend', () => ({Resend: vi.fn(function () { return {emails: {send}}; })}));

const {deliver} = await import('../trackerMail');

const row = {
    idempotency_key: 'assign-c-1',
    payload: {from: 'Sino <a@b.vn>', to: ['x@y.vn'], reply_to: 'm@b.vn', subject: 'S', html: '<p>h</p>'},
};
const ok = {data: {id: 're_1'}, error: null, headers: {}};
const limited = (retryAfter?: string) => ({
    data: null, error: {name: 'rate_limit_exceeded', message: 'Too many', statusCode: 429},
    headers: retryAfter ? {'retry-after': retryAfter} : {},
});

beforeEach(() => {
    send.mockReset();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('deliver', () => {
    it('sends exactly the stored payload with the idempotency key', async () => {
        send.mockResolvedValue(ok);
        await expect(deliver(row)).resolves.toEqual({status: 'accepted', resend_id: 're_1'});
        expect(send).toHaveBeenCalledWith(
            {from: 'Sino <a@b.vn>', to: ['x@y.vn'], replyTo: 'm@b.vn', subject: 'S', html: '<p>h</p>'},
            {idempotencyKey: 'assign-c-1'},
        );
    });

    it('maps a returned {error} to failed', async () => {
        send.mockResolvedValue({data: null, error: {name: 'validation_error', message: 'bad from', statusCode: 422}, headers: {}});
        await expect(deliver(row)).resolves.toEqual({status: 'failed', error: 'validation_error: bad from'});
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('retries once on 429 after retry-after, capped at 5 s', async () => {
        vi.useFakeTimers();
        send.mockResolvedValueOnce(limited('30')).mockResolvedValueOnce(ok);
        const p = deliver(row);
        await vi.advanceTimersByTimeAsync(4_999);
        expect(send).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(p).resolves.toEqual({status: 'accepted', resend_id: 're_1'});
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1][1]).toEqual({idempotencyKey: 'assign-c-1'});
    });

    it('fails after the single 429 retry', async () => {
        vi.useFakeTimers();
        send.mockResolvedValue(limited('1'));
        const p = deliver(row);
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(p).resolves.toEqual({status: 'failed', error: 'rate_limit_exceeded: Too many'});
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('maps a thrown error to failed', async () => {
        send.mockRejectedValue(new Error('socket hang up'));
        await expect(deliver(row)).resolves.toEqual({status: 'failed', error: 'socket hang up'});
    });
});
