'use client';

import {useState, useTransition} from 'react';
import {Button, ColorInput, Group, Modal, NumberInput, Switch, Table, Text, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {archiveWorkType, createWorkType, updateWorkType, type ActionResult} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import styles from './WorkTypesTable.module.css';

type WorkType = Tables<'tracker_work_types'>;

function useErrorText() {
    const {common, workTypes} = useDictionary().tracker;
    return (res: ActionResult<unknown>) => {
        if (res.ok) return null;
        if (res.error === 'duplicate') return workTypes.errorDuplicate;
        return res.error === 'not_found' ? common.error.notFound : common.error.generic;
    };
}

function WorkTypeForm({workType, nextOrder, onDone}: {workType: WorkType | null; nextOrder: number; onDone: () => void}) {
    const {workTypes: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const form = useForm({
        initialValues: {
            code: workType?.code ?? '',
            label: workType?.label ?? '',
            color: workType?.color ?? '#3b82f6',
            sort_order: workType?.sort_order ?? nextOrder,
        },
    });

    const submit = form.onSubmit((values) => startTransition(async () => {
        const res = workType
            ? await updateWorkType({id: workType.id, ...values})
            : await createWorkType(values);
        setError(errorText(res));
        if (res.ok) onDone();
    }));

    return (
        <form onSubmit={submit}>
            <TextInput label={t.code} required maxLength={20} data-autofocus {...form.getInputProps('code')}/>
            <TextInput label={t.label} mt="md" required maxLength={80} {...form.getInputProps('label')}/>
            <ColorInput label={t.color} mt="md" format="hex" required {...form.getInputProps('color')}/>
            <NumberInput label={t.order} mt="md" required min={0} allowDecimal={false} {...form.getInputProps('sort_order')}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onDone}>{common.cancel}</Button>
                <Button type="submit" loading={pending}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function WorkTypesTable({workTypes}: {workTypes: WorkType[]}) {
    const {workTypes: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [showArchived, setShowArchived] = useState(false);
    // undefined = modal closed, null = new work type, WorkType = editing
    const [editing, setEditing] = useState<WorkType | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const rows = showArchived ? workTypes : workTypes.filter((w) => !w.archived_at);
    const nextOrder = workTypes.reduce((max, w) => Math.max(max, w.sort_order), 0) + 1;

    const toggleArchive = (w: WorkType) => startTransition(async () => {
        setError(errorText(await archiveWorkType({id: w.id, archived: !w.archived_at})));
    });

    return (
        <section className={styles.page}>
            <div className={styles.toolbar}>
                <Title order={2}>{t.title}</Title>
                <Group>
                    <Switch
                        label={common.showArchived}
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.currentTarget.checked)}
                    />
                    <Button onClick={() => setEditing(null)}>{t.newWorkType}</Button>
                </Group>
            </div>

            {error && <Text c="red" size="sm" mb="md">{error}</Text>}

            <Table.ScrollContainer minWidth={560}>
                <Table highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t.color}</Table.Th>
                            <Table.Th>{t.code}</Table.Th>
                            <Table.Th>{t.label}</Table.Th>
                            <Table.Th>{t.order}</Table.Th>
                            <Table.Th className={styles.right}>{t.actions}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={5}><Text c="dimmed">{t.empty}</Text></Table.Td>
                            </Table.Tr>
                        )}
                        {rows.map((w) => (
                            <Table.Tr key={w.id} className={w.archived_at ? styles.archived : undefined}>
                                <Table.Td><div className={styles.swatch} style={{background: w.color}}/></Table.Td>
                                <Table.Td>
                                    {w.code}
                                    {w.archived_at && <Text span c="dimmed" size="sm"> ({t.archived})</Text>}
                                </Table.Td>
                                <Table.Td>{w.label}</Table.Td>
                                <Table.Td>{w.sort_order}</Table.Td>
                                <Table.Td>
                                    <div className={styles.actions}>
                                        <Button size="xs" variant="default" onClick={() => setEditing(w)}>{common.edit}</Button>
                                        <Button size="xs" variant="default" disabled={pending} onClick={() => toggleArchive(w)}>
                                            {w.archived_at ? common.unarchive : common.archive}
                                        </Button>
                                    </div>
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>

            <Modal
                opened={editing !== undefined}
                onClose={() => setEditing(undefined)}
                title={editing ? t.editWorkType : t.newWorkType}
            >
                {editing !== undefined && (
                    <WorkTypeForm
                        key={editing?.id ?? 'new'}
                        workType={editing}
                        nextOrder={nextOrder}
                        onDone={() => setEditing(undefined)}
                    />
                )}
            </Modal>
        </section>
    );
}
