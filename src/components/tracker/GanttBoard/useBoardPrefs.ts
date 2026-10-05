'use client';

import {useSyncExternalStore} from 'react';
import {
    DEFAULT_PREFS, EMPTY_PROJECT_FILTER, parsePrefs, parseProjectFilter, projectFilterKey,
    type BoardPrefs, type ProjectFilter,
} from './boardHelpers';

const PREFS_KEY = 'tracker.board.v1';
const listeners = new Set<() => void>();
// used when storage is unavailable (private mode, blocked site data)
const memory = new Map<string, string>();
// last raw value + parsed snapshot per key (useSyncExternalStore needs a stable snapshot)
const cache = new Map<string, {raw: string | null; value: unknown}>();

function read<T>(key: string, parse: (raw: string | null) => T): T {
    let raw = memory.get(key) ?? null;
    try {
        raw = localStorage.getItem(key) ?? raw;
    } catch {
        // storage blocked → in-memory value
    }
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.value as T;
    const value = parse(raw);
    cache.set(key, {raw, value});
    return value;
}

function subscribe(l: () => void) {
    listeners.add(l);
    window.addEventListener('storage', l);
    return () => {
        listeners.delete(l);
        window.removeEventListener('storage', l);
    };
}

function write(key: string, value: unknown) {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
        localStorage.setItem(key, raw);
    } catch {
        // storage blocked → kept for this page only
    }
    listeners.forEach((l) => l());
}

/** One JSON value per localStorage key; the server snapshot is the fallback (no hydration mismatch). */
function useStored<T>(key: string, parse: (raw: string | null) => T, fallback: T): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, () => read(key, parse), () => fallback);
    return [value, (next: T) => write(key, next)];
}

/** Board staff-column prefs per browser. */
export function useBoardPrefs(): [BoardPrefs, (prefs: BoardPrefs) => void] {
    return useStored(PREFS_KEY, parsePrefs, DEFAULT_PREFS);
}

/** Board staff filter (strengths, departments) per browser and project. */
export function useProjectFilter(projectId: string): [ProjectFilter, (next: ProjectFilter) => void] {
    return useStored(projectFilterKey(projectId), parseProjectFilter, EMPTY_PROJECT_FILTER);
}
