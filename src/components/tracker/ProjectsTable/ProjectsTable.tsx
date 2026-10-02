'use client';

import {useState, useTransition} from 'react';
import Link from 'next/link';
import {Button, ColorInput, Group, Modal, Switch, Table, Text, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {
    archiveProject, createProject, saveWorkTypes, updateProject, type ActionResult,
} from '@/app/[locale]/tracker/actions';
import {DEFAULT_WORK_TYPES} from '@/components/tracker/defaults';
import WorkTypesEditor, {COLOR_INPUT_PROPS, type EditorType, typesValid} from '@/components/tracker/WorkTypesEditor/WorkTypesEditor';
import LinksEditor from '@/components/tracker/LinksEditor/LinksEditor';
import {cleanLinks, linksValid, sanitizeLinks} from '@/components/tracker/links';
import type {Tables} from '@/types/database.types';
import styles from './ProjectsTable.module.css';

type Project = Tables<'tracker_projects'>;
export type ProjectWorkType = Tables<'tracker_work_types'> & {used: boolean};

// Fixed locale + zone so server and client render the same string (no hydration mismatch).
const dateFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh'});

function useErrorText() {
    const {common, workTypesEditor: {error: wt}} = useDictionary().tracker;
    const byError: Partial<Record<string, string>> = {
        not_found: common.error.notFound,
        network: common.error.network,
        pct_total: wt.pctTotal,
        in_use: wt.inUse,
        duplicate: wt.duplicate,
        invalid: wt.invalid,
    };
    return (res: ActionResult<unknown>) => (res.ok ? null : byError[res.error] ?? common.error.generic);
}

// What saveWorkTypes receives; also used to detect edits.
const payload = (rows: EditorType[]) => rows.map(({id, code, label, color, pay_pct, sort_order}) => ({
    ...(id && {id}), code: code.trim(), label: label.trim(), color, pay_pct: Number(pay_pct) || 0, sort_order,
}));

function ProjectForm({project, types, onDone}: {project: Project | null; types: ProjectWorkType[]; onDone: () => void}) {
    const {projects: t, common, links: tl} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [links, setLinks] = useState(() => sanitizeLinks(project?.links));
    const [initialRows] = useState<EditorType[]>(() => project
        ? types.map((w) => ({...w, key: w.id}))
        : DEFAULT_WORK_TYPES.map((w) => ({...w, key: w.code, used: false})));
    const [rows, setRows] = useState(initialRows);
    // Set once created, so a retry after a failed work-type save updates instead of creating a second project.
    const [projectId, setProjectId] = useState(project?.id ?? null);
    const form = useForm({
        initialValues: {name: project?.name ?? '', color: project?.color ?? '#e8192c'},
    });

    const submit = form.onSubmit((values) => startTransition(async () => {
        const typesEdited = JSON.stringify(payload(rows)) !== JSON.stringify(payload(initialRows));
        let id = projectId;
        if (id) {
            const res = await updateProject({id, ...values, links: cleanLinks(links)});
            if (!res.ok) return setError(errorText(res));
        } else {
            // The RPC creates DEFAULT_WORK_TYPES; edited defaults and links are saved right after.
            const res = await createProject(values);
            if (!res.ok) return setError(errorText(res));
            id = res.data.id;
            setProjectId(id);
            if (links.length) {
                const linked = await updateProject({id, links: cleanLinks(links)});
                if (!linked.ok) return setError(errorText(linked));
            }
        }
        if (typesEdited) {
            const res = await saveWorkTypes({project_id: id, types: payload(rows)});
            if (!res.ok) return setError(errorText(res));
        }
        onDone();
    }));

    return (
        <form onSubmit={submit}>
            <TextInput label={t.name} required maxLength={80} data-autofocus {...form.getInputProps('name')}/>
            <ColorInput label={t.color} mt="md" format="hex" required {...COLOR_INPUT_PROPS} {...form.getInputProps('color')}/>
            <Text fw={500} size="sm" mt="lg" mb={4}>{tl.project}</Text>
            <LinksEditor value={links} onChange={setLinks}/>
            <Text fw={500} size="sm" mt="lg" mb={4}>{t.workTypes}</Text>
            <WorkTypesEditor value={rows} onChange={setRows}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onDone}>{common.cancel}</Button>
                <Button type="submit" loading={pending} disabled={!typesValid(rows) || !linksValid(links)}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function ProjectsTable({projects, workTypes}: {projects: Project[]; workTypes: ProjectWorkType[]}) {
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
                size="xl"
            >
                {editing !== undefined && (
                    <ProjectForm
                        key={editing?.id ?? 'new'}
                        project={editing}
                        types={editing ? workTypes.filter((w) => w.project_id === editing.id) : []}
                        onDone={() => setEditing(undefined)}
                    />
                )}
            </Modal>
        </section>
    );
}
