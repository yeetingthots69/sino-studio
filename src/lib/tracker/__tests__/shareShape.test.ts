import {describe, expect, it} from 'vitest';
import {dateRange, icsSummary, sanitizeLinks, shapeShare, shareScope, toIcsTask} from '../shareShape';

const type = (id: string, sort_order: number) =>
    ({id, code: id.toUpperCase(), label: id, color: '#000000', sort_order, pay_pct: 30, project_id: 'p'});

describe('shapeShare', () => {
    const dto = shapeShare({
        project: {name: 'Demo', budget: 5} as {name: string},
        month: '2026-10',
        staff: [{id: 's1', name: 'An', email: 'an@x.vn'} as {id: string; name: string}],
        types: [type('ge', 20), type('lo', 10), type('sh', 30)],
        cuts: [
            {id: 'c1', code: 'C1', links: [{label: 'Drive', url: 'https://d'}], budget: 9} as {id: string; code: string; links: unknown},
            {id: 'c2', code: 'C2', links: []},
        ],
        tasks: [
            {id: 't1', staff_id: 's1', cut_id: 'c1', work_type_id: 'ge', start_date: '2026-10-01', end_date: '2026-10-03', progress: 50, links: null, is_fix: false},
            {id: 't2', staff_id: 's1', cut_id: 'c1', work_type_id: 'lo', start_date: '2026-09-20', end_date: '2026-09-30', progress: 100, links: [], is_fix: true},
            {id: 'tx', staff_id: 'other', cut_id: 'c2', work_type_id: 'sh', start_date: '2026-10-01', end_date: '2026-10-02', progress: 0, links: [], is_fix: false},
        ],
    });

    it('drops tasks of staff outside the share and unreferenced cuts/types', () => {
        expect(dto.tasks.map((t) => t.id)).toEqual(['t1', 't2']);
        expect(dto.cuts.map((c) => c.id)).toEqual(['c1']);
        expect(dto.types.map((t) => t.id)).toEqual(['lo', 'ge']);
    });

    it('never carries budget, pay % or email', () => {
        const json = JSON.stringify(dto);
        for (const k of ['budget', 'pay_pct', 'email', 'an@x.vn', 'project_id']) expect(json).not.toContain(k);
    });
});

describe('sanitizeLinks', () => {
    it('keeps only https links with label and url', () => {
        expect(sanitizeLinks([
            {label: 'ok', url: 'https://a', extra: 1},
            {label: 'js', url: 'javascript:alert(1)'},
            {url: 'https://b'},
            null,
        ])).toEqual([{label: 'ok', url: 'https://a'}]);
        expect(sanitizeLinks({})).toEqual([]);
    });
});

it('dateRange formats dd/mm–dd/mm', () => {
    expect(dateRange('2026-09-28', '2026-10-02')).toBe('28/09–02/10');
});

describe('shareScope', () => {
    const row = {project_id: 'p', staff_ids: ['s1'], revoked_at: null, project: {name: 'Demo', archived_at: null}};
    it('passes an active share of an active project, name only', () => {
        expect(shareScope(row)).toEqual({project_id: 'p', staff_ids: ['s1'], project: {name: 'Demo'}});
    });
    it('rejects missing, revoked, project-less and archived-project shares', () => {
        expect(shareScope(null)).toBeNull();
        expect(shareScope({...row, revoked_at: '2026-09-30T00:00:00Z'})).toBeNull();
        expect(shareScope({...row, project: null})).toBeNull();
        expect(shareScope({...row, project: {name: 'Demo', archived_at: '2026-09-30T00:00:00Z'}})).toBeNull();
    });
});

describe('fix tasks (v2.6)', () => {
    it('forwards is_fix in the share DTO', () => {
        const dto = shapeShare({
            project: {name: 'Demo'}, month: '2026-10', staff: [{id: 's1', name: 'An'}], types: [type('lo', 10)], cuts: [],
            tasks: [{id: 't1', staff_id: 's1', cut_id: 'c1', work_type_id: 'lo', start_date: '2026-10-01', end_date: '2026-10-01', progress: 0, links: [], is_fix: true}],
        });
        expect(dto.tasks[0].is_fix).toBe(true);
    });

    it('maps an ICS DB row with is_fix and labels the summary', () => {
        const row = {
            id: 't1', start_date: '2026-10-01', end_date: '2026-10-02', links: null, version: 3, updated_at: '2026-10-01T00:00:00Z',
            is_fix: true, cut: {code: 'F1'}, type: {code: 'LO'},
        };
        const fix = toIcsTask(row);
        expect(fix.is_fix).toBe(true);
        expect(icsSummary(fix)).toBe('F1 · LO · Fix');
        expect(icsSummary(toIcsTask({...row, is_fix: false}))).toBe('F1 · LO');
    });
});
