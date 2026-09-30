// Link rows for project / cut / task (plan §3.3: ≤ 20, label 1–80 trimmed, https:// only).
import type {ShareLink as Link} from '@/lib/tracker/shareShape';

export {sanitizeLinks} from '@/lib/tracker/shareShape';
export type {Link};

export const MAX_LINKS = 20;
export const MAX_LABEL = 80;

export function isHttpsUrl(raw: string): boolean {
    const url = raw.trim();
    if (!url.startsWith('https://')) return false;
    try {
        return new URL(url).hostname.length > 0;
    } catch {
        return false;
    }
}

export const labelValid = (label: string) => label.trim().length > 0 && label.trim().length <= MAX_LABEL;

/** Per-row errors; a blank new row shows none but still blocks saving (see linksValid). */
export function linkErrors(row: Link): {label: boolean; url: boolean} {
    const touched = row.label.trim() !== '' || row.url.trim() !== '';
    return {label: touched && !labelValid(row.label), url: touched && !isHttpsUrl(row.url)};
}

export const linksValid = (rows: Link[]) =>
    rows.length <= MAX_LINKS && rows.every((r) => labelValid(r.label) && isHttpsUrl(r.url));

/** Editor row: `key` is a client-only React key, stripped by cleanLinks. */
export type EditLink = Link & {key?: string};

/** Trims and drops editor-only fields (row keys). */
export const cleanLinks = (rows: Link[]): Link[] => rows.map((r) => ({label: r.label.trim(), url: r.url.trim()}));

export function isDriveUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname;
        return host === 'drive.google.com' || host === 'docs.google.com';
    } catch {
        return false;
    }
}
