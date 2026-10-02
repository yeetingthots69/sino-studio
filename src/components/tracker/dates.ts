// Pure date helpers for the Gantt board. All dates are 'YYYY-MM-DD'; UTC arithmetic only.
export type ISODate = string;

const DAY = 86_400_000;
const LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

export function toUTC(d: ISODate): number {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
    return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
    return fromUTC(toUTC(d) + n * DAY);
}

export function daysBetween(a: ISODate, b: ISODate): number {
    return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

export function monthRange(m: string): {start: ISODate; end: ISODate; days: number} {
    const [y, mo] = m.split('-').map(Number);
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return {start: `${m}-01`, end: `${m}-${String(days).padStart(2, '0')}`, days};
}

export function isValidMonth(m: unknown): m is string {
    // years 2000–2099 only (bounds public ?m= inputs)
    return typeof m === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(m);
}

export function defaultMonth(now = new Date()): string {
    // en-CA formats as 'YYYY-MM'
    return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit'}).format(now);
}

export function weekdayIndex(d: ISODate): number {
    return new Date(toUTC(d)).getUTCDay();
}

export function weekdayLabel(d: ISODate): (typeof LABELS)[number] {
    return LABELS[weekdayIndex(d)];
}

export function isWeekend(d: ISODate): boolean {
    const i = weekdayIndex(d);
    return i === 0 || i === 6;
}

export function clampToMonth(
    task: {start_date: ISODate; end_date: ISODate},
    m: string,
): {colStart: number; colEnd: number; clippedStart: boolean; clippedEnd: boolean} {
    const {start, end, days} = monthRange(m);
    const clippedStart = task.start_date < start;
    const clippedEnd = task.end_date > end;
    return {
        colStart: clippedStart ? 1 : daysBetween(start, task.start_date) + 1,
        colEnd: clippedEnd ? days : daysBetween(start, task.end_date) + 1,
        clippedStart,
        clippedEnd,
    };
}

/** Lanes per row: tasks of the same cut form one block (span = min start..max end) and share a lane. */
export function assignLanes<T extends {start_date: ISODate; end_date: ISODate; cut_id?: string | null}>(tasks: T[]): Map<T, number> {
    type Block = {tasks: T[]; start: ISODate; end: ISODate; key: string; idx: number};
    const blocks: Block[] = [];
    const byCut = new Map<string, Block>();
    tasks.forEach((t, idx) => {
        const b = t.cut_id != null ? byCut.get(t.cut_id) : undefined;
        if (b) {
            b.tasks.push(t);
            if (t.start_date < b.start) b.start = t.start_date;
            if (t.end_date > b.end) b.end = t.end_date;
            return;
        }
        const nb: Block = {tasks: [t], start: t.start_date, end: t.end_date, key: t.cut_id ?? '', idx};
        blocks.push(nb);
        if (t.cut_id != null) byCut.set(t.cut_id, nb);
    });
    blocks.sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
        || a.key.localeCompare(b.key) || a.idx - b.idx);
    const laneEnds: ISODate[] = [];
    const lanes = new Map<T, number>();
    for (const b of blocks) {
        let lane = laneEnds.findIndex((end) => end < b.start);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = b.end;
        for (const t of b.tasks) lanes.set(t, lane);
    }
    return lanes;
}

/** Free-text month ('10/2026', '2026-10', '10/26', 'T10/2026', 'tháng 10 2026'…) → 'YYYY-MM', or null. */
export function parseMonthInput(text: string): string | null {
    const s = text.normalize('NFC').trim().toLowerCase().replace(/^(tháng|thg|t)\s*/, '');
    const a = /^(\d{1,2})\s*[/\-. ]\s*(\d{4}|\d{2})$/.exec(s);
    const b = a ? null : /^(\d{4})\s*[/\-. ]\s*(\d{1,2})$/.exec(s);
    if (!a && !b) return null;
    const [yy, mo] = a ? [a[2], a[1]] : [b![1], b![2]];
    const y = yy.length === 2 ? `20${yy}` : yy;
    const out = `${y}-${mo.padStart(2, '0')}`;
    return isValidMonth(out) ? out : null;
}

export function shiftMonth(m: string, n: number): string {
    const [y, mo] = m.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
}

/** Today's date and hour in Asia/Ho_Chi_Minh (ICT). */
export function nowICT(now = new Date()): {today: ISODate; hour: number} {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((x) => [x.type, x.value]));
    return {today: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour)};
}
