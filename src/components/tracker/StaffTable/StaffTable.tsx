'use client';

import {useState, useTransition} from 'react';
import Link from 'next/link';
import {Alert, Badge, Button, Group, Modal, MultiSelect, NumberInput, Switch, Table, Text, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {archiveStaff, createStaff, updateStaff} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import StrengthsManager, {useErrorText} from './StrengthsManager';
import styles from './StaffTable.module.css';

export type StaffRow = Tables<'tracker_staff'> & {strength_ids: string[]};
type Strength = Tables<'tracker_strengths'>;

function StaffForm({member, strengths, nextOrder, onDone}: {
    member: StaffRow | null;
    strengths: Strength[];
    nextOrder: number;
    onDone: (warning?: string) => void; // warning: saved, but a follow-up step failed
}) {
    const {staff: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const form = useForm({
        initialValues: {
            name: member?.name ?? '',
            email: member?.email ?? '',
            strength_ids: member?.strength_ids ?? [],
            // NumberInput yields '' when cleared
            sort_order: (member?.sort_order ?? nextOrder) as number | string,
        },
        // Validated here (form is noValidate) so a bad field shows an inline error instead of a silent no-op.
        validate: {
            name: (v) => (v.trim() ? null : t.nameRequired),
            sort_order: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? null : t.orderInvalid),
        },
    });

    const submit = form.onSubmit(({email, sort_order, ...values}) => startTransition(async () => {
        // email is lowercased and '' → null server-side
        const input = {...values, sort_order: Number(sort_order), email: email.trim() || null};
        const res = member ? await updateStaff({id: member.id, ...input}) : await createStaff(input);
        // detail 'strengths': the row was saved (and the page refreshed); only the strengths sync failed.
        // Close so a retry cannot create a second row; the table shows the warning.
        if (!res.ok && 'detail' in res && res.detail === 'strengths') return onDone(t.error.strengthsPartial);
        // staff email is the only unique field here
        setError(!res.ok && res.error === 'duplicate' ? t.error.emailDuplicate : errorText(res));
        if (res.ok) onDone();
    }));

    return (
        <form onSubmit={submit} noValidate>
            <TextInput label={t.name} required maxLength={80} data-autofocus {...form.getInputProps('name')}/>
            <TextInput label={t.email} description={t.emailHint} type="email" mt="md" maxLength={254} {...form.getInputProps('email')}/>
            <MultiSelect
                label={t.strengths}
                placeholder={t.strengthsPlaceholder}
                mt="md"
                searchable
                clearable
                data={strengths.map((s) => ({value: s.id, label: s.label}))}
                {...form.getInputProps('strength_ids')}
            />
            <NumberInput label={t.order} mt="md" required min={0} allowDecimal={false} {...form.getInputProps('sort_order')}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={() => onDone()}>{common.cancel}</Button>
                <Button type="submit" loading={pending}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function StaffTable({staff, strengths}: {staff: StaffRow[]; strengths: Strength[]}) {
    const {staff: t, common} = useDictionary().tracker;
    const locale = useLocale();
    const errorText = useErrorText();
    const [showArchived, setShowArchived] = useState(false);
    // undefined = modal closed, null = new staff, StaffRow = editing
    const [editing, setEditing] = useState<StaffRow | null | undefined>(undefined);
    const [managing, setManaging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const rows = showArchived ? staff : staff.filter((s) => !s.archived_at);
    // Fixed when "new" is clicked (max + 1 of the current list), not when the form first mounted.
    const [nextOrder, setNextOrder] = useState(1);
    const strengthById = new Map(strengths.map((s) => [s.id, s]));

    const toggleArchive = (s: StaffRow) => startTransition(async () => {
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
                    <Button variant="default" onClick={() => setManaging(true)}>{t.manageStrengths}</Button>
                    <Button
                        onClick={() => {
                            setNextOrder(staff.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1);
                            setEditing(null);
                        }}
                    >
                        {t.newStaff}
                    </Button>
                </Group>
            </div>

            {error && <Alert color="red" mb="md" withCloseButton onClose={() => setError(null)}>{error}</Alert>}

            <Table.ScrollContainer minWidth={720}>
                <Table highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t.order}</Table.Th>
                            <Table.Th>{t.name}</Table.Th>
                            <Table.Th>{t.email}</Table.Th>
                            <Table.Th>{t.strengths}</Table.Th>
                            <Table.Th className={styles.right}>{t.actions}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={5}><Text c="dimmed">{t.empty}</Text></Table.Td>
                            </Table.Tr>
                        )}
                        {rows.map((s) => (
                            <Table.Tr key={s.id} className={s.archived_at ? styles.archived : undefined}>
                                <Table.Td>{s.sort_order}</Table.Td>
                                <Table.Td>
                                    <Link href={`/${locale}/tracker/people/${s.id}`} className={styles.name}>{s.name}</Link>
                                    {s.archived_at && <Text span c="dimmed" size="sm"> ({t.archived})</Text>}
                                </Table.Td>
                                <Table.Td><Text size="sm" c="dimmed">{s.email}</Text></Table.Td>
                                <Table.Td>
                                    <div className={styles.chips}>
                                        {s.strength_ids.flatMap((id) => {
                                            const st = strengthById.get(id);
                                            return st ? [
                                                <Badge key={id} variant={st.all_rounder ? 'filled' : 'light'} color="gray" tt="none">
                                                    {st.label}
                                                </Badge>,
                                            ] : [];
                                        })}
                                    </div>
                                </Table.Td>
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
                        strengths={strengths}
                        nextOrder={nextOrder}
                        onDone={(warning) => {
                            setEditing(undefined);
                            if (warning) setError(warning);
                        }}
                    />
                )}
            </Modal>

            <Modal opened={managing} onClose={() => setManaging(false)} title={t.strengthsTitle}>
                <StrengthsManager strengths={strengths}/>
            </Modal>
        </section>
    );
}
