'use client';

import {useEffect, useRef, useState, type PointerEvent, type RefObject} from 'react';
import {getBrowserClient} from '@/utils/supabase/client';
import {dayIndexFromX} from './dragMath';
import {
    advertisesCell, applyCell, createCellSender, editorsByTask, flattenPresence, groupOthers, parseCellMessage, peerKeys, pruneTags,
    colorFor, type Cell, type CellMessage, type PresenceEntry, type PresencePayload,
} from './presence';

type Channel = ReturnType<ReturnType<typeof getBrowserClient>['channel']>;

/** Pending removeChannel per topic: the board remounts per month and `client.channel(topic)` would reuse a leaving channel. */
const removals = new Map<string, Promise<unknown>>();

/** Test override: own other tabs count as peers for the `cell` send gate (single-account E2E). */
const selfPeer = () => {
    try {
        return localStorage.getItem('tracker.presence.selfPeer') === '1';
    } catch {
        return false;
    }
};

interface Options {
    projectId: string;
    month: string;
    /** Task this tab is editing (dragged, or open with unsaved panel changes). */
    editing: string | null;
    days: number;
    dayWidth: number;
    /** True while a bar is dragged (its captured pointer events bubble to the track). */
    draggingRef: RefObject<boolean>;
}

/**
 * Board presence on the private channel `tracker-board-<projectId>`: who is here (presence), which task
 * each tab is editing (presence payload) and which cell each tab hovers (`cell` broadcasts, sent only
 * while another person is present).
 */
