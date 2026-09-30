import {describe, expect, it} from 'vitest';
import {cleanLinks, isDriveUrl, isHttpsUrl, linkErrors, linksValid, MAX_LINKS, sanitizeLinks, type EditLink} from '../links';

const ok = {label: 'Drive', url: 'https://drive.google.com/x'};

describe('links validation', () => {
    it('accepts only https URLs with a host', () => {
        expect(isHttpsUrl(' https://a.com/x ')).toBe(true);
        expect(isHttpsUrl('http://a.com')).toBe(false);
        expect(isHttpsUrl('HTTPS://a.com')).toBe(false);
        expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
        expect(isHttpsUrl('https://')).toBe(false);
    });

    it('flags label and url per row; a blank row shows no error but is not valid', () => {
        expect(linkErrors({label: '', url: ''})).toEqual({label: false, url: false});
        expect(linkErrors({label: '  ', url: 'http://a'})).toEqual({label: true, url: true});
        expect(linkErrors({label: 'x'.repeat(81), url: ok.url})).toEqual({label: true, url: false});
        expect(linksValid([{label: '', url: ''}])).toBe(false);
        expect(linksValid([ok, {label: ' Brief ', url: 'https://docs.google.com/d'}])).toBe(true);
    });

    it('caps the list at 20', () => {
        expect(linksValid(Array(MAX_LINKS).fill(ok))).toBe(true);
        expect(linksValid(Array(MAX_LINKS + 1).fill(ok))).toBe(false);
    });

    it('trims and detects Drive hosts', () => {
        expect(cleanLinks([{label: ' a ', url: ' https://b.c ', key: 'k'}] as EditLink[])).toEqual([{label: 'a', url: 'https://b.c'}]);
        expect(sanitizeLinks([{label: '  ', url: 'https://a'}, {label: 'x'.repeat(90), url: 'https://a'}]))
            .toEqual([{label: 'x'.repeat(80), url: 'https://a'}]);
        expect(isDriveUrl('https://docs.google.com/doc')).toBe(true);
        expect(isDriveUrl('https://drive.google.com.evil.com/')).toBe(false);
        expect(isDriveUrl('nope')).toBe(false);
    });
});
