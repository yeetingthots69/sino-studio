import type {Tables} from '@/types/database.types';

export type MemberRow = Pick<Tables<'tracker_member_departments'>, 'project_id' | 'staff_id' | 'department_id'>;
export type Department = Pick<Tables<'tracker_departments'>, 'id' | 'name' | 'color' | 'sort_order'>;
type Staff = {id: string; name: string; sort_order: number; archived_at: string | null};

/** Staff order used by the board page query: sort_order, then name. */
const byStudio = (a: Staff, b: Staff) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi');

/** staff id → department ids (department sort_order, then name); rows of unknown departments are dropped. */
export function memberSet(rows: MemberRow[], departments: Department[]): Map<string, string[]> {
    const ordered = [...departments].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'vi'));
    const rank = new Map(ordered.map((d, i) => [d.id, i]));
    const out = new Map<string, string[]>();
    for (const r of rows) {
        if (!rank.has(r.department_id)) continue;
        out.set(r.staff_id, [...(out.get(r.staff_id) ?? []), r.department_id]);
    }
    for (const ids of out.values()) ids.sort((a, b) => rank.get(a)! - rank.get(b)!);
    return out;
}

/** Board rows = active members ∪ staff owning a shown task (archived or not); assignable = active members. */
export function boardStaff<T extends Staff>(
    allStaff: T[],
    members: Map<string, unknown>,
    ownerIds: Iterable<string>,
): {rows: T[]; assignable: Set<string>} {
    const owners = new Set(ownerIds);
    const assignable = new Set(allStaff.filter((s) => s.archived_at == null && members.has(s.id)).map((s) => s.id));
    const rows = allStaff.filter((s) => assignable.has(s.id) || owners.has(s.id)).sort(byStudio);
    return {rows, assignable};
}

/** Assignee options: active members plus the current owner (kept even when archived or not a member). */
export function pickerStaff<T extends Staff>(allStaff: T[], members: Map<string, unknown>, currentOwner?: string): T[] {
    return allStaff
        .filter((s) => (s.archived_at == null && members.has(s.id)) || s.id === currentOwner)
        .sort(byStudio);
}

/** Mantine grouped Select data: active members first, other active staff below; empty groups omitted. */
export function shareGroups(
    allStaff: Staff[],
    members: Map<string, unknown>,
    labels: {members: string; others: string},
): {group: string; items: {value: string; label: string}[]}[] {
    const active = allStaff.filter((s) => s.archived_at == null).sort(byStudio);
    const item = (s: Staff) => ({value: s.id, label: s.name});
    return [
        {group: labels.members, items: active.filter((s) => members.has(s.id)).map(item)},
        {group: labels.others, items: active.filter((s) => !members.has(s.id)).map(item)},
    ].filter((g) => g.items.length > 0);
}
