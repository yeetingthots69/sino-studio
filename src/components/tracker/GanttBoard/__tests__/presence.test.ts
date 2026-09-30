import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    advertisesCell, applyCell, colorFor, createCellSender, groupOthers, parseCellMessage, peerKeys, pruneTags, PRESENCE_COLORS,
    type Cell, type CellMessage, type PresenceEntry,
} from '../presence';

const entry = (key: string, email: string, month = '2026-09', editing: string | null = null): PresenceEntry =>
    ({key, email, name: email.split('@')[0], avatar: null, month, editing});

describe('colorFor', () => {
    it('is stable and from the palette', () => {
        expect(colorFor('a@sinostudio.vn')).toBe(colorFor('a@sinostudio.vn'));
        expect(PRESENCE_COLORS).toContain(colorFor('b@sinostudio.vn'));
    });
});

describe('groupOthers', () => {
    it('groups by email and excludes only my own key', () => {
        const people = groupOthers([
            entry('me', 'a@x'),
            entry('me2', 'a@x', '2026-10'),
            entry('b1', 'b@x'),
            entry('b2', 'b@x'),
        ], 'me');
        expect(people.map((p) => p.email)).toEqual(['a@x', 'b@x']);
        expect(people[0].months).toEqual(['2026-10']);
        expect(people[1].months).toEqual(['2026-09']);
    });
});

const hasPeer = (...a: Parameters<typeof peerKeys>) => peerKeys(...a).size > 0;

describe('peerKeys (send gate)', () => {
    it('own other tabs do not enable sends, another email does', () => {
        expect(hasPeer([entry('me', 'a@x'), entry('me2', 'a@x')], 'me', 'a@x', false)).toBe(false);
        expect(hasPeer([entry('me', 'a@x'), entry('b', 'b@x')], 'me', 'a@x', false)).toBe(true);
    });
    it('selfPeer override counts own other tabs, never my own key', () => {
        expect(hasPeer([entry('me', 'a@x'), entry('me2', 'a@x')], 'me', 'a@x', true)).toBe(true);
        expect(hasPeer([entry('me', 'a@x')], 'me', 'a@x', true)).toBe(false);
    });
});

describe('cell tags', () => {
    it('validates payloads, applies cells and clears, prunes absent keys', () => {
        expect(parseCellMessage({key: 'k', month: '2026-09', cell: {staffId: 's', day: -1}})).toBeNull();
        expect(parseCellMessage('x')).toBeNull();
        const msg = parseCellMessage({key: 'k', month: '2026-09', cell: {staffId: 's', day: 3}})!;
        let tags = applyCell(new Map(), msg);
        expect(tags.get('k')?.cell).toEqual({staffId: 's', day: 3});
        expect(pruneTags(tags, [entry('k', 'b@x')])).toBe(tags);
        expect(pruneTags(tags, []).size).toBe(0);
        tags = applyCell(tags, {key: 'k', month: '2026-09', cell: null} satisfies CellMessage);
        expect(tags.size).toBe(0);
    });
});

describe('createCellSender', () => {
    let sent: (Cell | null)[];
    let open: boolean;
    let sender: ReturnType<typeof createCellSender>;
    beforeEach(() => {
        vi.useFakeTimers();
        sent = [];
        open = true;
        sender = createCellSender({send: (c) => sent.push(c), canSend: () => open});
    });
    afterEach(() => vi.useRealTimers());

    it('sends at most once per 250 ms, the latest cell, and never re-sends the same cell', () => {
        for (let d = 0; d < 10; d++) {
            sender.set({staffId: 's', day: d});
            vi.advanceTimersByTime(50);
        }
        vi.advanceTimersByTime(250);
        expect(sent.length).toBeLessThanOrEqual(3); // 750 ms of motion
        expect(sent.at(-1)).toEqual({staffId: 's', day: 9});
        const n = sent.length;
        sender.set({staffId: 's', day: 9});
        vi.advanceTimersByTime(500);
        expect(sent.length).toBe(n);
    });

    it('coalesces a row leave + enter and sends a clear only after a non-null cell', () => {
        sender.set(null);
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([]);
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        sender.set(null);
        sender.set({staffId: 'b', day: 1});
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([{staffId: 'a', day: 1}, {staffId: 'b', day: 1}]);
        sender.set(null);
        vi.advanceTimersByTime(300);
        expect(sent.at(-1)).toBeNull();
    });

    it('tab hidden: exactly one immediate clear for an advertised cell, only when allowed, then nothing', () => {
        sender.clearNow(true);
        expect(sent).toEqual([]); // nothing advertised
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        sender.set({staffId: 'a', day: 2}); // pending, dropped
        sender.clearNow(true);
        expect(sent).toEqual([{staffId: 'a', day: 1}, null]);
        sender.clearNow(true);
        vi.advanceTimersByTime(300);
        expect(sent).toHaveLength(2);
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        sender.clearNow(false); // not joined / no peer: no clear
        expect(sent).toHaveLength(3);
    });

    it('peer arrival: after a reset the resting cell is sent again once', () => {
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        sender.reset(); // last peer left
        sender.set({staffId: 'a', day: 1}); // new peer, pointer still on the same cell
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([{staffId: 'a', day: 1}, {staffId: 'a', day: 1}]);
    });

    it('pointer switch to touch: a non-null cell is blocked, the clear still goes out', () => {
        expect(advertisesCell('mouse')).toBe(true);
        expect(advertisesCell('pen')).toBe(true);
        expect(advertisesCell('touch')).toBe(false);
        sender.set({staffId: 'a', day: 1}); // mouse
        vi.advanceTimersByTime(300);
        // touch move: hover() calls set(null) instead of set(cell); the gate carries no pointer type
        sender.set(null);
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([{staffId: 'a', day: 1}, null]);
    });

    it('peer keys: a reloaded peer shows up as a new key', () => {
        expect([...peerKeys([entry('me', 'a@x'), entry('b1', 'b@x'), entry('c', 'c@x')], 'me', 'a@x', false)]).toEqual(['b1', 'c']);
    });

    it('resend: re-sends the advertised cell once, no-op after a clear or with nothing advertised', () => {
        sender.resend();
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([]);
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        sender.set({staffId: 'a', day: 1}); // what the hook does first: deduped
        sender.resend();
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([{staffId: 'a', day: 1}, {staffId: 'a', day: 1}]);
        vi.advanceTimersByTime(1000);
        expect(sent).toHaveLength(2); // once only
        sender.set(null);
        vi.advanceTimersByTime(300);
        sender.resend();
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([{staffId: 'a', day: 1}, {staffId: 'a', day: 1}, null]);
    });

    it('resend goes through the gate', () => {
        sender.set({staffId: 'a', day: 1});
        vi.advanceTimersByTime(300);
        open = false;
        sender.resend();
        vi.advanceTimersByTime(300);
        expect(sent).toHaveLength(1);
    });

    it('re-checks the gate before sending and cancels pending sends', () => {
        sender.set({staffId: 'a', day: 1});
        open = false;
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([]);
        open = true;
        sender.set({staffId: 'a', day: 2});
        sender.clearNow(false);
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([]);
        sender.set({staffId: 'a', day: 3});
        sender.reset();
        vi.advanceTimersByTime(300);
        expect(sent).toEqual([]);
    });
});
