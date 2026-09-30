import {describe, expect, it, vi} from 'vitest';

vi.mock('@/utils/supabase/client', () => ({getBrowserClient: vi.fn()}));
vi.mock('next/navigation', () => ({useRouter: vi.fn()}));

const {tableKey, setRealtimeBusy, isRealtimeBusy} = await import('../useRealtimeRefresh');

describe('tableKey', () => {
    it('ignores order and duplicates', () => {
        expect(tableKey(['tracker_staff', 'tracker_cuts', 'tracker_staff'])).toBe('tracker_cuts,tracker_staff');
        expect(tableKey(['b', 'a'])).toBe(tableKey(['a', 'b']));
    });
});

describe('busy registry', () => {
    it('is busy while any key is set; clearing the last key only', () => {
        const a = Symbol('a');
        const b = Symbol('b');
        setRealtimeBusy(a, true);
        setRealtimeBusy(b, true);
        setRealtimeBusy(a, false);
        expect(isRealtimeBusy()).toBe(true);
        setRealtimeBusy(b, false);
        expect(isRealtimeBusy()).toBe(false);
        setRealtimeBusy(b, false); // unknown key: no-op
        expect(isRealtimeBusy()).toBe(false);
    });
});
