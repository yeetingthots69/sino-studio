'use client';

import type {CSSProperties, RefObject} from 'react';
import {Tooltip} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {clampToMonth, daysBetween, type ISODate} from '../dates';
import type {DragBaseline} from './dragMath';
import {DONE_COLOR, LANE_H, fill, type Task, type WorkType} from './GanttBoard';
import {cssColor} from './presence';
import {useBarDrag, type MoveTarget} from './useBarDrag';
import styles from './GanttBoard.module.css';
import local from './TaskBar.module.css';

interface Props {
    task: Task;
    cutCode: string;
    workType: WorkType | undefined;
    month: string;
    lane: number;
    /** Day column width in px (the board's `dayW`). */
    dayWidth: number;
    selected: boolean;
    draggingRef: RefObject<boolean>;
    settle: () => void;
    onSelect: () => void;
    onCommit: (patch: DragBaseline, baseline: number) => void;
    /** Stable setter for the dragged task id (presence). */
    onDrag: (id: string | null) => void;
    /** Another tab editing this task (presence). */
    editor?: {name: string; color: string};
    /** Assignee name for the hover card. */
    staffName?: string;
    /** Move dropped on another staff row; without it the bar only moves within its row. */
    onMove?: (target: MoveTarget, baseline: number) => void;
    /** Foreign row currently targeted by this bar's drag (null when none). */
    onDropTarget?: (staffId: string | null) => void;
}

const dm = (d: ISODate) => `${d.slice(8)}/${d.slice(5, 7)}`;

export default function TaskBar({task, cutCode, workType, month, lane, dayWidth, selected, draggingRef, settle, onSelect, onCommit, onDrag, editor, staffName, onMove, onDropTarget}: Props) {
    const t = useDictionary().tracker.board;
    const {preview, dropStaffId, dy, wasDrag, handlers} = useBarDrag({task, staffId: task.staff_id, dayWidth, draggingRef, settle, onCommit, onMove, onDropTarget, onDrag});
    const done = task.progress === 100;
    const color = done ? DONE_COLOR : (workType?.color ?? '#888888');
    const code = workType?.code ?? '';
    const {colStart, colEnd, clippedStart, clippedEnd} = clampToMonth(preview ?? task, month);
    const narrow = colEnd - colStart + 1 < 2;
    const lifted = dropStaffId !== null;
    const days = daysBetween(task.start_date, task.end_date) + 1;

    const card = (
        <div className={local.card}>
            <b>{cutCode} · {code}{workType?.label ? ` ${workType.label}` : ''}</b>
            <span>{dm(task.start_date)} – {dm(task.end_date)} · {fill(days === 1 ? t.hoverDay : t.hoverDays, {n: days})}</span>
            <span>{t.hoverProgress}: {task.progress}%</span>
            {staffName && <span>{t.hoverAssignee}: {staffName}</span>}
        </div>
    );

    return (
        <Tooltip
            label={card}
            multiline
            openDelay={400}
            events={{hover: true, focus: false, touch: false}}
            disabled={preview != null || lifted}
        >
            {/* Tooltip merges its reference handlers with these (floating-ui calls both) and forwards its ref here */}
            <button
                type="button"
                className={`${styles.bar} ${selected ? styles.selected : ''} ${preview || lifted ? styles.dragging : ''} ${editor ? styles.editing : ''} ${narrow ? local.narrow : ''} ${lifted ? local.lifted : ''}`}
                onClick={() => {
                    if (wasDrag()) return;
                    onSelect();
                }}
                {...handlers}
                aria-pressed={selected}
                aria-label={fill(t.barLabel, {
                    name: cutCode,
                    label: done ? `${code}, ${t.done}` : code,
                    s: Number(task.start_date.slice(8)),
                    e: Number(task.end_date.slice(8)),
                })}
                style={{
                    left: (colStart - 1) * dayWidth,
                    // a preview dragged fully outside the month collapses to nothing
                    width: Math.max(0, (colEnd - colStart + 1) * dayWidth - 4),
                    top: lane * LANE_H + 4,
                    background: color + '33',
                    borderColor: color,
                    borderTopLeftRadius: clippedStart ? 0 : undefined,
                    borderBottomLeftRadius: clippedStart ? 0 : undefined,
                    borderTopRightRadius: clippedEnd ? 0 : undefined,
                    borderBottomRightRadius: clippedEnd ? 0 : undefined,
                    ...(lifted ? {transform: `translateY(${dy}px)`, zIndex: 3} : {}),
                    ...(editor ? {'--presence': cssColor(editor.color)} as CSSProperties : {}),
                }}
            >
                <span className={styles.progress} style={{width: `${task.progress}%`, background: color + 'aa'}}/>
                {narrow ? (
                    <span className={`${styles.barText} ${local.lines}`}>
                        <b>{cutCode}</b>
                        <span>{code}</span>
                    </span>
                ) : (
                    <span className={styles.barText}>
                        <span className={styles.grip} aria-hidden>⋮⋮</span>
                        <b>{cutCode}</b> · {code}
                    </span>
                )}
                {/* edges clipped by the month bound are not handles */}
                {!clippedStart && <span className={`${styles.handle} ${styles.handleStart} ${local.edge}`} data-edge="resize-start" aria-hidden/>}
                {editor && <span className={styles.editorChip} aria-hidden>{editor.name}</span>}
                {!clippedEnd && <span className={`${styles.handle} ${styles.handleEnd} ${local.edge}`} data-edge="resize-end" aria-hidden/>}
            </button>
        </Tooltip>
    );
}
