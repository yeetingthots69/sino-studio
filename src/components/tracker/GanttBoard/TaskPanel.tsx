'use client';

import {useEffect, useRef, useState, type RefObject} from 'react';
import {Autocomplete, Button, Group, Modal, Select, Slider, Stack, Text, UnstyledButton} from '@mantine/core';
import {DateInput} from '@mantine/dates';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {daysBetween} from '../dates';
import {normalizeCutCode} from '../cuts';
import {cleanLinks, sanitizeLinks, type Link} from '../links';
import LinksEditor, {LinksList} from '../LinksEditor/LinksEditor';
import SendMailButton from '../SendMailButton/SendMailButton';
import {sendResources} from '@/app/[locale]/tracker/actions';
import {isValidCutCode, parseDMY} from './boardHelpers';
import {fill, type Cut, type Staff, type Task, type TaskPatch, type WorkType} from './GanttBoard';
import styles from './GanttBoard.module.css';

interface Props {
    task: Task | null;
    cutCode: string;
    /** Project cuts in natural order. */
    cuts: Cut[];
    staff: Staff[];
    strengthLabels: Map<string, string>;
    workTypes: WorkType[];
    /** Work types already used by other tasks of this task's cut (one task per cut per type). */
    usedTypeIds: Set<string>;
    /** Read-only project links. */
    projectLinks: Link[];
    panelDirtyRef: RefObject<boolean>;
    settle: () => void;
    /** `display` = optimistic fields; `baseline` = confirmed version when the interaction started. */
    onUpdate: (patch: TaskPatch, display: Partial<Task>, baseline: number) => void;
    onDelete: (baseline: number) => void;
    onInvalidCut: () => void;
}

