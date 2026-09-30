// Sort-order maths for the work-types editor. Rows are kept sorted by sort_order; rows with tasks
// (`used`) must keep their value (the DB refuses a reorder of a used type).
export type OrderRow = {sort_order: number; used: boolean};

/** Insert `row` at `index`: midpoint between neighbours, else renumber unused rows; null when impossible. */
export function insertAt<T extends OrderRow>(rows: T[], index: number, row: T): T[] | null {
    const lo = rows[index - 1]?.sort_order ?? 0;
    const hi = rows[index]?.sort_order ?? lo + 20;
    const mid = Math.floor((lo + hi) / 2);
    const list = [...rows.slice(0, index), {...row, sort_order: mid}, ...rows.slice(index)];
    return mid > lo && mid < hi ? list : renumber(list);
}

/** Move an unused row one step up (-1) or down (+1); it may pass used rows. null when not allowed. */
export function moveRow<T extends OrderRow>(rows: T[], index: number, delta: -1 | 1): T[] | null {
    const target = index + delta;
    if (rows[index].used || target < 0 || target >= rows.length) return null;
    return insertAt(rows.filter((_, i) => i !== index), target, rows[index]);
}

// Each run of unused rows between used rows gets steps of 10 (smaller if the gap is tighter).
function renumber<T extends OrderRow>(list: T[]): T[] | null {
    const out = [...list];
    let prev = 0;
    let start = 0;
    for (let i = 0; i <= out.length; i++) {
        if (i < out.length && !out[i].used) continue;
        const next = i < out.length ? out[i].sort_order : Infinity;
        const step = Math.min(10, Math.floor((next - prev) / (i - start + 1)));
        if (step < 1) return null;
        for (let j = start; j < i; j++) out[j] = {...out[j], sort_order: prev + step * (j - start + 1)};
        if (i < out.length) prev = out[i].sort_order;
        start = i + 1;
    }
    return out;
}