export function useBoardPresence({projectId, month, editing, days, dayWidth, draggingRef}: Options) {
    const [entries, setEntries] = useState<PresenceEntry[]>([]);
    const [tags, setTags] = useState<Map<string, CellMessage>>(() => new Map());
    // this mount's presence key (kept across reconnects; a new month mounts a new board)
    const [selfKey] = useState(() => crypto.randomUUID());

    const editingRef = useRef(editing);
    const scheduleTrackRef = useRef<() => void>(() => {});
    const senderRef = useRef<ReturnType<typeof createCellSender> | null>(null);
    const canSendRef = useRef<() => boolean>(() => false);
    /** Cell under my pointer, tracked even while gated (sent once when a peer arrives). */
    const hoverRef = useRef<Cell | null>(null);

    useEffect(() => {
        editingRef.current = editing;
        scheduleTrackRef.current();
    }, [editing]);

    useEffect(() => {
        const client = getBrowserClient();
        const topic = `tracker-board-${projectId}`;
        const key = selfKey;
        let cancelled = false;
        let channel: Channel | null = null;
        let self: Omit<PresencePayload, 'month' | 'editing'> | null = null;
        let peer = false;
        /** Gate keys at the last sync (reset on teardown). */
        let knownPeers = new Set<string>();
        let attempt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let trackTimer: ReturnType<typeof setTimeout> | undefined;
        /** `editing` last tracked on this channel (undefined = not yet); month is fixed per mount. */
        let tracked: string | null | undefined;
        let forceTrack = false;

        // joined + socket open: a send on a disconnected socket would fall back to HTTP
        const live = () => !!channel && channel.state === 'joined' && client.realtime.isConnected();
        // pointer type gates non-null cells in hover(); clears pass regardless
        const canSend = () => live() && peer && document.visibilityState === 'visible';
        const sender = createCellSender({
            canSend,
            send: (cell) => void channel?.send({type: 'broadcast', event: 'cell', payload: {key, month, cell} satisfies CellMessage}),
        });
        senderRef.current = sender;
        canSendRef.current = canSend;

        const track = () => {
            trackTimer = undefined;
            const force = forceTrack;
            forceTrack = false;
            if (!channel || channel.state !== 'joined' || !self) return;
            if (!force && tracked === editingRef.current) return;
            tracked = editingRef.current;
            void channel.track({...self, month, editing: tracked} satisfies PresencePayload);
        };
        /** `force`: SUBSCRIBED (join / rejoin) always re-tracks. */
        const scheduleTrack = (force = false) => {
            forceTrack ||= force;
            clearTimeout(trackTimer);
            trackTimer = setTimeout(track, 300);
        };
        scheduleTrackRef.current = scheduleTrack;

        const teardown = () => {
            const ch = channel;
            channel = null;
            peer = false;
            knownPeers = new Set();
            sender.reset();
            clearTimeout(trackTimer);
            tracked = undefined;
            forceTrack = false;
            if (!ch) return;
            const p: Promise<unknown> = client.removeChannel(ch).catch(() => undefined).finally(() => {
                if (removals.get(topic) === p) removals.delete(topic);
            });
            removals.set(topic, p);
        };

        const start = async () => {
            // a previous mount (or our own failed channel) may still be leaving this topic
            while (removals.has(topic)) {
                await removals.get(topic);
                if (cancelled) return;
            }
            const {data: {session}} = await client.auth.getSession();
            if (cancelled || !session?.user.email) return;
            await client.realtime.setAuth(session.access_token);
            if (cancelled || removals.has(topic)) {
                if (!cancelled) void start();
                return;
            }
            const u = session.user;
            const email = u.email!.toLowerCase();
            self = {
                email,
                name: (u.user_metadata?.full_name as string | undefined) ?? email,
                avatar: (u.user_metadata?.avatar_url as string | undefined) ?? null,
            };

            const ch: Channel = client.channel(topic, {config: {private: true, presence: {key}, broadcast: {self: false}}});
            channel = ch;
            // listeners before subscribe(); membership is rebuilt from presenceState() on every sync
            ch.on('presence', {event: 'sync'}, () => {
                if (ch !== channel) return;
                const list = flattenPresence(ch.presenceState<PresencePayload>());
                const peers = peerKeys(list, key, email, selfPeer());
                const arrived = [...peers].some((k) => !knownPeers.has(k));
                knownPeers = peers;
                peer = peers.size > 0;
                if (!peer) sender.reset();
                else if (arrived && hoverRef.current && live()) {
                    // a newcomer / reloaded peer has no tag for my resting pointer: advertise it once more
                    sender.set(hoverRef.current);
                    sender.resend();
                }
                setEntries(list);
                setTags((t) => pruneTags(t, list));
            })
                .on('broadcast', {event: 'cell'}, ({payload}) => {
                    const msg = parseCellMessage(payload);
                    if (msg && ch === channel) setTags((t) => applyCell(t, msg));
                })
                .subscribe((status) => {
                    if (cancelled || ch !== channel) return;
                    if (status === 'SUBSCRIBED') {
                        // first join and every rejoin: the server forgets tracked state on reconnect
                        attempt = 0;
                        scheduleTrack(true);
                        return;
                    }
                    // CHANNEL_ERROR / TIMED_OUT / unexpected CLOSED: recreate with a fresh token after backoff
                    teardown();
                    setEntries([]);
                    setTags(new Map());
                    clearTimeout(retryTimer);
                    retryTimer = setTimeout(() => void start(), Math.min(30_000, 1000 * 2 ** attempt++));
                });
        };
        void start();

        const onVisibility = () => {
            // one clear for an advertised cell (the only send allowed while hidden), then nothing
            if (document.visibilityState === 'visible') return;
            hoverRef.current = null;
            sender.clearNow(live() && peer);
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibility);
            clearTimeout(retryTimer);
            scheduleTrackRef.current = () => {};
            canSendRef.current = () => false;
            senderRef.current = null;
            teardown();
        };
    }, [projectId, month, selfKey]);

    const leave = () => {
        hoverRef.current = null;
        senderRef.current?.set(null);
    };
    const hover = (e: PointerEvent<HTMLElement>, staffId: string) => {
        // touch never advertises a cell; switching to it clears one already advertised
        if (!advertisesCell(e.pointerType)) return leave();
        // captured pointers (drag-create on this track, bar drags bubbling up) report the wrong row
        if (draggingRef.current || e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const left = e.currentTarget.getBoundingClientRect().left;
        const cell = {staffId, day: dayIndexFromX(e.clientX - left, dayWidth, days)};
        hoverRef.current = cell;
        if (canSendRef.current()) senderRef.current?.set(cell);
    };

    const present = new Set(entries.map((e) => e.key));
    const byKey = new Map(entries.map((e) => [e.key, e]));
    const cells = [...tags.values()].flatMap((m) => {
        const who = byKey.get(m.key);
        return m.cell && m.month === month && who && m.key !== selfKey && present.has(m.key)
            ? [{key: m.key, staffId: m.cell.staffId, day: m.cell.day, name: who.name, color: colorFor(who.email)}]
            : [];
    });

    return {
        people: groupOthers(entries, selfKey),
        editors: editorsByTask(entries, selfKey),
        cells,
        hover,
        leave,
    };
}
