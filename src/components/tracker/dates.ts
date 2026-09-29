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
    return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
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

export function assignLanes<T extends {start_date: ISODate; end_date: ISODate}>(tasks: T[]): Map<T, number> {
    const sorted = [...tasks].sort((a, b) =>
        a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
    const laneEnds: ISODate[] = [];
    const lanes = new Map<T, number>();
    for (const t of sorted) {
        let lane = laneEnds.findIndex((end) => end < t.start_date);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = t.end_date;
        lanes.set(t, lane);
    }
    return lanes;
}
