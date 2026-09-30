/** Pure helpers for board presence (useBoardPresence): colours, grouping, send gate, cell tags, cell sender. */

export type PresencePayload = {email: string; name: string; avatar: string | null; month: string; editing: string | null};
export type PresenceEntry = PresencePayload & {key: string};
export type Cell = {staffId: string; day: number};
/** Broadcast `cell`: `day` is the 0-based day index in `month` (YYYY-MM). */
export type CellMessage = {key: string; month: string; cell: Cell | null};
export type Person = {email: string; name: string; avatar: string | null; color: string; months: string[]};

export const PRESENCE_COLORS = ['blue', 'grape', 'teal', 'orange', 'cyan', 'lime', 'pink', 'indigo'] as const;

/** Deterministic Mantine colour name for an email. */
export function colorFor(email: string): string {
    let h = 0;
    for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}

export const cssColor = (color: string) => `var(--mantine-color-${color}-filled)`;

/** presenceState() → one entry per key (the latest meta wins). */
export function flattenPresence(state: Record<string, PresencePayload[]>): PresenceEntry[] {
    const out: PresenceEntry[] = [];
    for (const [key, metas] of Object.entries(state)) {
        const m = metas[metas.length - 1];
        if (m && typeof m.email === 'string') out.push({key, email: m.email, name: m.name, avatar: m.avatar ?? null, month: m.month, editing: m.editing ?? null});
    }
    return out;
}

/** Every presence key but mine, one person per email (own other tabs included). */
export function groupOthers(entries: PresenceEntry[], selfKey: string): Person[] {
    const byEmail = new Map<string, Person>();
    for (const e of entries) {
        if (e.key === selfKey) continue;
        const p = byEmail.get(e.email);
        if (!p) byEmail.set(e.email, {email: e.email, name: e.name, avatar: e.avatar, color: colorFor(e.email), months: [e.month]});
        else if (!p.months.includes(e.month)) p.months.push(e.month);
    }
    return [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Keys that open the send gate: another person (email ≠ mine); `selfPeer` (test override) also counts own
 * other tabs. Gate = non-empty; a new key (reload, newcomer) gets my resting cell re-sent.
 */
export function peerKeys(entries: PresenceEntry[], selfKey: string, selfEmail: string, selfPeer: boolean): Set<string> {
    return new Set(entries.filter((e) => e.email !== selfEmail || (selfPeer && e.key !== selfKey)).map((e) => e.key));
}

/** Task id → who is editing it (other keys only). */
export function editorsByTask(entries: PresenceEntry[], selfKey: string): Map<string, {name: string; color: string}> {
    const m = new Map<string, {name: string; color: string}>();
    for (const e of entries) {
        if (e.key !== selfKey && e.editing && !m.has(e.editing)) m.set(e.editing, {name: e.name, color: colorFor(e.email)});
    }
    return m;
}

/** Validates an untrusted broadcast payload. */
export function parseCellMessage(p: unknown): CellMessage | null {
    if (!p || typeof p !== 'object') return null;
    const {key, month, cell} = p as Record<string, unknown>;
    if (typeof key !== 'string' || typeof month !== 'string') return null;
    if (cell === null) return {key, month, cell: null};
    if (!cell || typeof cell !== 'object') return null;
    const {staffId, day} = cell as Record<string, unknown>;
    if (typeof staffId !== 'string' || typeof day !== 'number' || !Number.isInteger(day) || day < 0) return null;
    return {key, month, cell: {staffId, day}};
}

/** A clear removes the sender's tag, a cell replaces it. */
export function applyCell(tags: Map<string, CellMessage>, msg: CellMessage): Map<string, CellMessage> {
    const next = new Map(tags);
    if (msg.cell) next.set(msg.key, msg);
    else next.delete(msg.key);
    return next;
}

/** After a sync: drop tags whose key is gone (same map when nothing changed). */
export function pruneTags(tags: Map<string, CellMessage>, entries: PresenceEntry[]): Map<string, CellMessage> {
    const keys = new Set(entries.map((e) => e.key));
    if ([...tags.keys()].every((k) => keys.has(k))) return tags;
    return new Map([...tags].filter(([k]) => keys.has(k)));
}

/** Only mouse and pen advertise a cell (touch has no hover); clears go out for any pointer. */
export const advertisesCell = (pointerType: string) => pointerType === 'mouse' || pointerType === 'pen';

const sameCell = (a: Cell | null, b: Cell | null) => a === b || (!!a && !!b && a.staffId === b.staffId && a.day === b.day);

/**
 * Trailing throttle for `cell` broadcasts: a change is sent `interval` ms after it starts (so a row
 * leave + enter coalesce), at most one send per interval; the same cell is never re-sent and a clear
 * goes out only after a non-null cell was advertised. `canSend` is re-checked right before every send.
 */
export function createCellSender(opts: {send: (cell: Cell | null) => void; canSend: () => boolean; interval?: number}) {
    const interval = opts.interval ?? 250;
    let advertised: Cell | null = null;
    let desired: Cell | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let force = false;

    const flush = () => {
        timer = undefined;
        const forced = force;
        force = false;
        if ((!forced && sameCell(desired, advertised)) || !opts.canSend()) return;
        advertised = desired;
        opts.send(desired);
    };

    return {
        set(cell: Cell | null) {
            if (timer === undefined && sameCell(cell, advertised)) return;
            desired = cell;
            if (timer === undefined) timer = setTimeout(flush, interval);
        },
        /**
         * Re-sends the advertised cell once (a peer joined or reloaded) through the throttle and gate,
         * bypassing the dedupe; no-op when nothing is advertised. A pending change is sent instead.
         */
        resend() {
            if (!advertised) return;
            force = true;
            if (timer === undefined) {
                desired = advertised;
                timer = setTimeout(flush, interval);
            }
        },
        /**
         * Tab hidden: drops any pending send and, when `allowed` (joined + peer present; the visible check
         * is waived here only), sends exactly one clear for an advertised cell; nothing is advertised after.
         */
        clearNow(allowed: boolean) {
            clearTimeout(timer);
            timer = undefined;
            if (advertised && allowed) opts.send(null);
            desired = advertised = null;
        },
        /** Cancel + forget what was advertised (peers gone, disconnect, unmount). */
        reset() {
            clearTimeout(timer);
            timer = undefined;
            desired = advertised = null;
        },
    };
}
