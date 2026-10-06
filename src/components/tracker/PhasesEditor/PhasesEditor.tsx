'use client';

import {Fragment, useEffect, useLayoutEffect, useRef, useState, type PointerEvent} from 'react';
import {ActionIcon, Badge, Button, Text, TextInput, Tooltip} from '@mantine/core';
import {IconGripVertical, IconPlus, IconX} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {pctHundredths, pctTotalOk} from '@/components/tracker/pay';
import {phaseLevels} from '@/components/tracker/phases';
import WorkTypesEditor from '../WorkTypesEditor/WorkTypesEditor';
import {
    draftIssues, linkAllowed, MAX_PHASE_NAME, MAX_PHASES, moveBefore, removePhase, setAfter, type PhaseDraft,
} from './phaseDraft';
import styles from './PhasesEditor.module.css';

type Box = {left: number; right: number; cy: number};
type Edge = {from: string; to: string};
type Drag =
    | {kind: 'link'; from: string; x0: number; y0: number; x: number; y: number; over: string | null}
    // slot: insert position among the column's other cards; null = pointer not over the card's own column
    | {kind: 'card'; key: string; level: number; slot: number | null; foreign: boolean};

const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const m = (x1 + x2) / 2;
    return `M${x1} ${y1}C${m} ${y1} ${m} ${y2} ${x2} ${y2}`;
};

const newPhase = (): PhaseDraft => ({
    key: crypto.randomUUID(),
    name: '',
    after: [],
    types: [{
        key: crypto.randomUUID(), code: '', label: '', color: '#888888', pay_pct: 100, sort_order: 10,
        overlaps_prev: false, used: false,
    }],
});

/**
 * Phases as columns by dependency level, SVG connectors from each prerequisite to its dependent (layout A).
 * Create mode: drag a connector from the right-edge handle onto a card, click a line then Delete / "×" to
 * remove it, drag a card by its grip within its column; the "Starts after" chips are the keyboard path.
 * `locked` (edit mode): the phase graph is read-only, stages are edited through WorkTypesEditor's locked mode.
 */
