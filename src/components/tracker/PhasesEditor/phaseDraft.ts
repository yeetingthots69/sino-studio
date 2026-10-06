// Phase editor drafts (v2.8): pure validation + payload helpers, shared by the editor and createProject.
import {pctTotalOk} from '@/components/tracker/pay';
import {topoOrder, wouldCycle} from '@/components/tracker/phases';
import type {EditorType} from '@/components/tracker/WorkTypesEditor/WorkTypesEditor';

export type WorkTypeDraft = EditorType;
export type PhaseDraft = {key: string; name: string; after: string[]; types: WorkTypeDraft[]};

export const MAX_PHASES = 8;
export const MAX_TYPES = 50;
export const MAX_PHASE_NAME = 40;

/** Same key as the SQL unique index: trimmed, inner whitespace runs collapsed, lower case. */
export const phaseNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const nodes = (drafts: PhaseDraft[]) => drafts.map((p) => ({id: p.key, after: p.after, name: p.name}));

/** `to` may start after `from`: not itself, not already linked, no cycle. */
export function linkAllowed(drafts: PhaseDraft[], from: string, to: string): boolean {
    const target = drafts.find((p) => p.key === to);
    return !!target && !target.after.includes(from) && !wouldCycle(nodes(drafts), from, to);
}

export const setAfter = (drafts: PhaseDraft[], from: string, to: string, on: boolean): PhaseDraft[] =>
    drafts.map((p) => (p.key !== to ? p : {...p, after: on ? [...p.after, from] : p.after.filter((k) => k !== from)}));

export const removePhase = (drafts: PhaseDraft[], key: string): PhaseDraft[] =>
    drafts.filter((p) => p.key !== key).map((p) => ({...p, after: p.after.filter((k) => k !== key)}));

/** Move `key` before `before` (null = after `last`, the last other card of its column). */
export function moveBefore(drafts: PhaseDraft[], key: string, before: string | null, last: string): PhaseDraft[] {
    const me = drafts.find((p) => p.key === key)!;
    const rest = drafts.filter((p) => p.key !== key);
    const at = before ? rest.findIndex((p) => p.key === before) : rest.findIndex((p) => p.key === last) + 1;
    return [...rest.slice(0, at), me, ...rest.slice(at)];
}

export type DraftIssue = 'phaseCount' | 'phaseName' | 'phaseNameDup' | 'typeCount' | 'fields' | 'codeDup' | 'pctTotal';

/** Everything that blocks saving, in display order; [] = valid. `locked` (edit mode) skips the create-only rules. */
export function draftIssues(drafts: PhaseDraft[], locked = false): DraftIssue[] {
    const types = drafts.flatMap((p) => p.types);
    const names = drafts.map((p) => phaseNameKey(p.name));
    const codes = types.map((t) => t.code.trim());
    const issues: DraftIssue[] = [];
    if (!locked) {
        if (drafts.length < 1 || drafts.length > MAX_PHASES) issues.push('phaseCount');
        if (drafts.some(({name}) => !name.trim() || name.trim().length > MAX_PHASE_NAME)) issues.push('phaseName');
        const named = names.filter(Boolean); // blank names are the phaseName issue, not duplicates
        if (new Set(named).size !== named.length) issues.push('phaseNameDup');
        if (types.length > MAX_TYPES) issues.push('typeCount');
    }
    if (types.some((t) => !t.label.trim() || (!locked && !t.code.trim()))) issues.push('fields');
    if (!locked && new Set(codes).size !== codes.length) issues.push('codeDup');
    if (!drafts.every((p) => pctTotalOk(p.types.map((t) => Number(t.pay_pct) || 0)))) issues.push('pctTotal');
    return issues;
}

/** createProject payload: phases in topological order (ties = draft order), `after` as indexes of earlier entries. */
export function draftToPayload(drafts: PhaseDraft[]) {
    const order = topoOrder(nodes(drafts), drafts.map((p) => p.key));
    const index = new Map(order.map((p, i) => [p.id, i]));
    return order.map(({id}) => {
        const p = drafts.find((d) => d.key === id)!;
        return {
            name: p.name.trim(),
            after: p.after.map((k) => index.get(k)!).sort((a, b) => a - b),
            types: p.types.map((t, i) => ({
                code: t.code.trim(), label: t.label.trim(), color: t.color,
                pay_pct: Number(t.pay_pct) || 0, overlaps_prev: i > 0 && t.overlaps_prev,
            })),
        };
    });
}
