// Cut codes: normalisation (mirror of SQL public.tracker_normalize_cut), natural order, bulk ranges.

/**
 * JS mirror of `regexp_replace(upper(regexp_replace(raw, '\s', '', 'g')), '^C0+(?=[0-9])', 'C')`.
 * Whitespace = ASCII [ \t\n\r\f\v] only, as spelled out here: JS `\s` also strips Unicode spaces
 * (NBSP, U+2000…, U+3000) that Postgres ARE `\s` is not relied on to strip. Parity: cutCodes.fixture.json.
 * Known non-ASCII gaps (parity holds for printable ASCII only): JS toUpperCase maps 'ß' → 'SS' where PG
 * upper() does not, and PG `\s` may match Unicode spaces depending on locale. The actions layer rejects
 * cut codes that are not printable ASCII, so these inputs never reach either side.
 */
export function normalizeCutCode(raw: string): string {
    return raw.replace(/[ \t\n\r\f\v]/g, '').toUpperCase().replace(/^C0+(?=[0-9])/, 'C');
}

const collator = new Intl.Collator('en', {numeric: true});

/** Natural order: C2 < C10 < C10A; ties broken by code-unit order so the sort is total. */
export function compareCutCodes(a: string, b: string): number {
    return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** `C{from}`…`C{to}`; requires integers 1 ≤ from ≤ to ≤ 99999 and at most 200 codes. */
export function cutRange(from: number, to: number): string[] {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 99999 || to - from >= 200) {
        throw new RangeError(`invalid cut range ${from}..${to}`);
    }
    return Array.from({length: to - from + 1}, (_, i) => `C${from + i}`);
}
