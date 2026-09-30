// RFC 5545 calendar for one share member. All-day events, stable UIDs, SEQUENCE = task version.
import {addDays, type ISODate} from './dates';

export type IcsEvent = {
    uid: string;
    start: ISODate;
    endInclusive: ISODate;
    summary: string;
    description?: string;
    sequence: number;
    /** Any Date-parsable timestamp (the row's updated_at); written as DTSTAMP and LAST-MODIFIED in UTC. */
    stamp: string;
};

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeText(s: string): string {
    return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n');
}

const utf8Len = (cp: number) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Folds to ≤ 75 octets per physical line (continuations start with a space), never inside a code point. */
export function foldLine(line: string): string {
    const parts: string[] = [];
    let cur = '';
    let octets = 0;
    for (const ch of line) {
        const n = utf8Len(ch.codePointAt(0)!);
        if (octets + n > 75) {
            parts.push(cur);
            cur = ' ';
            octets = 1;
        }
        cur += ch;
        octets += n;
    }
    parts.push(cur);
    return parts.join('\r\n');
}

const date = (d: ISODate) => d.slice(0, 10).replaceAll('-', '');
const utcStamp = (s: string) => new Date(s).toISOString().replace(/\.\d{3}/, '').replace(/[-:]/g, '');

export function buildIcs(calName: string, events: IcsEvent[]): string {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Sino Studio//Tracker//VI',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeText(calName)}`,
    ];
    for (const e of events) {
        const stamp = utcStamp(e.stamp);
        lines.push(
            'BEGIN:VEVENT',
            `UID:${escapeText(e.uid)}`,
            `DTSTAMP:${stamp}`,
            `LAST-MODIFIED:${stamp}`,
            `DTSTART;VALUE=DATE:${date(e.start)}`,
            `DTEND;VALUE=DATE:${date(addDays(e.endInclusive.slice(0, 10), 1))}`,
            `SEQUENCE:${e.sequence}`,
            `SUMMARY:${escapeText(e.summary)}`,
        );
        if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
}
