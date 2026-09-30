import {describe, expect, it} from 'vitest';
import {selectAll, type KeysetQuery} from '../keyset';

type Row = {id: number};

// Fake builder over a live table: records the calls, applies gt/order/limit.
function fakeTable(table: Row[], calls: string[]): () => KeysetQuery<Row> {
    return () => {
        let after = -Infinity;
        const q: KeysetQuery<Row> = {
            gt: (_c, v) => ((after = v as number), calls.push(`gt ${v}`), q),
            order: () => q,
            limit: (n) => Promise.resolve({
                data: [...table].sort((a, b) => a.id - b.id).filter((r) => r.id > after).slice(0, n),
                error: null,
            }),
        };
        return q;
    };
}

describe('selectAll (keyset)', () => {
    it('pages by last id until a short page', async () => {
        const calls: string[] = [];
        const table = Array.from({length: 7}, (_, i) => ({id: i + 1}));
        expect((await selectAll(fakeTable(table, calls), 3)).map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(calls).toEqual(['gt 3', 'gt 6']);
    });

    it('a row deleted between pages neither shifts nor duplicates the rest', async () => {
        const calls: string[] = [];
        const table = Array.from({length: 6}, (_, i) => ({id: i + 1}));
        const base = fakeTable(table, calls);
        let n = 0;
        const query = () => {
            if (n++ === 1) table.splice(0, 1); // delete id 1 after the first page
            return base();
        };
        expect((await selectAll(query, 3)).map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('throws on error', async () => {
        const q: KeysetQuery<Row> = {gt: () => q, order: () => q, limit: () => Promise.resolve({data: null, error: new Error('x')})};
        await expect(selectAll(() => q)).rejects.toThrow('x');
    });
});
