// Project phases (v2.8): pure graph helpers over `after` (prerequisite phase ids). Also used on client drafts.
import type {Tables} from '@/types/database.types';

export type Phase = Pick<Tables<'tracker_phases'>, 'id' | 'name' | 'sort_order' | 'after'>;
type Node = {id: string; after: string[]};

export function sortPhases<P extends {sort_order: number}>(phases: P[]): P[] {
    return [...phases].sort((a, b) => a.sort_order - b.sort_order);
}

/** Every phase `id` starts after, transitively (unknown ids in `after` are kept, they just have no parents). */
export function ancestors(phases: Node[], id: string): Set<string> {
    const byId = new Map(phases.map((p) => [p.id, p]));
    const out = new Set<string>();
    const stack = [...(byId.get(id)?.after ?? [])];
    while (stack.length) {
        const x = stack.pop()!;
        if (out.has(x)) continue;
        out.add(x);
        stack.push(...(byId.get(x)?.after ?? []));
    }
    return out;
}

/** 0 = no prerequisites, else 1 + the max level of its prerequisites. A cycle (never valid) is cut at the back edge. */
export function phaseLevels(phases: Node[]): Map<string, number> {
    const byId = new Map(phases.map((p) => [p.id, p]));
    const levels = new Map<string, number>();
    const visiting = new Set<string>();
    const level = (id: string): number => {
        const known = levels.get(id);
        if (known !== undefined) return known;
        if (visiting.has(id)) return -1;
        visiting.add(id);
        const deps = (byId.get(id)?.after ?? []).filter((d) => byId.has(d));
        const l = deps.length ? 1 + Math.max(...deps.map(level)) : 0;
        visiting.delete(id);
        levels.set(id, Math.max(l, 0));
        return Math.max(l, 0);
    };
    for (const p of phases) level(p.id);
    return levels;
}

/** Adding "`to` starts after `from`" would create a cycle. */
export function wouldCycle(phases: Node[], from: string, to: string): boolean {
    return from === to || ancestors(phases, from).has(to);
}

/** Topological order: by level, ties by position in `tieBreak` (ids not in it go last), then name. */
export function topoOrder<P extends Node & {name: string}>(phases: P[], tieBreak: string[] = []): P[] {
    const levels = phaseLevels(phases);
    const rank = (id: string) => {
        const i = tieBreak.indexOf(id);
        return i < 0 ? Infinity : i;
    };
    return [...phases].sort((a, b) =>
        levels.get(a.id)! - levels.get(b.id)! || rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}

export type PhaseState = 'done' | 'started' | 'empty';

/** done = every type has a stage task at 100 %; started = at least one stage task exists; else empty. */
export function phaseState(typeIds: string[], stage: (typeId: string) => {progress: number} | undefined): PhaseState {
    const stages = typeIds.map(stage);
    if (stages.length && stages.every((s) => s?.progress === 100)) return 'done';
    return stages.some((s) => s) ? 'started' : 'empty';
}
