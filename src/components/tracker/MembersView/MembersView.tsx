'use client';

import {useState} from 'react';
import {
    ActionIcon, Badge, Button, CloseButton, ColorInput, Group, Modal, MultiSelect, Select, Text, TextInput, Tooltip, VisuallyHidden,
} from '@mantine/core';
import {IconCheck, IconPencil, IconTrash, IconX} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {
    copyMembers, createDepartment, deleteDepartment, removeMember, setMemberDepartments, updateDepartment, type ActionResult,
} from '@/app/[locale]/tracker/actions';
import type {Tables} from '@/types/database.types';
import {memberSet, type Department, type MemberRow} from '../members';
import {foldFilter} from '../staffView';
import {useRealtimeBusy} from '../useRealtimeRefresh';
import ProjectViewTabs from '../ProjectViewTabs/ProjectViewTabs';
import {COLOR_INPUT_PROPS} from '../WorkTypesEditor/WorkTypesEditor';
import {fill} from '../GanttBoard/GanttBoard';
import styles from './MembersView.module.css';

type Staff = Pick<Tables<'tracker_staff'>, 'id' | 'name' | 'archived_at' | 'sort_order'>;

interface Props {
    project: Tables<'tracker_projects'>;
    /** `?m=` of the board, passed through to the view tabs only. */
    month?: string;
    /** By sort_order, name. */
    departments: Department[];
    members: MemberRow[];
    /** Every staff, by sort_order, name. */
    staff: Staff[];
    strengths: {id: string; label: string}[];
    staffStrengths: {staff_id: string; strength_id: string}[];
    /** Every task of the project (owner counts). */
    tasks: {id: string; staff_id: string}[];
    /** Other non-archived projects (copy sources). */
    projects: {id: string; name: string}[];
}

const SWATCHES = ['#868e96', '#fa5252', '#e64980', '#be4bdb', '#7950f2', '#4c6ef5', '#228be6', '#15aabf', '#12b886', '#40c057', '#fab005', '#fd7e14'];
const NEW_COLOR = SWATCHES[6];

type Dialog =
    | {kind: 'add'}
    | {kind: 'edit'; staff: Staff}
    | {kind: 'remove'; staff: Staff}
    | {kind: 'copy'};

const run = <T, >(p: Promise<ActionResult<T>>) => p.catch(() => ({ok: false, error: 'network'}) as const);

