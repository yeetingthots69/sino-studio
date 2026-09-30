import {describe, expect, it} from 'vitest';
import {viewStaff} from '../staffView';

const staff = [
    {id: '1', name: 'Vũ Thư'},
    {id: '2', name: 'Tôm'},
    {id: '3', name: 'An'},
    {id: '4', name: 'Đạt'},
];
const strengths = new Map<string, string[]>([['1', ['lo']], ['2', ['ge']], ['3', ['all']]]);
const ALL = new Set(['all']);
const names = (list: {name: string}[]) => list.map((s) => s.name);

describe('viewStaff', () => {
    it('studio order = input order, empty filter = everyone', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: []}))).toEqual(['Vũ Thư', 'Tôm', 'An', 'Đạt']);
    });

    it('sorts with the Vietnamese collation (Đ after D-less names, before T)', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'az', filter: []}))).toEqual(['An', 'Đạt', 'Tôm', 'Vũ Thư']);
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'za', filter: []}))).toEqual(['Vũ Thư', 'Tôm', 'Đạt', 'An']);
    });

    it('filter keeps any selected strength plus all-rounders', () => {
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: ['lo']}))).toEqual(['Vũ Thư', 'An']);
        expect(names(viewStaff(staff, strengths, ALL, {sort: 'studio', filter: ['lo', 'ge']}))).toEqual(['Vũ Thư', 'Tôm', 'An']);
    });

    it('does not mutate the input', () => {
        const input = [...staff];
        viewStaff(input, strengths, ALL, {sort: 'az', filter: []});
        expect(input).toEqual(staff);
    });
});
