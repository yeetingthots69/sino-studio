const PAGE = 1000;

/** The slice of a PostgREST select builder that keyset paging needs. */
export interface KeysetQuery<T> {
    gt(column: 'id', value: never): KeysetQuery<T>;
    order(column: 'id'): KeysetQuery<T>;
    limit(count: number): PromiseLike<{data: T[] | null; error: unknown}>;
}

/**
 * Every row of `query()`, keyset-paged on `id` (PostgREST caps each response at max_rows, 1000 on Supabase).
 * No offsets, so rows inserted or deleted between pages are never counted twice or skipped.
 */
export async function selectAll<T extends {id: string | number}>(query: () => KeysetQuery<T>, page = PAGE): Promise<T[]> {
    const out: T[] = [];
    let last: T['id'] | undefined;
    for (;;) {
        const q = query();
        const {data, error} = await (last === undefined ? q : q.gt('id', last as never)).order('id').limit(page);
        if (error) throw error;
        const rows = data ?? [];
        out.push(...rows);
        if (rows.length < page) return out;
        last = rows[rows.length - 1].id;
    }
}
