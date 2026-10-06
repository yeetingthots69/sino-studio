'use client';

import {useState, useTransition} from 'react';
import Link from 'next/link';
import {Anchor, Button, ColorInput, Group, Modal, Switch, Table, Text, TextInput, Title} from '@mantine/core';
import {useForm} from '@mantine/form';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {
    archiveProject, createProject, saveWorkTypes, updateProject, type ActionResult,
} from '@/app/[locale]/tracker/actions';
import {DEFAULT_WORK_TYPES} from '@/components/tracker/defaults';
import {COLOR_INPUT_PROPS} from '@/components/tracker/WorkTypesEditor/WorkTypesEditor';
import PhasesEditor from '@/components/tracker/PhasesEditor/PhasesEditor';
import {draftIssues, draftToPayload, type PhaseDraft} from '@/components/tracker/PhasesEditor/phaseDraft';
import {sortPhases} from '@/components/tracker/phases';
import LinksEditor from '@/components/tracker/LinksEditor/LinksEditor';
import {cleanLinks, linksValid, sanitizeLinks} from '@/components/tracker/links';
import type {Tables} from '@/types/database.types';
import styles from './ProjectsTable.module.css';

type Project = Tables<'tracker_projects'>;
type WorkType = Tables<'tracker_work_types'>;
type ProjectPhase = Pick<Tables<'tracker_phases'>, 'id' | 'project_id' | 'name' | 'sort_order' | 'after'>;

// Fixed locale + zone so server and client render the same string (no hydration mismatch).
const dateFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh'});

function useErrorText() {
    const {common, board, workTypesEditor: {error: wt}} = useDictionary().tracker;
    const byError: Partial<Record<string, string>> = {
        not_found: common.error.notFound,
        network: common.error.network,
        pct_total: wt.pctTotal,
        in_use: wt.inUse,
        duplicate: wt.duplicate,
        invalid: wt.invalid,
        phase_locked: board.phaseLocked,
        phase_invalid: board.phaseInvalid,
    };
    return (res: ActionResult<unknown>) => {
        if (res.ok) return null;
        if (res.error === 'overlap_in_use') return wt.overlapInUse.replace('{cut}', res.detail ?? '?');
        return byError[res.error] ?? common.error.generic;
    };
}

// What saveWorkTypes receives (edit mode); also used to detect edits. The first stage of a phase never overlaps (O4).
const editPayload = (drafts: PhaseDraft[]) => drafts.flatMap((p) => p.types.map((w, i) => ({
    id: w.id!, label: w.label.trim(), color: w.color, pay_pct: Number(w.pay_pct) || 0, overlaps_prev: i > 0 && w.overlaps_prev,
})));

function ProjectForm({project, types, phases, onDone}: {
    project: Project | null;
    types: WorkType[];
    phases: ProjectPhase[];
    onDone: () => void;
}) {
    const {projects: t, common, links: tl, phasesEditor: pe} = useDictionary().tracker;
    const errorText = useErrorText();
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const [links, setLinks] = useState(() => sanitizeLinks(project?.links));
    // Edit: the stored phases (types are loaded sorted by sort_order). Create: one phase "Animation" (D4, never translated).
    const [initial] = useState<PhaseDraft[]>(() => project
        ? sortPhases(phases).map((p) => ({
            key: p.id, name: p.name, after: p.after,
            types: types.filter((w) => w.phase_id === p.id).map((w) => ({...w, key: w.id, used: true})),
        }))
        : [{key: 'animation', name: 'Animation', after: [], types: DEFAULT_WORK_TYPES.map((w) => ({...w, key: w.code, used: false}))}]);
    const [drafts, setDrafts] = useState(initial);
    // Set once created, so a retry after a failed links save updates instead of creating a second project.
    const [projectId, setProjectId] = useState(project?.id ?? null);
    // Locked once the project exists (also after a create whose links save failed): phases can no longer change.
    const locked = !!project || !!projectId;
    // After such a partial create the stages are frozen too: the retry only updates the project, so edits would be lost.
    const frozen = !project && !!projectId;
    const form = useForm({
        initialValues: {name: project?.name ?? '', color: project?.color ?? '#e8192c'},
    });

    const submit = form.onSubmit((values) => startTransition(async () => {
        if (projectId) {
            const res = await updateProject({id: projectId, ...values, links: cleanLinks(links)});
            if (!res.ok) return setError(errorText(res));
            if (project && JSON.stringify(editPayload(drafts)) !== JSON.stringify(editPayload(initial))) {
                const saved = await saveWorkTypes({project_id: projectId, types: editPayload(drafts)});
                if (!saved.ok) return setError(errorText(saved));
            }
        } else {
            // One RPC creates the project with its phases and stages; links are saved right after.
            const res = await createProject({...values, phases: draftToPayload(drafts)});
            // 23505 here is the phase-name unique index (codes are checked exactly on the client)
            if (!res.ok) return setError(res.error === 'duplicate' ? pe.issues.phaseNameDup : errorText(res));
            setProjectId(res.data.id);
            if (links.length) {
                const linked = await updateProject({id: res.data.id, links: cleanLinks(links)});
                if (!linked.ok) return setError(errorText(linked));
            }
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
            <PhasesEditor value={drafts} onChange={frozen ? () => {} : setDrafts} locked={locked}/>
            {error && <Text c="red" size="sm" mt="md">{error}</Text>}
            <Group justify="flex-end" mt="lg">
                <Button variant="default" onClick={onDone}>{common.cancel}</Button>
                <Button type="submit" loading={pending} disabled={draftIssues(drafts, locked).length > 0 || !linksValid(links)}>{common.save}</Button>
            </Group>
        </form>
    );
}

export default function ProjectsTable({projects, workTypes, phases}: {
    projects: Project[];
    workTypes: WorkType[];
    phases: ProjectPhase[];
}) {
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
                                    <Anchor component={Link} href={`/${locale}/tracker/${p.id}`} c="inherit">{p.name}</Anchor>
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
                size={1240}
            >
                {editing !== undefined && (
                    <ProjectForm
                        key={editing?.id ?? 'new'}
                        project={editing}
                        types={editing ? workTypes.filter((w) => w.project_id === editing.id) : []}
                        phases={editing ? phases.filter((p) => p.project_id === editing.id) : []}
                        onDone={() => setEditing(undefined)}
                    />
                )}
            </Modal>
        </section>
    );
}