export default function PhasesEditor({value, onChange, locked = false}: {
    value: PhaseDraft[];
    onChange: (v: PhaseDraft[]) => void;
    locked?: boolean;
}) {
    const {phasesEditor: t, workTypesEditor: wt} = useDictionary().tracker;
    const colsRef = useRef<HTMLDivElement>(null);
    const [boxes, setBoxes] = useState<Record<string, Box>>({});
    const [sel, setSel] = useState<Edge | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    // every edit clears the cross-column hint
    const change = (v: PhaseDraft[]) => {
        setHint(null);
        onChange(v);
    };

    const levels = phaseLevels(value.map((p) => ({id: p.key, after: p.after})));
    const columns = Array.from({length: Math.max(0, ...levels.values()) + 1}, (_, l) =>
        value.filter((p) => levels.get(p.key) === l));
    const edges: Edge[] = value.flatMap((p) => p.after.map((from) => ({from, to: p.key})));
    const selected = sel && edges.find((e) => e.from === sel.from && e.to === sel.to) ? sel : null;
    const issues = draftIssues(value, locked);

    // Card anchors for the connectors, re-measured after every change (observe() reports each element once) and on resize.
    useLayoutEffect(() => {
        const cols = colsRef.current;
        if (!cols) return;
        const cards = cols.querySelectorAll<HTMLElement>('[data-card]');
        const measure = () => {
            const c = cols.getBoundingClientRect();
            const next: Record<string, Box> = {};
            cards.forEach((el) => {
                const r = el.getBoundingClientRect();
                next[el.dataset.card!] = {left: r.left - c.left, right: r.right - c.left, cy: r.top + r.height / 2 - c.top};
            });
            setBoxes(next);
        };
        const ro = new ResizeObserver(measure);
        ro.observe(cols);
        cards.forEach((el) => ro.observe(el));
        return () => ro.disconnect();
    }, [value]);

    const removeEdge = (e: Edge) => {
        setSel(null);
        change(setAfter(value, e.from, e.to, false));
    };

    useEffect(() => {
        if (!selected) return;
        const onKey = (e: KeyboardEvent) => {
            if ((e.key !== 'Delete' && e.key !== 'Backspace') || /INPUT|TEXTAREA/.test((e.target as Element).tagName)) return;
            e.preventDefault();
            setSel(null);
            setHint(null);
            onChange(setAfter(value, selected.from, selected.to, false));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, value, onChange]);

    const local = (e: PointerEvent) => {
        const c = colsRef.current!.getBoundingClientRect();
        return {x: e.clientX - c.left, y: e.clientY - c.top};
    };
    const cardAt = (e: PointerEvent) =>
        document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-card]')?.dataset.card ?? null;

    // Both drags capture the pointer on their grip / handle, so move / up arrive there wherever the pointer goes.
    const start = (e: PointerEvent<HTMLElement>, next: Drag) => {
        if (e.button > 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setHint(null);
        setSel(null);
        setDrag(next);
    };

    const onLinkDown = (e: PointerEvent<HTMLElement>, from: string) => {
        const b = boxes[from];
        const {x, y} = local(e);
        start(e, {kind: 'link', from, x0: b?.right ?? x, y0: b?.cy ?? y, x, y, over: null});
    };

    const onCardDown = (e: PointerEvent<HTMLElement>, key: string) =>
        start(e, {kind: 'card', key, level: levels.get(key) ?? 0, slot: null, foreign: false});

    const onMove = (e: PointerEvent<HTMLElement>) => {
        if (!drag) return;
        if (drag.kind === 'link') {
            setDrag({...drag, ...local(e), over: cardAt(e)});
            return;
        }
        const col = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-col]');
        if (!col || Number(col.dataset.col) !== drag.level) {
            setDrag({...drag, slot: null, foreign: !!col});
            return;
        }
        const others = [...col.querySelectorAll<HTMLElement>('[data-card]')].filter((n) => n.dataset.card !== drag.key);
        const slot = others.filter((n) => {
            const r = n.getBoundingClientRect();
            return e.clientY > r.top + r.height / 2;
        }).length;
        setDrag({...drag, slot, foreign: false});
    };

    const onUp = (e: PointerEvent<HTMLElement>) => {
        if (!drag) return;
        setDrag(null);
        if (drag.kind === 'link') {
            const to = cardAt(e);
            if (to && linkAllowed(value, drag.from, to)) change(setAfter(value, drag.from, to, true));
            return;
        }
        if (drag.foreign) return setHint(t.crossColumn);
        const others = columns[drag.level].filter((p) => p.key !== drag.key);
        if (drag.slot === null || !others.length) return;
        change(moveBefore(value, drag.key, others[drag.slot]?.key ?? null, others[others.length - 1].key));
    };

    const dragHandlers = {onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => setDrag(null), onLostPointerCapture: () => setDrag(null)};
    const setPhase = (key: string, patch: Partial<PhaseDraft>) =>
        change(value.map((p) => (p.key === key ? {...p, ...patch} : p)));
    const label = (p: PhaseDraft) => p.name.trim() || t.unnamed;

    const cardClass = (p: PhaseDraft) => {
        const cls = [styles.card];
        if (drag?.kind === 'card' && drag.key === p.key) cls.push(styles.dragging);
        if (drag?.kind === 'link' && p.key !== drag.from) {
            if (!linkAllowed(value, drag.from, p.key)) cls.push(styles.muted);
            else if (drag.over === p.key) cls.push(styles.dropOk);
        }
        return cls.join(' ');
    };

    const chips = (p: PhaseDraft) => {
        const others = value.filter((o) => o.key !== p.key);
        if (!others.length) return <Text size="xs" c="dimmed">{t.noOther}</Text>;
        return others.map((o) => {
            const on = p.after.includes(o.key);
            const blocked = !on && !linkAllowed(value, o.key, p.key);
            const chip = (
                <Button
                    size="compact-xs"
                    variant={on ? 'filled' : 'default'}
                    aria-pressed={on}
                    disabled={blocked}
                    onClick={() => change(setAfter(value, o.key, p.key, !on))}
                >
                    {label(o)}
                </Button>
            );
            // span wrapper: a disabled button fires no mouse events, so the reason would never show
            return blocked
                ? <Tooltip key={o.key} label={t.cycle.replace('{name}', label(o))}><span>{chip}</span></Tooltip>
                : <Fragment key={o.key}>{chip}</Fragment>;
        });
    };

    const card = (p: PhaseDraft) => {
        const total = p.types.reduce((s, w) => s + pctHundredths(Number(w.pay_pct) || 0), 0) / 100;
        const ok = pctTotalOk(p.types.map((w) => Number(w.pay_pct) || 0));
        return (
            <div key={p.key} data-card={p.key} className={cardClass(p)}>
                <div className={styles.head}>
                    {!locked && (
                        <Tooltip label={t.grip}>
                            <span className={styles.grip} aria-hidden onPointerDown={(e) => onCardDown(e, p.key)} {...dragHandlers}>
                                <IconGripVertical size={18}/>
                            </span>
                        </Tooltip>
                    )}
                    {locked ? <span className={styles.nameText}>{p.name}</span> : (
                        <TextInput
                            className={styles.name}
                            size="xs"
                            aria-label={t.name}
                            placeholder={t.namePlaceholder}
                            required
                            maxLength={MAX_PHASE_NAME}
                            value={p.name}
                            onChange={(e) => setPhase(p.key, {name: e.currentTarget.value})}
                        />
                    )}
                    <Tooltip label={t.payTotal}>
                        <Badge color={ok ? 'green' : 'red'} variant="light">{total}%</Badge>
                    </Tooltip>
                    {!locked && (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={t.removePhase}
                            disabled={value.length <= 1}
                            onClick={() => change(removePhase(value, p.key))}
                        >
                            <IconX size={16}/>
                        </ActionIcon>
                    )}
                </div>
                <WorkTypesEditor value={p.types} onChange={(types) => setPhase(p.key, {types})} locked={locked}/>
                {!locked && (
                    <>
                        <div className={styles.label}>{t.startsAfter}</div>
                        <div className={styles.chips}>{chips(p)}</div>
                        <Tooltip label={t.handle}>
                            <span className={styles.handle} aria-hidden onPointerDown={(e) => onLinkDown(e, p.key)} {...dragHandlers}/>
                        </Tooltip>
                    </>
                )}
            </div>
        );
    };

    const column = (cards: PhaseDraft[], l: number) => {
        const slot = drag?.kind === 'card' && drag.level === l ? drag.slot : null;
        const others = cards.filter((p) => !(drag?.kind === 'card' && p.key === drag.key));
        return (
            <div key={l} data-col={l} className={styles.col}>
                <h3 className={styles.colHead}>
                    {t.level.replace('{n}', String(l + 1))}{l === 0 && ` · ${t.noPrerequisite}`}
                </h3>
                {cards.map((p) => (
                    <Fragment key={p.key}>
                        {slot !== null && others[slot]?.key === p.key && <div className={styles.slot}/>}
                        {card(p)}
                    </Fragment>
                ))}
                {slot !== null && slot === others.length && others.length > 0 && <div className={styles.slot}/>}
            </div>
        );
    };

    return (
        <div className={styles.root}>
            <Text size="xs" c="dimmed" mb={6}>{locked ? t.fixed : t.help}</Text>
            <div className={styles.wrap} onClick={() => setSel(null)}>
                <div ref={colsRef} className={styles.cols}>
                    <svg className={styles.svg}>
                        {edges.map((e) => {
                            const a = boxes[e.from];
                            const b = boxes[e.to];
                            if (!a || !b) return null;
                            const d = curve(a.right, a.cy, b.left, b.cy);
                            const on = selected?.from === e.from && selected.to === e.to;
                            return (
                                <g key={`${e.from}>${e.to}`} className={on ? styles.sel : undefined}>
                                    <path className={styles.line} d={d}/>
                                    {!locked && (
                                        <path className={styles.hit} d={d} onClick={(ev) => {
                                            ev.stopPropagation();
                                            setSel(e);
                                        }}/>
                                    )}
                                    {on && (
                                        <g
                                            className={styles.remove}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={t.removeLink}
                                            onClick={(ev) => {
                                                ev.stopPropagation();
                                                removeEdge(e);
                                            }}
                                            onKeyDown={(ev) => {
                                                if (ev.key !== "Enter" && ev.key !== " ") return;
                                                ev.preventDefault();
                                                ev.stopPropagation();
                                                removeEdge(e);
                                            }}
                                        >
                                            <circle cx={(a.right + b.left) / 2} cy={(a.cy + b.cy) / 2} r={9}/>
                                            <text x={(a.right + b.left) / 2} y={(a.cy + b.cy) / 2}>×</text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                        {drag?.kind === 'link' && <path className={styles.tmp} d={curve(drag.x0, drag.y0, drag.x, drag.y)}/>}
                    </svg>
                    {columns.map(column)}
                </div>
            </div>
            {hint && <Text size="sm" c="dimmed" mt={6} role="status">{hint}</Text>}
            {!locked && (
                <Button
                    variant="default"
                    size="xs"
                    mt="sm"
                    leftSection={<IconPlus size={14}/>}
                    disabled={value.length >= MAX_PHASES}
                    onClick={() => change([...value, newPhase()])}
                >
                    {t.addPhase}
                </Button>
            )}
            <Text size="xs" c="dimmed" mt={6}>{wt.defaultHint}</Text>
            {issues.map((i) => <Text key={i} c="red" size="sm" mt={4}>{t.issues[i]}</Text>)}
        </div>
    );
}
