import {describe, expect, it} from 'vitest';
import {buildIcs, escapeText, foldLine} from '../ics';

const octets = (s: string) => new TextEncoder().encode(s).length;

describe('ics', () => {
    it('escapes TEXT per RFC 5545', () => {
        expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
    });

    it('folds at 75 octets without splitting UTF-8 characters', () => {
        const line = 'DESCRIPTION:' + 'Lịch làm việc — cảnh 🎬 '.repeat(10);
        const folded = foldLine(line);
        const parts = folded.split('\r\n');
        expect(parts.length).toBeGreaterThan(1);
        for (const p of parts) expect(octets(p)).toBeLessThanOrEqual(75);
        for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
        expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line); // unfold = original, no lone surrogates
        expect(foldLine('x'.repeat(75))).toBe('x'.repeat(75));
    });

    it('builds all-day events with exclusive DTEND, SEQUENCE and UTC DTSTAMP', () => {
        const ics = buildIcs('Sino, Demo', [{
            uid: 't1@sinostudio.vn',
            start: '2026-09-28',
            endInclusive: '2026-09-30',
            summary: 'C12 · GE',
            description: 'https://a.example/x\nhttps://b.example/y',
            sequence: 3,
            stamp: '2026-09-30T13:56:20.123456+07:00',
        }]);
        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
        expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/);
        const lines = ics.split('\r\n');
        expect(lines).toContain('X-WR-CALNAME:Sino\\, Demo');
        expect(lines).toContain('DTSTART;VALUE=DATE:20260928');
        expect(lines).toContain('DTEND;VALUE=DATE:20261001');
        expect(lines).toContain('SEQUENCE:3');
        expect(lines).toContain('DTSTAMP:20260930T065620Z');
        expect(lines).toContain('SUMMARY:C12 · GE');
        expect(lines).toContain('DESCRIPTION:https://a.example/x\\nhttps://b.example/y');
    });
});
