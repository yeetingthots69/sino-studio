'use client';

import type {RefObject} from 'react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {clampToMonth} from '../dates';
import type {DragBaseline} from './dragMath';
import {DAY_W, DONE_COLOR, fill, type Task, type WorkType} from './GanttBoard';
import {useBarDrag} from './useBarDrag';
import styles from './GanttBoard.module.css';

interface Props {
    task: Task;
    workType: WorkType | undefined;
    month: string;
    lane: number;
    selected: boolean;
    draggingRef: RefObject<boolean>;
    settle: () => void;
    onSelect: () => void;
    onCommit: (patch: DragBaseline) => void;
}

export default function TaskBar({task, workType, month, lane, selected, draggingRef, settle, onSelect, onCommit}: Props) {
    const t = useDictionary().tracker.board;
    const {preview, handlers} = useBarDrag({task, draggingRef, settle, onCommit});
    const done = task.progress === 100;
    const color = done ? DONE_COLOR : (workType?.color ?? '#888888');
    const label = done ? t.done : (workType?.code ?? '');
    const {colStart, colEnd, clippedStart, clippedEnd} = clampToMonth(preview ?? task, month);
    // optimistic create still in flight: not selectable or draggable until the real id lands
    const pendingCreate = task.id.startsWith('tmp-');

    return (
        <button
            type="button"
            className={`${styles.bar} ${selected ? styles.selected : ''} ${preview ? styles.dragging : ''}`}
            disabled={pendingCreate}
            onClick={onSelect}
            {...(pendingCreate ? {} : handlers)}
            aria-pressed={selected}
            aria-label={fill(t.barLabel, {
                name: task.name,
                label,
                s: Number(task.start_date.slice(8)),
                e: Number(task.end_date.slice(8)),
            })}
            style={{
                left: (colStart - 1) * DAY_W,
                // a preview dragged fully outside the month collapses to nothing
                width: Math.max(0, (colEnd - colStart + 1) * DAY_W - 4),
                top: lane * DAY_W + 4,
                background: color + '33',
                borderColor: color,
                borderTopLeftRadius: clippedStart ? 0 : undefined,
                borderBottomLeftRadius: clippedStart ? 0 : undefined,
                borderTopRightRadius: clippedEnd ? 0 : undefined,
                borderBottomRightRadius: clippedEnd ? 0 : undefined,
            }}
        >
            <span className={styles.progress} style={{width: `${task.progress}%`, background: color + 'aa'}}/>
            <span className={styles.barText}>
                <span className={styles.grip} aria-hidden>⋮⋮</span>
                <b>{task.name}</b> {label}
            </span>
            {/* edges clipped by the month bound are not handles */}
            {!pendingCreate && !clippedStart && <span className={`${styles.handle} ${styles.handleStart}`} data-edge="resize-start" aria-hidden/>}
            {!pendingCreate && !clippedEnd && <span className={`${styles.handle} ${styles.handleEnd}`} data-edge="resize-end" aria-hidden/>}
        </button>
    );
}