// Mounted with key={task.id}: drafts reset whenever the selection changes.
export default function TaskPanel(props: Props) {
    const {task, cutCode, cuts, staff, strengthLabels, workTypes, usedTypeIds, projectLinks, panelDirtyRef, settle, onUpdate, onDelete, onInvalidCut} = props;
    const {board, common, links: tl, mail} = useDictionary().tracker;
    const t = board.panel;
    // cut draft: baseline recorded at the first keystroke
    const [cutEdit, setCutEdit] = useState<{draft: string; baseline: number} | null>(null);
    // slider gesture: baseline recorded at its first onChange; otherwise the slider follows task.progress
    const [progressEdit, setProgressEdit] = useState<{value: number; baseline: number} | null>(null);
    // links draft: baseline recorded at its first edit
    const [linksEdit, setLinksEdit] = useState<{draft: Link[]; baseline: number} | null>(null);
    // delete confirmation: baseline recorded when it opens
    const [confirmBaseline, setConfirmBaseline] = useState<number | null>(null);
    // Mantine fires onChange with the picked option after onOptionSubmit: that echo must not reopen the draft
    const justCommittedRef = useRef<string | null>(null);

    // keyboard steps on the slider: Mantine fires onChangeEnd per key, so those commits are debounced (400 ms)
    const keyboardRef = useRef(false);
    const keyCommitRef = useRef<{timer: ReturnType<typeof setTimeout>; run: () => void} | null>(null);

    // unmounted (selection changed): flush a debounced slider commit, release a deferred refresh
    useEffect(() => () => {
        const pending = keyCommitRef.current;
        if (pending) {
            clearTimeout(pending.timer);
            pending.run();
        }
        panelDirtyRef.current = false;
        settle();
    }, [panelDirtyRef, settle]);

    if (!task) {
        return (
            <aside className={styles.panel}>
                <div className={styles.panelTitle}>{t.title}</div>
                <Text c="dimmed" size="sm">{t.empty}</Text>
            </aside>
        );
    }

    const owner = staff.find((s) => s.id === task.staff_id);
    const type = workTypes.find((w) => w.id === task.work_type_id);
    const assignees = staff.filter((s) => !s.archived_at || s.id === task.staff_id);
    // change events (chips, selects, dates): baseline = the version shown right now
    const update = (patch: TaskPatch & Partial<Task>) => onUpdate(patch, patch, task.version);

    const commitCut = (raw: string, baseline: number) => {
        const code = normalizeCutCode(raw);
        justCommittedRef.current = code;
        setCutEdit(null);
        panelDirtyRef.current = linksEdit !== null;
        if (!isValidCutCode(code)) onInvalidCut();
        else if (code !== cutCode) {
            const known = cuts.find((c) => c.code === code);
            onUpdate({cut_code: code}, known ? {cut_id: known.id} : {}, baseline);
        }
        settle();
    };

    const endLinksEdit = (save: Link[] | null) => {
        const links = save && cleanLinks(save);
        // no-op save (draft equals the current links): nothing to send
        if (links && linksEdit && JSON.stringify(links) !== JSON.stringify(sanitizeLinks(task.links))) {
            onUpdate({links}, {links}, linksEdit.baseline);
        }
        setLinksEdit(null);
        panelDirtyRef.current = cutEdit !== null;
        settle();
    };

    const setStart = (v: string | null) => {
        if (!v || v === task.start_date) return;
        update(v > task.end_date ? {start_date: v, end_date: v} : {start_date: v});
    };
    const setEnd = (v: string | null) => {
        if (!v || v === task.end_date) return;
        update({end_date: v < task.start_date ? task.start_date : v});
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
            <div className={styles.panelName}>{cutCode} · {type?.code}</div>
            <Text size="xs" c="dimmed" mb="lg">{summary}</Text>

            {/* Enter without a highlighted option submits; with one, the combobox handles it (onOptionSubmit) */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (cutEdit) commitCut(cutEdit.draft, cutEdit.baseline);
                }}
            >
                <Autocomplete
                    label={t.cut}
                    value={cutEdit?.draft ?? cutCode}
                    data={cuts.map((c) => c.code)}
                    onChange={(v) => {
                        const echo = justCommittedRef.current;
                        justCommittedRef.current = null;
                        if (normalizeCutCode(v) === echo) return;
                        setCutEdit({draft: normalizeCutCode(v), baseline: cutEdit?.baseline ?? task.version});
                        panelDirtyRef.current = true;
                    }}
                    onOptionSubmit={(v) => commitCut(v, cutEdit?.baseline ?? task.version)}
                    onBlur={() => {
                        // untouched (or already committed by an option pick): never write back
                        if (cutEdit) commitCut(cutEdit.draft, cutEdit.baseline);
                    }}
                />
            </form>

            <Text size="sm" fw={500} mt="md" mb={6}>{t.type}</Text>
            <div className={styles.typeGrid} role="radiogroup" aria-label={t.type}>
                {workTypes.map((w) => (
                    <UnstyledButton
                        key={w.id}
                        role="radio"
                        aria-checked={w.id === task.work_type_id}
                        disabled={w.id !== task.work_type_id && usedTypeIds.has(w.id)}
                        className={`${styles.typeChip} ${w.id === task.work_type_id ? styles.typeChipActive : ''}`}
                        onClick={() => w.id !== task.work_type_id && update({work_type_id: w.id})}
                    >
                        <span className={styles.dot} style={{background: w.color}}/>{w.code}
                    </UnstyledButton>
                ))}
            </div>

            <Group justify="space-between" mt="md" mb={6}>
                <Text size="sm" fw={500}>{t.progress}</Text>
                <Text size="sm" c="dimmed">{progressEdit?.value ?? task.progress}%</Text>
            </Group>
            <Slider
                value={progressEdit?.value ?? task.progress}
                onChange={(value) => setProgressEdit({value, baseline: progressEdit?.baseline ?? task.version})}
                min={0}
                max={100}
                step={5}
                label={(v) => `${v}%`}
                onKeyDown={(e) => {
                    if (/^(Arrow|Page|Home|End)/.test(e.key)) keyboardRef.current = true;
                }}
                onChangeEnd={(v) => {
                    const baseline = progressEdit?.baseline ?? task.version;
                    const run = () => {
                        keyCommitRef.current = null;
                        if (v !== task.progress) onUpdate({progress: v}, {progress: v}, baseline);
                        setProgressEdit(null);
                    };
                    if (keyCommitRef.current) clearTimeout(keyCommitRef.current.timer);
                    if (!keyboardRef.current) return run();
                    keyboardRef.current = false;
                    // keep the draft (and its baseline) shown until the key burst ends
                    setProgressEdit({value: v, baseline});
                    keyCommitRef.current = {timer: setTimeout(run, 400), run};
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
                data={assignees.map((s) => {
                    const labels = strengthLabels.get(s.id);
                    return {value: s.id, label: labels ? `${s.name} — ${labels}` : s.name};
                })}
                onChange={(v) => v && v !== task.staff_id && update({staff_id: v})}
            />

            <Text size="sm" fw={500} mt="md" mb={6}>{tl.task}</Text>
            <LinksEditor
                value={linksEdit?.draft ?? sanitizeLinks(task.links)}
                onChange={(draft) => {
                    setLinksEdit({draft, baseline: linksEdit?.baseline ?? task.version});
                    panelDirtyRef.current = true;
                }}
                onSave={endLinksEdit}
                onCancel={() => endLinksEdit(null)}
                dirty={linksEdit !== null}
            />
            <Stack mt="sm" gap="sm">
                <LinksList links={sanitizeLinks(cuts.find((c) => c.id === task.cut_id)?.links)} title={tl.cut}/>
                <LinksList links={projectLinks} title={tl.project}/>
            </Stack>

            <SendMailButton
                fullWidth
                mt="lg"
                label={mail.sendResources}
                disabled={!owner?.email || !!owner.archived_at}
                people={owner ? [owner] : []}
                onSend={() => sendResources({task_id: task.id})}
            />

            <Button fullWidth variant="default" mt="sm" onClick={() => setConfirmBaseline(task.version)}>{t.delete}</Button>

            <Modal opened={confirmBaseline !== null} onClose={() => setConfirmBaseline(null)} title={t.delete} centered>
                <Text size="sm">{t.confirmDelete}</Text>
                <Group justify="flex-end" mt="lg">
                    <Button variant="default" onClick={() => setConfirmBaseline(null)}>{common.cancel}</Button>
                    <Button
                        color="red"
                        onClick={() => {
                            if (confirmBaseline !== null) onDelete(confirmBaseline);
                            setConfirmBaseline(null);
                        }}
                    >
                        {t.delete}
                    </Button>
                </Group>
            </Modal>
        </aside>
    );
}
