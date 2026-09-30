'use client';

import {useSyncExternalStore} from 'react';
import {DEFAULT_PREFS, parsePrefs, type BoardPrefs} from './boardHelpers';

const KEY = 'tracker.board.v1';
const listeners = new Set<() => void>();
// used when storage is unavailable (private mode, blocked site data)
let memory: string | null = null;
let cachedRaw: string | null | undefined;
let cached = DEFAULT_PREFS;

function read(): BoardPrefs {
    let raw = memory;
    try {
        raw = localStorage.getItem(KEY) ?? memory;
    } catch {
        // storage blocked → in-memory value
    }
    if (raw !== cachedRaw) {
        cachedRaw = raw;
        cached = parsePrefs(raw);
    }
    return cached;
}

function subscribe(l: () => void) {
    listeners.add(l);
    window.addEventListener('storage', l);
    return () => {
        listeners.delete(l);
        window.removeEventListener('storage', l);
    };
}

function write(prefs: BoardPrefs) {
    memory = JSON.stringify(prefs);
    try {
        localStorage.setItem(KEY, memory);
    } catch {
        // storage blocked → kept for this page only
    }
    listeners.forEach((l) => l());
}

/** Board staff-column prefs per browser; the server snapshot is the default (no hydration mismatch). */
export function useBoardPrefs(): [BoardPrefs, (prefs: BoardPrefs) => void] {
    return [useSyncExternalStore(subscribe, read, () => DEFAULT_PREFS), write];
}
