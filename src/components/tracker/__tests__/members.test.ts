import {describe, expect, it} from 'vitest';
import {boardStaff, memberSet, pickerStaff, shareGroups} from '../members';

const s = (id: string, name: string, sort_order: number, archived = false) =>
    ({id, name, sort_order, archived_at: archived ? '2026-01-01' : null});
const staff = [s('b', 'Bình', 2), s('a', 'An', 1), s('z', 'Zed', 1), s('x', 'Xưa', 3, true), s('o', 'Ô', 4)];
const ids = (list: {id: string}[]) => list.map((x) => x.id);
const depts = [
    {id: 'bg', name: 'BG', color: 'red', sort_order: 20},
    {id: 'an', name: 'Anim', color: 'blue', sort_order: 10},
    {id: 'cl', name: 'Clean', color: 'red', sort_order: 10},
];

describe('memberSet', () => {
    it('groups by staff, orders departments by sort_order then name, drops unknown departments', () => {
        const m = memberSet([
            {project_id: 'p', staff_id: 'a', department_id: 'bg'},
            {project_id: 'p', staff_id: 'a', department_id: 'cl'},
            {project_id: 'p', staff_id: 'a', department_id: 'an'},
            {project_id: 'p', staff_id: 'b', department_id: 'gone'},
        ], depts);
        expect(m).toEqual(new Map([['a', ['an', 'cl', 'bg']]]));
    });
});

describe('boardStaff', () => {
    const members = new Map([['a', []], ['b', []], ['x', []]]);
    it('active members plus month owners (non-member, archived), in studio order', () => {
        const r = boardStaff(staff, members, ['o', 'x']);
        expect(ids(r.rows)).toEqual(['a', 'b', 'x', 'o']);
        expect([...r.assignable].sort()).toEqual(['a', 'b']);
    });
    it('archived member without a task is hidden', () => {
        expect(ids(boardStaff(staff, members, []).rows)).toEqual(['a', 'b']);
    });
    it('ties on sort_order fall back to the name', () => {
        expect(ids(boardStaff(staff, new Map([['z', []], ['a', []]]), []).rows)).toEqual(['a', 'z']);
    });
});

describe('pickerStaff', () => {
    const members = new Map([['b', []], ['x', []]]);
    it('active members plus the current owner', () => {
        expect(ids(pickerStaff(staff, members))).toEqual(['b']);
        expect(ids(pickerStaff(staff, members, 'o'))).toEqual(['b', 'o']);
        expect(ids(pickerStaff(staff, members, 'x'))).toEqual(['b', 'x']);
    });
});

describe('shareGroups', () => {
    const labels = {members: 'M', others: 'O'};
    it('members first, active only', () => {
        expect(shareGroups(staff, new Map([['b', []], ['x', []]]), labels)).toEqual([
            {group: 'M', items: [{value: 'b', label: 'Bình'}]},
            {group: 'O', items: [{value: 'a', label: 'An'}, {value: 'z', label: 'Zed'}, {value: 'o', label: 'Ô'}]},
        ]);
    });
    it('omits empty groups', () => {
        expect(shareGroups(staff, new Map(), labels).map((g) => g.group)).toEqual(['O']);
        const all = new Map(staff.map((x) => [x.id, []]));
        expect(shareGroups(staff, all, labels).map((g) => g.group)).toEqual(['M']);
        expect(shareGroups([], new Map(), labels)).toEqual([]);
    });
});
