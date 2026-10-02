'use client';

import {useEffect, useState} from 'react';
import {Button, Group, Modal, Radio, Stack, Text} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {getBrowserClient} from '@/utils/supabase/client';
import {movableAdjustments} from '../pay';
import {formatVnd} from '../earnings';
import {ddmm} from './boardHelpers';
import {fill, type Task, type WorkType} from './GanttBoard';

interface Props {
    opened: boolean;
    projectId: string;
    /** The task as stored: `staff_id` is the current (old) assignee. */
    task: Task;
    cutCode: string;
    workType: WorkType | undefined;
    fromName: string;
    toName: string;
    /** New dates when the move also changes them, else null. */
    dates: {start: string; end: string} | null;
    onCancel(): void;
    onConfirm(moveAdjustments: boolean): void;
}

// null = loading
type Found = {error: true} | {count: number; net: number};

export function MoveDialog({opened, projectId, task, cutCode, workType, fromName, toName, dates, onCancel, onConfirm}: Props) {
    const {board: t, common, cuts: tc} = useDictionary().tracker;
    const [found, setFound] = useState<Found | null>(null);
    const [choice, setChoice] = useState<'move' | 'keep' | null>(null);
    const [attempt, setAttempt] = useState(0);
    const {staff_id, cut_id, work_type_id} = task;
    // Each open, key change or retry starts from loading with no choice (reset during render, not in the effect).
    const loadKey = `${opened}|${staff_id}|${cut_id}|${work_type_id}|${attempt}`;
    const [prevKey, setPrevKey] = useState(loadKey);
    if (prevKey !== loadKey) {
        setPrevKey(loadKey);
        setFound(null);
        setChoice(null);
    }

    useEffect(() => {
        if (!opened) return;
        let live = true;
        // Reversals share staff/cut/type with what they reverse, so this key returns both.
        getBrowserClient().from('tracker_pay_adjustments')
            .select('id, staff_id, cut_id, work_type_id, amount, reverses_id')
            .eq('project_id', projectId).eq('cut_id', cut_id).eq('work_type_id', work_type_id).eq('staff_id', staff_id)
            .then(({data, error}) => {
                if (!live) return;
                if (error || !data) return setFound({error: true});
                const rows = movableAdjustments(data, {staff_id, cut_id, work_type_id});
                setFound({count: rows.length, net: rows.reduce((s, r) => s + r.amount, 0)});
            }, () => live && setFound({error: true}));
        return () => {
            live = false;
        };
    }, [opened, projectId, staff_id, cut_id, work_type_id, attempt]);

    const failed = found !== null && 'error' in found;
    const needsChoice = found !== null && !failed && found.count > 0;
    const ready = found !== null && (!needsChoice || choice !== null);

    return (
        <Modal opened={opened} onClose={onCancel} title={t.moveTitle} centered>
            <Stack gap="sm">
                <Text size="sm">
                    {fill(t.moveBody, {cut: cutCode, type: workType?.code ?? '', from: fromName, to: toName})}
                </Text>
                {dates && <Text size="sm">{fill(t.moveDates, {start: ddmm(dates.start), end: ddmm(dates.end)})}</Text>}
                {found === null && <Text size="sm" c="dimmed">{t.moveAdjChecking}</Text>}
                {failed && (
                    <Group gap="xs">
                        <Text size="sm" c="red">{common.error.generic}</Text>
                        <Button size="compact-sm" variant="subtle" onClick={() => setAttempt((a) => a + 1)}>{tc.retry}</Button>
                    </Group>
                )}
                {needsChoice && (
                    <Radio.Group
                        value={choice}
                        onChange={(v) => setChoice(v as 'move' | 'keep')}
                        label={fill(t.moveAdjFound, {n: found.count, total: formatVnd(found.net, true)})}
                        required
                    >
                        <Stack gap="xs" mt="xs">
                            <Radio value="move" label={t.moveAdjMove}/>
                            <Radio value="keep" label={t.moveAdjKeep}/>
                        </Stack>
                    </Radio.Group>
                )}
            </Stack>
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onCancel}>{common.cancel}</Button>
                {/* A load error can only keep the adjustments with the old person. */}
                <Button disabled={!ready} onClick={() => onConfirm(choice === 'move')}>{t.moveConfirm}</Button>
            </Group>
        </Modal>
    );
}
