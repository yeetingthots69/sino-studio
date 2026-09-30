export type StaffSort = 'studio' | 'az' | 'za';

/**
 * Board staff column view. filter empty → everyone; else staff holding any selected strength or any
 * all-rounder strength. 'studio' keeps the input order; az/za compare names with the Vietnamese collation.
 */
export function viewStaff<T extends {id: string; name: string}>(
    staff: T[],
    strengthIdsByStaff: Map<string, readonly string[]>,
    allRounderIds: Set<string>,
    opts: {sort: StaffSort; filter: string[]},
): T[] {
    const wanted = new Set(opts.filter);
    const out = wanted.size === 0
        ? [...staff]
        : staff.filter((s) => (strengthIdsByStaff.get(s.id) ?? []).some((id) => wanted.has(id) || allRounderIds.has(id)));
    if (opts.sort !== 'studio') {
        const dir = opts.sort === 'az' ? 1 : -1;
        out.sort((a, b) => dir * a.name.localeCompare(b.name, 'vi'));
    }
    return out;
}
