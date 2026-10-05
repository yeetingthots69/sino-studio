import {describe, expect, it} from 'vitest';
import {foldName, viewStaff} from '../staffView';

const staff = [
    {id: '1', name: 'Vũ Thư'},
    {id: '2', name: 'Tôm'},
    {id: '3', name: 'An'},
    {id: '4', name: 'Đạt'},
];
const strengths = new Map<string, string[]>([['1', ['lo']], ['2', ['ge']], ['3', ['all']]]);
const ALL = new Set(['all']);
const NONE = {name: '', departments: [], deptsByStaff: new Map<string, string[]>()};
const names = (list: {name: string}[]) => list.map((s) => s.name);

describe('viewStaff', () => {
    it('studio order = input order, empty filter = everyone', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: []}, NONE))).toEqual(['Vũ Thư', 'Tôm', 'An', 'Đạt']);
    });

    it('sorts with the Vietnamese collation (Đ after D-less names, before T)', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'az', filter: []}, NONE))).toEqual(['An', 'Đạt', 'Tôm', 'Vũ Thư']);
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'za', filter: []}, NONE))).toEqual(['Vũ Thư', 'Tôm', 'Đạt', 'An']);
    });

    it('filter keeps any selected strength plus all-rounders', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: ['lo']}, NONE))).toEqual(['Vũ Thư', 'An']);
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: ['lo', 'ge']}, NONE))).toEqual(['Vũ Thư', 'Tôm', 'An']);
    });

    it('does not mutate the input', () => {
        const input = [...staff];
        viewStaff(input, strengths, ALL, {sort: 'az', filter: []}, NONE);
        expect(input).toEqual(staff);
    });
});

describe('foldName', () => {
    it('strips accents, maps đ, lowercases and collapses whitespace', () => {
        expect(foldName('Tuấn')).toBe('tuan');
        expect(foldName('Đức')).toBe('duc');
        expect(foldName('  Nguyễn  Văn  ')).toBe('nguyen van');
    });
});

describe('viewStaff name + department filters', () => {
    const deptsByStaff = new Map<string, string[]>([['1', ['bg']], ['2', ['an', 'bg']], ['4', ['an']]]);
    const view = (name: string, departments: string[], filter: string[] = []) =>
        names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter}, {name, departments, deptsByStaff}));

    it('name matches folded substrings; blank query = everyone', () => {
        expect(view('dat', [])).toEqual(['Đạt']);
        expect(view('  VU  th', [])).toEqual(['Vũ Thư']);
        expect(view('   ', [])).toEqual(['Vũ Thư', 'Tôm', 'An', 'Đạt']);
    });

    it('departments any-of; staff without departments drop out', () => {
        expect(view('', ['an'])).toEqual(['Tôm', 'Đạt']);
        expect(view('', ['an', 'bg'])).toEqual(['Vũ Thư', 'Tôm', 'Đạt']);
    });

    it('name, department and strength are ANDed', () => {
        expect(view('', ['bg'], ['ge'])).toEqual(['Tôm']);
        expect(view('t', ['an', 'bg'], ['lo'])).toEqual(['Vũ Thư']);
        expect(view('tom', ['bg'], ['lo'])).toEqual([]);
    });
});
