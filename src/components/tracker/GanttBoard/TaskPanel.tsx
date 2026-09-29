'use client';

import {useState, type RefObject} from 'react';
import {Button, Group, Modal, Select, Slider, Text, TextInput, UnstyledButton} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {daysBetween} from '../dates';
import {fill, type Staff, type Task, type TaskPatch, type WorkType} from './GanttBoard';
import styles from './GanttBoard.module.css';

interface Props {
    task: Task | null;
    staff: Staff[];
    workTypes: WorkType[];
    error: string | null;
    panelDirtyRef: RefObject<boolean>;
    settle: () => void;
    onUpdate: (patch: TaskPatch) => void;
    onDelete: () => void;
}

/** Parses the typed 'DD/MM/YYYY' value back into 'YYYY-MM-DD'. */
function parseDMY(value: string): string | null {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// Mounted with key={task.id}: the name draft resets whenever the selection changes.
export default function TaskPanel({task, staff, workTypes, error, panelDirtyRef, settle, onUpdate, onDelete}: Props) {
    const {board, common} = useDictionary().tracker;
    const t = board.panel;
    const [name, setName] = useState(task?.name ?? '');
    const [confirming, setConfirming] = useState(false);
    // only set while the slider is being moved; otherwise it follows task.progress (remote / reverted changes)
    const [progressDraft, setProgressDraft] = useState<number | null>(null);

    if (!task) {
        return (
            <aside className={styles.panel}>
                <div className={styles.panelTitle}>{t.title}</div>
                <Text c="dimmed" size="sm">{t.empty}</Text>
                {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            </aside>
        );
    }

    const owner = staff.find((s) => s.id === task.staff_id);
    const types = workTypes.filter((w) => !w.archived_at || w.id === task.work_type_id);
    const assignees = staff.filter((s) => !s.archived_at || s.id === task.staff_id);

    const commitName = () => {
        // untouched draft: never write it back (it may be stale vs. a remote rename); resync instead
        if (!panelDirtyRef.current) {
            setName(task.name);
            settle();
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) setName(task.name);
        else if (trimmed !== task.name) onUpdate({name: trimmed});
        panelDirtyRef.current = false;
        settle();
    };

    const setStart = (v: string | null) => {
        if (!v || v === task.start_date) return;
        onUpdate(v > task.end_date ? {start_date: v, end_date: v} : {start_date: v});
    };
    const setEnd = (v: string | null) => {
        if (!v || v === task.end_date) return;
        onUpdate({end_date: v < task.start_date ? task.start_date : v});
    };

    const [y, mo] = task.start_date.split('-');
    const summary = [
        owner?.name,
        fill(board.month, {m: Number(mo), y}),
        `${fill(t.summary, {s: Number(task.start_date.slice(8)), e: Number(task.end_date.slice(8))})} (${fill(t.days, {n: daysBetween(task.start_date, task.end_date) + 1})})`,
    ].filter(Boolean).join(' · ');

    return (
        <aside className={styles.panel}>
            <div className={styles.panelTitle}>{t.title}</div>
            <div className={styles.panelName}>{task.name}</div>
            <Text size="xs" c="dimmed" mb="lg">{summary}</Text>

            <TextInput
                label={t.name}
                value={name}
                maxLength={80}
                onChange={(e) => {
                    setName(e.currentTarget.value);
                    panelDirtyRef.current = e.currentTarget.value !== task.name;
                }}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />

            <Text size="sm" fw={500} mt="md" mb={6}>{t.type}</Text>
            <div className={styles.typeGrid} role="radiogroup" aria-label={t.type}>
                {types.map((w) => (
                    <UnstyledButton
                        key={w.id}
                        role="radio"
                        aria-checked={w.id === task.work_type_id}
                        className={`${styles.typeChip} ${w.id === task.work_type_id ? styles.typeChipActive : ''}`}
                        onClick={() => w.id !== task.work_type_id && onUpdate({work_type_id: w.id})}
                    >
                        <span className={styles.dot} style={{background: w.color}}/>{w.code}
                    </UnstyledButton>
                ))}
            </div>

            <Group justify="space-between" mt="md" mb={6}>
                <Text size="sm" fw={500}>{t.progress}</Text>
                <Text size="sm" c="dimmed">{progressDraft ?? task.progress}%</Text>
            </Group>
            <Slider
                value={progressDraft ?? task.progress}
                onChange={setProgressDraft}
                min={0}
                max={100}
                step={5}
                label={(v) => `${v}%`}
                onChangeEnd={(v) => {
                    if (v !== task.progress) onUpdate({progress: v});
                    setProgressDraft(null);
                }}
            />

            <Group grow mt="md" align="flex-start">
                <DateInput
                    label={t.start}
                    value={task.start_date}
                    valueFormat="DD/MM/YYYY"
                    dateParser={parseDMY}
                    onChange={setStart}
                />
                <DateInput
                    label={t.end}
                    value={task.end_date}
                    valueFormat="DD/MM/YYYY"
                    dateParser={parseDMY}
                    minDate={task.start_date}
                    onChange={setEnd}
                />
            </Group>

            <Select
                mt="md"
                label={t.assignee}
                value={task.staff_id}
                allowDeselect={false}
                data={assignees.map((s) => ({value: s.id, label: s.strengths ? `${s.name} — ${s.strengths}` : s.name}))}
                onChange={(v) => v && v !== task.staff_id && onUpdate({staff_id: v})}
            />

            {error && <Text c="red" size="sm" mt="md">{error}</Text>}

            <Button fullWidth variant="default" mt="lg" onClick={() => setConfirming(true)}>{t.delete}</Button>

            <Modal opened={confirming} onClose={() => setConfirming(false)} title={t.delete} centered>
                <Text size="sm">{t.confirmDelete}</Text>
                <Group justify="flex-end" mt="lg">
                    <Button variant="default" onClick={() => setConfirming(false)}>{common.cancel}</Button>
                    <Button color="red" onClick={() => { setConfirming(false); onDelete(); }}>{t.delete}</Button>
                </Group>
            </Modal>
        </aside>
    );
}
