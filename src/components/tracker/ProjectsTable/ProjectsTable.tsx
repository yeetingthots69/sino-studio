'use client';

import {useState, useTransition} from 'react';
import Link from 'next/link';
import {Button, ColorInput, Group, Modal, Switch, Table, Text, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {archiveProject, createProject, updateProject, type ActionResult} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import styles from './ProjectsTable.module.css';

type Project = Tables<'tracker_projects'>;

// Fixed locale + zone so server and client render the same string (no hydration mismatch).
const dateFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh'});

function useErrorText() {
    const common = useDictionary().tracker.common;
    return (res: ActionResult<unknown>) =>
        res.ok ? null : res.error === 'not_found' ? common.error.notFound : common.error.generic;
}

function ProjectForm({project, onDone}: {project: Project | null; onDone: () => void}) {
    const {projects: t, common} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const form = useForm({
        initialValues: {name: project?.name ?? '', color: project?.color ?? '#e8192c'},
    });

    const submit = form.onSubmit((values) => startTransition(async () => {
        const res = project
            ? await updateProject({id: project.id, ...values})
            : await createProject(values);
        setError(errorText(res));
        if (res.ok) onDone();
    }));

    return (
        <form onSubmit={submit}>
            <TextInput label={t.name} required maxLength={80} data-autofocus {...form.getInputProps('name')}/>
            <ColorInput label={t.color} mt="md" format="hex" required {...form.getInputProps('color')}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onDone}>{common.cancel}</Button>
                <Button type="submit" loading={pending}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function ProjectsTable({projects}: {projects: Project[]}) {
    const {projects: t, common} = useDictionary().tracker;
    const locale = useLocale();
    const errorText = useErrorText();
    const [showArchived, setShowArchived] = useState(false);
    // undefined = modal closed, null = new project, Project = editing
    const [editing, setEditing] = useState<Project | null | undefined>(undefined);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const rows = showArchived ? projects : projects.filter((p) => !p.archived_at);

    const toggleArchive = (p: Project) => startTransition(async () => {
        setError(errorText(await archiveProject({id: p.id, archived: !p.archived_at})));
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
                    <Button onClick={() => setEditing(null)}>{t.newProject}</Button>
                </Group>
            </div>

            {error && <Text c="red" size="sm" mb="md">{error}</Text>}

            <Table.ScrollContainer minWidth={560}>
                <Table highlightOnHover>
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>{t.color}</Table.Th>
                            <Table.Th>{t.name}</Table.Th>
                            <Table.Th>{t.created}</Table.Th>
                            <Table.Th className={styles.right}>{t.actions}</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.length === 0 && (
                            <Table.Tr>
                                <Table.Td colSpan={4}><Text c="dimmed">{t.empty}</Text></Table.Td>
                            </Table.Tr>
                        )}
                        {rows.map((p) => (
                            <Table.Tr key={p.id} className={p.archived_at ? styles.archived : undefined}>
                                <Table.Td><div className={styles.swatch} style={{background: p.color}}/></Table.Td>
                                <Table.Td>
                                    {p.name}
                                    {p.archived_at && <Text span c="dimmed" size="sm"> ({t.archived})</Text>}
                                </Table.Td>
                                <Table.Td>{dateFmt.format(new Date(p.created_at))}</Table.Td>
                                <Table.Td>
                                    <div className={styles.actions}>
                                        <Button size="xs" variant="subtle" component={Link} href={`/${locale}/tracker/${p.id}`}>
                                            {t.open}
                                        </Button>
                                        <Button size="xs" variant="default" onClick={() => setEditing(p)}>{common.edit}</Button>
                                        <Button size="xs" variant="default" disabled={pending} onClick={() => toggleArchive(p)}>
                                            {p.archived_at ? common.unarchive : common.archive}
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
                title={editing ? t.editProject : t.newProject}
            >
                {editing !== undefined && (
                    <ProjectForm key={editing?.id ?? 'new'} project={editing} onDone={() => setEditing(undefined)}/>
                )}
            </Modal>
        </section>
    );
}
