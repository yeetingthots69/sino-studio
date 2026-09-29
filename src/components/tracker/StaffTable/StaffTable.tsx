'use client';

import {useState, useTransition} from 'react';
import {Button, Group, Modal, NumberInput, Switch, Table, Text, Textarea, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {archiveStaff, createStaff, updateStaff, type ActionResult} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import styles from './StaffTable.module.css';

type Staff = Tables<'tracker_staff'>;

function useErrorText() {
    const common = useDictionary().tracker.common;
    return (res: ActionResult<unknown>) =>
        res.ok ? null : res.error === 'not_found' ? common.error.notFound : common.error.generic;
}

function StaffForm({member, nextOrder, onDone}: {member: Staff | null; nextOrder: number; onDone: () => void}) {
    const {staff: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const form = useForm({
        initialValues: {
            name: member?.name ?? '',
            strengths: member?.strengths ?? '',
            sort_order: member?.sort_order ?? nextOrder,
        },
    });

    const submit = form.onSubmit((values) => startTransition(async () => {
        const res = member
            ? await updateStaff({id: member.id, ...values})
            : await createStaff(values);
        setError(errorText(res));
        if (res.ok) onDone();
    }));

    return (
        <form onSubmit={submit}>
            <TextInput label={t.name} required maxLength={80} data-autofocus {...form.getInputProps('name')}/>
            <Textarea label={t.strengths} mt="md" autosize minRows={2} maxLength={500} {...form.getInputProps('strengths')}/>
            <NumberInput label={t.order} mt="md" required min={0} allowDecimal={false} {...form.getInputProps('sort_order')}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onDone}>{common.cancel}</Button>
                <Button type="submit" loading={pending}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function StaffTable({staff}: {staff: Staff[]}) {
    const {staff: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [showArchived, setShowArchived] = useState(false);
    // undefined = modal closed, null = new staff, Staff = editing
    const [editing, setEditing] = useState<Staff | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const rows = showArchived ? staff : staff.filter((s) => !s.archived_at);
    const nextOrder = staff.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;

    const toggleArchive = (s: Staff) => startTransition(async () => {
        setError(errorText(await archiveStaff({id: s.id, archived: !s.archived_at})));
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
                    <Button onClick={() => setEditing(null)}>{t.newStaff}</Button>
                </Group>
            </div>

            {error && <Text c="red" size="sm" mb="md">{error}</Text>}

            <Table.ScrollContainer minWidth={560}>
                <Table highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t.order}</Table.Th>
                            <Table.Th>{t.name}</Table.Th>
                            <Table.Th>{t.strengths}</Table.Th>
                            <Table.Th className={styles.right}>{t.actions}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={4}><Text c="dimmed">{t.empty}</Text></Table.Td>
                            </Table.Tr>
                        )}
                        {rows.map((s) => (
                            <Table.Tr key={s.id} className={s.archived_at ? styles.archived : undefined}>
                                <Table.Td>{s.sort_order}</Table.Td>
                                <Table.Td>
                                    {s.name}
                                    {s.archived_at && <Text span c="dimmed" size="sm"> ({t.archived})</Text>}
                                </Table.Td>
                                <Table.Td className={styles.wrap}>{s.strengths}</Table.Td>
                                <Table.Td>
                                    <div className={styles.actions}>
                                        <Button size="xs" variant="default" onClick={() => setEditing(s)}>{common.edit}</Button>
                                        <Button size="xs" variant="default" disabled={pending} onClick={() => toggleArchive(s)}>
                                            {s.archived_at ? common.unarchive : common.archive}
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
                title={editing ? t.editStaff : t.newStaff}
            >
                {editing !== undefined && (
                    <StaffForm
                        key={editing?.id ?? 'new'}
                        member={editing}
                        nextOrder={nextOrder}
                        onDone={() => setEditing(undefined)}
                    />
                )}
            </Modal>
        </section>
    );
}
