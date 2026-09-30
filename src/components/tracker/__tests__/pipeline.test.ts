import {describe, expect, it} from 'vitest';
import {orderConflict, type StageTask} from '../pipeline';

const ORDER = new Map([['LO', 10], ['GE', 20], ['DS', 30]]);
const t = (id: string, type: string, start: string, end: string, cut = 'c1'): StageTask =>
    ({id, cut_id: cut, work_type_id: type, start_date: start, end_date: end});

describe('orderConflict', () => {
    const lo = t('lo', 'LO', '2026-10-01', '2026-10-05');

    it('earlier stage ending on the candidate start day conflicts (equal dates)', () => {
        expect(orderConflict([lo], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-08'))).toBe(lo);
        expect(orderConflict([lo], ORDER, t('ge', 'GE', '2026-10-06', '2026-10-08'))).toBeNull();
    });

    it('later stage starting on the candidate end day conflicts', () => {
        const ge = t('ge', 'GE', '2026-10-06', '2026-10-08');
        expect(orderConflict([lo, ge], ORDER, {...lo, end_date: '2026-10-06'})).toBe(ge);
        expect(orderConflict([lo, ge], ORDER, lo)).toBeNull();
    });

    it('missing middle stage is fine (DO + SH without GE)', () => {
        expect(orderConflict([lo], ORDER, t('ds', 'DS', '2026-10-06', '2026-10-09'))).toBeNull();
        expect(orderConflict([lo], ORDER, t('ds', 'DS', '2026-10-05', '2026-10-09'))).toBe(lo);
    });

    it('returns the conflicting task with the lowest type order (SQL order by sort_order)', () => {
        const ds = t('ds', 'DS', '2026-10-02', '2026-10-09');
        const ge = t('ge', 'GE', '2026-10-01', '2026-10-09');
        expect(orderConflict([ds, lo], ORDER, ge)).toBe(lo);
        expect(orderConflict([ds, ge], ORDER, {...lo, end_date: '2026-10-09'})).toBe(ge);
    });

    it('ignores the same id, other cuts and unordered types', () => {
        expect(orderConflict([lo], ORDER, {...lo, start_date: '2026-10-02'})).toBeNull();
        expect(orderConflict([t('x', 'LO', '2026-10-01', '2026-10-09', 'c2')], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-06'))).toBeNull();
        expect(orderConflict([t('x', 'ZZ', '2026-10-01', '2026-10-09')], ORDER, t('ge', 'GE', '2026-10-05', '2026-10-06'))).toBeNull();
        expect(orderConflict([lo], ORDER, t('z', 'ZZ', '2026-10-01', '2026-10-09'))).toBeNull();
    });
});