export default function MembersView({project, month, departments, members, staff, strengths, staffStrengths, tasks, projects}: Props) {
    const {members: t, common, cuts, staff: staffDict, board} = useDictionary().tracker;
    const [notice, setNoticeState] = useState<{text: string; ok: boolean} | null>(null);
    const setNotice = (text: string | null, ok = false) => setNoticeState(text === null ? null : {text, ok});
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [deptPending, setDeptPending] = useState(false);
    const [editDept, setEditDept] = useState<{id: string; name: string; color: string} | null>(null);
    const [newDept, setNewDept] = useState({name: '', color: NEW_COLOR});
    useRealtimeBusy(dialog !== null || editDept !== null || newDept.name.trim() !== '');

    const memberMap = memberSet(members, departments);
    const deptById = new Map(departments.map((d) => [d.id, d]));
    const deptCount = new Map<string, number>();
    for (const ids of memberMap.values()) for (const id of ids) deptCount.set(id, (deptCount.get(id) ?? 0) + 1);
    const strengthLabel = new Map(strengths.map((s) => [s.id, s.label]));
    const strengthsByStaff = new Map<string, string[]>();
    for (const r of staffStrengths) {
        const label = strengthLabel.get(r.strength_id);
        if (label) strengthsByStaff.set(r.staff_id, [...(strengthsByStaff.get(r.staff_id) ?? []), label]);
    }
    const taskCount = new Map<string, number>();
    for (const x of tasks) taskCount.set(x.staff_id, (taskCount.get(x.staff_id) ?? 0) + 1);
    const memberStaff = staff.filter((s) => memberMap.has(s.id));
    const deptOptions = departments.map((d) => ({value: d.id, label: d.name}));

    /** `picked`: the add/edit member submit, where 'invalid' means a picked department was deleted meanwhile. */
    const errorText = (r: {error: string}, picked = false) => {
        switch (r.error) {
            case 'in_use':
                return t.departmentInUse;
            case 'duplicate':
                return t.nameTaken;
            case 'invalid':
                return picked ? t.departmentGone : cuts.invalid;
            case 'staff_archived':
                return t.staffArchived;
            case 'staff_not_member':
                return board.staffNotMember;
            case 'not_found':
                return common.error.notFound;
            case 'network':
                return common.error.network;
            default:
                return common.error.generic;
        }
    };

    const open = (d: Dialog) => {
        setDialogError(null);
        setDialog(d);
    };

    /** Runs a dialog action; on success closes the dialog and returns the data, else shows the error in the dialog. */
    const submit = async <T, >(p: Promise<ActionResult<T>>, picked = false): Promise<T | undefined> => {
        setPending(true);
        const r = await run(p);
        setPending(false);
        if (!r.ok) {
            setDialogError(errorText(r, picked));
            return undefined;
        }
        setDialog(null);
        setNotice(null);
        return r.data;
    };

    /** Add ('add') or edit ('set') members with the picked departments that still exist. */
    const saveMembers = (staffIds: string[], picked: string[], mode: 'set' | 'add') => {
        const departmentIds = picked.filter((id) => deptById.has(id));
        if (departmentIds.length === 0) return setDialogError(t.departmentGone);
        void submit(setMemberDepartments({projectId: project.id, staffIds, departmentIds, mode}), true);
    };

    // inline department add / rename / delete: one request at a time
    const deptRun = async <T, >(p: () => Promise<ActionResult<T>>): Promise<boolean> => {
        if (deptPending) return false;
        setDeptPending(true);
        const r = await run(p());
        setDeptPending(false);
        setNotice(r.ok ? null : errorText(r));
        return r.ok;
    };

    const addDept = async () => {
        if (await deptRun(() => createDepartment({projectId: project.id, name: newDept.name, color: newDept.color}))) {
            setNewDept({name: '', color: NEW_COLOR});
        }
    };

    const saveDept = async () => {
        if (editDept && await deptRun(() => updateDepartment(editDept))) setEditDept(null);
    };

    const removeDept = async (id: string) => {
        await deptRun(() => deleteDepartment({id}));
    };

    return (
        <section className={styles.page}>
            <header className={styles.intro}>
                <div>
                    <Text size="sm" c="dimmed">{cuts.kicker} · {project.name}</Text>
                    <h1 className={styles.title}>{t.title}</h1>
                    <Text size="sm" c="dimmed">{t.hint}</Text>
                </div>
                <ProjectViewTabs projectId={project.id} active="members" month={month}/>
            </header>

            <div className={styles.toolbar}>
                {notice && (
                    <Text
                        c={notice.ok ? 'dimmed' : 'red'}
                        size="sm"
                        role={notice.ok ? 'status' : 'alert'}
                        style={{display: 'flex', alignItems: 'center', gap: 8}}
                    >
                        {notice.text}
                        <CloseButton size="sm" aria-label={board.dismiss} onClick={() => setNotice(null)}/>
                    </Text>
                )}
                <div className={styles.toolbarEnd}>
                    <Button variant="default" disabled={departments.length === 0} onClick={() => open({kind: 'add'})}>
                        {t.addMembers}
                    </Button>
                    <Button variant="default" disabled={projects.length === 0} onClick={() => open({kind: 'copy'})}>
                        {t.copyFrom}
                    </Button>
                </div>
            </div>

            <h2 className={styles.heading}>{t.departments}</h2>
            <div className={styles.block}>
                {departments.length === 0 && <Text size="sm" c="dimmed" p="sm">{t.noDepartments}</Text>}
                {departments.map((d) => {
                    const count = deptCount.get(d.id) ?? 0;
                    if (editDept?.id === d.id) {
                        return (
                            <form
                                key={d.id}
                                className={styles.deptRow}
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void saveDept();
                                }}
                            >
                                <TextInput
                                    aria-label={t.departmentName}
                                    size="xs"
                                    maxLength={40}
                                    required
                                    autoFocus
                                    value={editDept.name}
                                    onChange={(e) => setEditDept({...editDept, name: e.currentTarget.value})}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') setEditDept(null);
                                    }}
                                />
                                <ColorInput
                                    aria-label={t.color}
                                    size="xs"
                                    format="hex"
                                    swatches={SWATCHES}
                                    {...COLOR_INPUT_PROPS}
                                    value={editDept.color}
                                    onChange={(color) => setEditDept({...editDept, color})}
                                    className={styles.color}
                                />
                                <ActionIcon type="submit" variant="default" aria-label={common.save} disabled={!editDept.name.trim()} loading={deptPending}>
                                    <IconCheck size={14}/>
                                </ActionIcon>
                                <ActionIcon variant="subtle" color="gray" aria-label={common.cancel} disabled={deptPending} onClick={() => setEditDept(null)}>
                                    <IconX size={14}/>
                                </ActionIcon>
                            </form>
                        );
                    }
                    return (
                        <div key={d.id} className={styles.deptRow}>
                            <span className={styles.swatch} style={{background: d.color}}/>
                            <span className={styles.deptName}>{d.name}</span>
                            <Text size="sm" c="dimmed">{fill(t.memberCount, {count})}</Text>
                            <span className={styles.rowEnd}>
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    aria-label={`${common.edit} ${d.name}`}
                                    onClick={() => setEditDept({id: d.id, name: d.name, color: d.color})}
                                >
                                    <IconPencil size={14}/>
                                </ActionIcon>
                                {/* blocked: aria-disabled + data-disabled (not `disabled`) keeps it focusable, so the
                                    tooltip shows on hover and focus and the reason is announced via aria-describedby */}
                                <Tooltip label={t.deleteBlocked} disabled={count === 0}>
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        aria-label={`${t.deleteDepartment} ${d.name}`}
                                        aria-disabled={count > 0 || deptPending}
                                        data-disabled={count > 0 || deptPending || undefined}
                                        aria-describedby={count > 0 ? `dept-blocked-${d.id}` : undefined}
                                        onClick={() => {
                                            if (count === 0) void removeDept(d.id);
                                        }}
                                    >
                                        <IconTrash size={14}/>
                                    </ActionIcon>
                                </Tooltip>
                                {count > 0 && <VisuallyHidden id={`dept-blocked-${d.id}`}>{t.deleteBlocked}</VisuallyHidden>}
                            </span>
                        </div>
                    );
                })}
                <form
                    className={styles.deptRow}
                    onSubmit={(e) => {
                        e.preventDefault();
                        void addDept();
                    }}
                >
                    <TextInput
                        aria-label={t.departmentName}
                        placeholder={t.departmentName}
                        size="xs"
                        maxLength={40}
                        value={newDept.name}
                        onChange={(e) => setNewDept({...newDept, name: e.currentTarget.value})}
                    />
                    <ColorInput
                        aria-label={t.color}
                        size="xs"
                        format="hex"
                        swatches={SWATCHES}
                        {...COLOR_INPUT_PROPS}
                        value={newDept.color}
                        onChange={(color) => setNewDept({...newDept, color})}
                        className={styles.color}
                    />
                    <Button type="submit" size="xs" variant="default" disabled={!newDept.name.trim()} loading={deptPending}>{t.addDepartment}</Button>
                </form>
            </div>

            <h2 className={styles.heading}>{t.title}</h2>
            {memberStaff.length === 0 ? (
                <Text c="dimmed">{t.noMembers}</Text>
            ) : (
                <div className={styles.scroll}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th scope="col">{t.colName}</th>
                                <th scope="col">{t.colDepartments}</th>
                                <th scope="col">{t.colStrengths}</th>
                                <th scope="col" className={styles.num}>{t.colTasks}</th>
                                <th scope="col" className={styles.actions}>{t.actions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberStaff.map((s) => (
                                <tr key={s.id} className={s.archived_at ? styles.archived : undefined}>
                                    <th scope="row">
                                        {s.name}
                                        {s.archived_at && <Badge ml={6} size="xs" color="gray" variant="light">{staffDict.archived}</Badge>}
                                    </th>
                                    <td>
                                        <span className={styles.chips}>
                                            {(memberMap.get(s.id) ?? []).map((id) => {
                                                const d = deptById.get(id)!;
                                                return (
                                                    <span key={id} className={styles.chip}>
                                                        <span className={styles.dot} style={{background: d.color}}/>
                                                        {d.name}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    </td>
                                    <td className={styles.dim}>{(strengthsByStaff.get(s.id) ?? []).join(', ')}</td>
                                    <td className={styles.num}>{taskCount.get(s.id) ?? 0}</td>
                                    <td>
                                        <Group gap={4} justify="flex-end" wrap="nowrap">
                                            <Button size="compact-xs" variant="subtle" onClick={() => open({kind: 'edit', staff: s})}>
                                                {t.edit}
                                            </Button>
                                            <Button size="compact-xs" variant="subtle" color="red" onClick={() => open({kind: 'remove', staff: s})}>
                                                {t.remove}
                                            </Button>
                                        </Group>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {dialog?.kind === 'add' && (
                <AddMembersModal
                    staffOptions={staff.filter((s) => !s.archived_at && !memberMap.has(s.id)).map((s) => ({value: s.id, label: s.name}))}
                    deptOptions={deptOptions}
                    pending={pending}
                    error={dialogError}
                    onClose={() => setDialog(null)}
                    onSave={(staffIds, departmentIds) => saveMembers(staffIds, departmentIds, 'add')}
                />
            )}
            {dialog?.kind === 'edit' && (
                <EditMemberModal
                    name={dialog.staff.name}
                    initial={memberMap.get(dialog.staff.id) ?? []}
                    deptOptions={deptOptions}
                    pending={pending}
                    error={dialogError}
                    onClose={() => setDialog(null)}
                    onSave={(departmentIds) => saveMembers([dialog.staff.id], departmentIds, 'set')}
                />
            )}
            {dialog?.kind === 'remove' && (() => {
                const n = taskCount.get(dialog.staff.id) ?? 0;
                return (
                    <Modal opened onClose={() => setDialog(null)} title={fill(t.removeTitle, {name: dialog.staff.name})} {...locked(pending)}>
                        {n > 0 && <Text size="sm">{fill(t.removeKeepsTasks, {count: n})}</Text>}
                        {dialogError && <Text c="red" size="sm" mt="sm" role="alert">{dialogError}</Text>}
                        <Group justify="flex-end" mt="md">
                            <Button variant="default" disabled={pending} onClick={() => setDialog(null)}>{common.cancel}</Button>
                            <Button
                                color="red"
                                loading={pending}
                                onClick={() => void submit(removeMember({projectId: project.id, staffId: dialog.staff.id}))}
                            >
                                {t.remove}
                            </Button>
                        </Group>
                    </Modal>
                );
            })()}
            {dialog?.kind === 'copy' && (
                <CopyMembersModal
                    title={t.copyFrom}
                    label={t.copySource}
                    options={projects.map((p) => ({value: p.id, label: p.name}))}
                    pending={pending}
                    error={dialogError}
                    onClose={() => setDialog(null)}
                    onSave={async (fromId) => {
                        const data = await submit(copyMembers({fromId, toId: project.id}));
                        if (data) setNotice(fill(t.copied, {count: data.added}), true);
                    }}
                />
            )}
        </section>
    );
}

type Option = {value: string; label: string};

/** While a request runs the dialog can only be left through its result (no X, Esc or outside click). */
const locked = (pending: boolean) => ({withCloseButton: !pending, closeOnEscape: !pending, closeOnClickOutside: !pending});
type ModalBase = {pending: boolean; error: string | null; onClose: () => void};

function ModalFooter({pending, error, disabled, onClose}: ModalBase & {disabled: boolean}) {
    const {common} = useDictionary().tracker;
    return (
        <>
            {error && <Text c="red" size="sm" mt="sm" role="alert">{error}</Text>}
            <Group justify="flex-end" mt="md">
                <Button variant="default" disabled={pending} onClick={onClose}>{common.cancel}</Button>
                <Button type="submit" loading={pending} disabled={disabled}>{common.save}</Button>
            </Group>
        </>
    );
}

function AddMembersModal({staffOptions, deptOptions, onSave, ...base}: ModalBase & {
    staffOptions: Option[];
    deptOptions: Option[];
    onSave: (staffIds: string[], departmentIds: string[]) => void;
}) {
    const t = useDictionary().tracker.members;
    const [staffIds, setStaffIds] = useState<string[]>([]);
    const [departmentIds, setDepartmentIds] = useState<string[]>([]);
    return (
        <Modal opened onClose={base.onClose} {...locked(base.pending)} title={t.addMembers}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(staffIds, departmentIds);
                }}
            >
                <MultiSelect
                    label={t.staffPick}
                    data={staffOptions}
                    value={staffIds}
                    onChange={setStaffIds}
                    searchable
                    filter={foldFilter}
                    data-autofocus
                />
                <MultiSelect
                    mt="sm"
                    label={t.departmentsPick}
                    data={deptOptions}
                    value={departmentIds}
                    onChange={setDepartmentIds}
                    searchable
                    filter={foldFilter}
                />
                <ModalFooter {...base} disabled={staffIds.length === 0 || departmentIds.length === 0}/>
            </form>
        </Modal>
    );
}

function EditMemberModal({name, initial, deptOptions, onSave, ...base}: ModalBase & {
    name: string;
    initial: string[];
    deptOptions: Option[];
    onSave: (departmentIds: string[]) => void;
}) {
    const t = useDictionary().tracker.members;
    const [departmentIds, setDepartmentIds] = useState(initial);
    return (
        <Modal opened onClose={base.onClose} {...locked(base.pending)} title={`${t.edit} · ${name}`}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    onSave(departmentIds);
                }}
            >
                <MultiSelect
                    label={t.departmentsPick}
                    data={deptOptions}
                    value={departmentIds}
                    onChange={setDepartmentIds}
                    searchable
                    filter={foldFilter}
                    error={departmentIds.length === 0 ? t.departmentsRequired : undefined}
                    data-autofocus
                />
                <ModalFooter {...base} disabled={departmentIds.length === 0}/>
            </form>
        </Modal>
    );
}

function CopyMembersModal({title, label, options, onSave, ...base}: ModalBase & {
    title: string;
    label: string;
    options: Option[];
    onSave: (fromId: string) => void;
}) {
    const [fromId, setFromId] = useState<string | null>(null);
    return (
        <Modal opened onClose={base.onClose} {...locked(base.pending)} title={title}>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (fromId) onSave(fromId);
                }}
            >
                <Select label={label} data={options} value={fromId} onChange={setFromId} searchable filter={foldFilter} data-autofocus/>
                <ModalFooter {...base} disabled={!fromId}/>
            </form>
        </Modal>
    );
}
