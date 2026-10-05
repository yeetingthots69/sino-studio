import type {ComboboxItem, ComboboxItemGroup, OptionsFilter} from '@mantine/core';

export type StaffSort = 'studio' | 'az' | 'za';

/** Board staff column filters besides strengths (name query, department ids). */
export type StaffFilter = {name: string; departments: string[]; deptsByStaff: Map<string, readonly string[]>};

/** Accent- and case-insensitive form for name search: "  Nguyễn  Đức " → "nguyen duc". */
export function foldName(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

type Option = ComboboxItem | ComboboxItemGroup<ComboboxItem>;

/** Mantine option filter on `foldName` ("tuan" finds "Tuấn"); groups keep matching items, empty groups are dropped. */
export const foldFilter: OptionsFilter = ({options, search}) => {
    const q = foldName(search);
    const match = (o: Option): Option[] => {
        if ('group' in o) {
            const items = (o.items as Option[]).flatMap(match) as ComboboxItem[];
            return items.length ? [{...o, items}] : [];
        }
        return foldName(o.label).includes(q) ? [o] : [];
    };
    return (options as Option[]).flatMap(match);
};

/**
 * Board staff column view. Filters are ANDed, each empty → everyone: strengths = any selected strength or
 * any all-rounder strength; name = substring of the folded name; departments = any selected department.
 * 'studio' keeps the input order; az/za compare names with the Vietnamese collation.
 */
export function viewStaff<T extends {id: string; name: string}>(
    staff: T[],
    strengthIdsByStaff: Map<string, readonly string[]>,
    allRounderIds: Set<string>,
    opts: {sort: StaffSort; filter: string[]},
    f: StaffFilter,
): T[] {
    const wanted = new Set(opts.filter);
    const depts = new Set(f.departments);
    const query = foldName(f.name);
    const out = staff.filter((s) =>
        (wanted.size === 0 || (strengthIdsByStaff.get(s.id) ?? []).some((id) => wanted.has(id) || allRounderIds.has(id)))
        && (depts.size === 0 || (f.deptsByStaff.get(s.id) ?? []).some((id) => depts.has(id)))
        && (query === '' || foldName(s.name).includes(query)));
    if (opts.sort !== 'studio') {
        const dir = opts.sort === 'az' ? 1 : -1;
        out.sort((a, b) => dir * a.name.localeCompare(b.name, 'vi'));
    }
    return out;
}
