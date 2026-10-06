'use client';

import {useState} from 'react';
import {Button, Drawer, SegmentedControl, Select, Text, Textarea, TextInput} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {addAdjustments, reverseAdjustment, sendResources, updateCut} from '@/app/[locale]/tracker/actions';
import SendMailButton from '../SendMailButton/SendMailButton';
import LinksEditor, {LinksList} from '../LinksEditor/LinksEditor';
import {cleanLinks, sanitizeLinks, type Link} from '../links';
import type {Json} from '@/types/database.types';
import {formatVnd} from '../earnings';
import {useRealtimeBusy} from '../useRealtimeRefresh';
import {cutBudget, phaseSplit, stagePct, typeIdsByPhase, type PayLine} from '../pay';
import type {Phase} from '../phases';
import {ddmm} from '../GanttBoard/boardHelpers';
import {amountOk, auditChanges, budgetEntries, formatAmountInput, parseAmount, stagePeople} from './cutsViewHelpers';
import type {Adjustment, AuditRow, Cut, Staff, Task, WorkType} from './CutsView';
import styles from './CutsView.module.css';

interface Props {
    opened: boolean;
    onClose: () => void;
    projectId: string;
    /** op_id for the first add; a fresh one is made after every successful save. */
    initialOpId: string;
    cut?: Cut;
    workType?: WorkType;
    /** Every type of the project (pay split audit rows). */
    workTypes: WorkType[];
    /** The project's phases by sort_order (audit budgets / splits per phase). */
    phases: Phase[];
    task?: Task;
    line?: PayLine;
    /** This stage's adjustments (any order). */
    adjustments: Adjustment[];
    /** Every adjustment of the project (batch sizes). */
    allAdjustments: Adjustment[];
    staff: Staff[];
    /** Distinct assignees of this cut's tasks ("Gửi tài liệu" recipients). */
    cutStaffIds: string[];
    /** Audit rows of this cut and this work type, newest first. */
    audit: AuditRow[];
    /** Read-only project links. */
    projectLinks: Link[];
}

// Fixed locale + zone so server and client agree.
const stamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const MIN_REASON = 3;

/** Stage drawer (plan §3.5): pay formula, people, adjustments + add / undo, audit. */
export default function CutDrawer(props: Props) {
    const {opened, onClose, projectId, initialOpId, cut, workType, workTypes, phases, task, line, adjustments, allAdjustments, staff, cutStaffIds, audit, projectLinks} = props;
    const {cuts: t, common, links: tl, mail: tm} = useDictionary().tracker;
    const staffById = new Map(staff.map((s) => [s.id, s]));
    const name = (id: string | null | undefined) => (id && staffById.get(id)?.name) || t.unknownStaff;
    const activeStaff = staff.filter((s) => !s.archived_at);

    // add form
    const [opId, setOpId] = useState(initialOpId);
    const [staffId, setStaffId] = useState<string | null>(
        task && staffById.get(task.staff_id)?.archived_at == null ? task.staff_id : null);
    const [sign, setSign] = useState<'1' | '-1'>('1');
    const [amount, setAmount] = useState('');
    const [tried, setTried] = useState(false); // inline amount error after the first save attempt
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // a 'network' result may have been saved: inputs lock, only a same-op_id retry or closing is allowed
    const [stuck, setStuck] = useState(false);
    // undo: op_id made when the inline form opens
    const [undo, setUndo] = useState<
        {id: string; opId: string; reason: string; busy: boolean; error: string | null; stuck: boolean} | null
    >(null);
    // cut links draft (null = showing the saved links)
    const [linksDraft, setLinksDraft] = useState<Link[] | null>(null);
    const [linksBusy, setLinksBusy] = useState(false);
    const [linksError, setLinksError] = useState<string | null>(null);

    // realtime refreshes wait while the add / undo forms hold input
    const linksDiffer = linksDraft !== null
        && JSON.stringify(cleanLinks(linksDraft)) !== JSON.stringify(sanitizeLinks(cut?.links));
    useRealtimeBusy(opened && (busy || stuck || amount !== '' || reason.trim() !== '' || undo !== null
        || linksBusy || linksDiffer));

    if (!cut || !workType) return <Drawer opened={false} onClose={onClose}>{null}</Drawer>;

    const errorText = (e: string) =>
        e === 'invalid' ? t.adjInvalid : e === 'network' ? t.retryHint : common.error.generic;

    const people = stagePeople(line, adjustments, (a, b) => name(a).localeCompare(name(b), 'vi'));
    const batchSize = new Map<string, number>();
    for (const a of allAdjustments) batchSize.set(a.batch_id, (batchSize.get(a.batch_id) ?? 0) + 1);
    const reversedIds = new Set(adjustments.flatMap((a) => (a.reverses_id ? [a.reverses_id] : [])));
    const history = [...adjustments].sort((a, b) => b.created_at.localeCompare(a.created_at));

    const save = async () => {
        const n = parseAmount(amount);
        setTried(true);
        if (!amountOk(n)) return; // shown inline on the amount field
        if (!staffId || reason.trim().length < MIN_REASON) {
            setError(reason.trim().length < MIN_REASON ? t.reasonShort : t.adjInvalid);
            return;
        }
        setBusy(true);
        setError(null);
        const r = await addAdjustments({
            op_id: opId,
            project_id: projectId,
            reason: reason.trim(),
            entries: [{cut_id: cut.id, work_type_id: workType.id, staff_id: staffId, amount: Number(sign) * n}],
        }).catch(() => ({ok: false, error: 'network'}) as const);
        setBusy(false);
        if (!r.ok) {
            setError(errorText(r.error));
            setStuck(r.error === 'network');
            return;
        }
        setStuck(false);
        setOpId(crypto.randomUUID());
        setAmount('');
        setTried(false);
        setReason('');
    };

    const confirmUndo = async () => {
        if (!undo) return;
        if (undo.reason.trim().length < MIN_REASON) {
            setUndo({...undo, error: t.reasonShort});
            return;
        }
        setUndo({...undo, busy: true, error: null});
        const r = await reverseAdjustment({op_id: undo.opId, id: undo.id, reason: undo.reason.trim()})
            .catch(() => ({ok: false, error: 'network'}) as const);
        setUndo(r.ok ? null : {...undo, busy: false, error: errorText(r.error), stuck: r.error === 'network'});
    };

    const saveLinks = async (links: Link[]) => {
        setLinksBusy(true);
        setLinksError(null);
        const r = await updateCut({id: cut.id, patch: {links: cleanLinks(links)}})
            .catch(() => ({ok: false, error: 'network'}) as const);
        setLinksBusy(false);
        if (r.ok) setLinksDraft(null);
        else setLinksError(r.error === 'network' ? common.error.network : common.error.generic);
    };

    const phaseTypeIds = typeIdsByPhase(workTypes);
    const fieldLabel = (f: string) => (t.auditFields as Record<string, string>)[f] ?? f;
    const fmt = (field: string, v: Json | undefined) => {
        if (field === 'pay_split' && v === null) return t.splitDefault;
        if (v === undefined || v === null) return '—';
        // legacy scalar budget: historic audit rows (before v2.8)
        if (field === 'budget' && typeof v === 'number') return formatVnd(v);
        if (field === 'budgets') {
            const entries = budgetEntries(v, phases);
            return entries.length
                ? entries.map(([n, a]) => (phases.length > 1 ? `${n} ${formatVnd(a)}` : formatVnd(a))).join(' · ')
                : '—';
        }
        if (field === 'pay_pct') return `${v}%`;
        if (field === 'pay_split' && typeof v === 'object' && !Array.isArray(v)) {
            return phases.map((p) => {
                const ids = phaseTypeIds.get(p.id) ?? [];
                const body = phaseSplit({pay_split: v}, ids)
                    ? workTypes.filter((w) => w.phase_id === p.id)
                        .map((w) => `${w.code} ${stagePct({pay_split: v}, w, ids)}%`).join(' · ')
                    : t.splitDefault;
                return phases.length > 1 ? `${p.name}: ${body}` : body;
            }).join(' | ');
        }
        if (Array.isArray(v)) return String(v.length);
        return typeof v === 'object' ? JSON.stringify(v) : String(v);
    };
    const pct = `${stagePct(cut, workType, phaseTypeIds.get(workType.phase_id) ?? [])}%`;

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            size="min(440px, 100vw)"
            title={<Text fw={700} size="lg">{cut.code} · {workType.code} {workType.label}</Text>}
        >
            <div className={styles.drawerBody}>
                {task && (
                    <Text size="sm" c="dimmed">
                        {name(task.staff_id)} · {ddmm(task.start_date)}–{ddmm(task.end_date)} · {task.progress}%
                    </Text>
                )}
                <div className={styles.formula}>
                    {formatVnd(cutBudget(cut, workType.phase_id))} × {pct} = <b>{formatVnd(line?.amount ?? 0)}</b>
                </div>

                <section>
                    <h3 className={styles.sectionTitle}>{t.people}</h3>
                    <table className={styles.people}>
                        <thead>
                            <tr>
                                <th>{t.person}</th>
                                <th>{t.base}</th>
                                <th>{t.adjustments}</th>
                                <th>{t.total}</th>
                                <th/>
                            </tr>
                        </thead>
                        <tbody>
                            {people.map((p) => (
                                <tr key={p.staff_id}>
                                    <td>
                                        {name(p.staff_id)}
                                        {p.assignee && <span className={styles.meta}> · {t.assignee}</span>}
                                    </td>
                                    <td>{formatVnd(p.base)}</td>
                                    <td>{formatVnd(p.totals.adjustments, true)}</td>
                                    <td><b>{formatVnd(p.totals.total)}</b></td>
                                    <td>{p.assignee ? (line?.earned ? t.earned : t.pending) : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                <section>
                    <h3 className={styles.sectionTitle}>{t.history}</h3>
                    {history.length === 0 ? (
                        <Text size="sm" c="dimmed">{t.noAdjustments}</Text>
                    ) : (
                        <ul className={styles.list}>
                            {history.map((a) => {
                                const reversed = reversedIds.has(a.id);
                                return (
                                    <li key={a.id} className={reversed ? styles.reversed : undefined}>
                                        <div className={styles.row}>
                                            <span className={`${styles.amount} ${a.amount > 0 ? styles.plusAmount : styles.minusAmount}`}>
                                                {formatVnd(a.amount, true)}
                                            </span>
                                            <span>{name(a.staff_id)}</span>
                                            {a.reverses_id && <span className={styles.tag}>{t.reversalTag}</span>}
                                            {reversed && <span className={styles.tag}>{t.reversedTag}</span>}
                                            {(batchSize.get(a.batch_id) ?? 0) > 1 && <span className={styles.tag}>{t.batchTag}</span>}
                                            {!a.reverses_id && !reversed && undo?.id !== a.id && (
                                                <Button
                                                    size="compact-xs"
                                                    variant="default"
                                                    onClick={() => setUndo({id: a.id, opId: crypto.randomUUID(), reason: '', busy: false, error: null, stuck: false})}
                                                >
                                                    {t.undo}
                                                </Button>
                                            )}
                                        </div>
                                        <span>{a.reason}</span>
                                        <span className={styles.meta}>{a.created_by} · {stamp.format(new Date(a.created_at))}</span>
                                        {undo?.id === a.id && (
                                            <form
                                                className={styles.form}
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    void confirmUndo();
                                                }}
                                            >
                                                <TextInput
                                                    size="xs"
                                                    label={t.undoReason}
                                                    data-autofocus
                                                    readOnly={undo.stuck}
                                                    value={undo.reason}
                                                    onChange={(e) => setUndo({...undo, reason: e.currentTarget.value, error: null})}
                                                    error={undo.error}
                                                />
                                                <div className={styles.row}>
                                                    <Button size="compact-sm" type="submit" color="red" loading={undo.busy}>
                                                        {undo.stuck ? t.retry : t.confirm}
                                                    </Button>
                                                    {!undo.stuck && (
                                                        <Button size="compact-sm" variant="default" onClick={() => setUndo(null)}>{common.cancel}</Button>
                                                    )}
                                                </div>
                                            </form>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>

                <section>
                    <h3 className={styles.sectionTitle}>{t.addAdjustment}</h3>
                    <form
                        className={styles.form}
                        onSubmit={(e) => {
                            e.preventDefault();
                            void save();
                        }}
                    >
                        <Select
                            label={t.person}
                            searchable
                            allowDeselect={false}
                            data={activeStaff.map((s) => ({value: s.id, label: s.name}))}
                            value={staffId}
                            onChange={setStaffId}
                            disabled={stuck}
                        />
                        <SegmentedControl
                            disabled={stuck}
                            value={sign}
                            onChange={(v) => setSign(v as '1' | '-1')}
                            data={[{value: '1', label: t.bonus}, {value: '-1', label: t.penalty}]}
                        />
                        <TextInput
                            label={t.amount}
                            inputMode="numeric"
                            readOnly={stuck}
                            value={amount}
                            onChange={(e) => setAmount(e.currentTarget.value)}
                            onBlur={() => setAmount(formatAmountInput(amount))}
                            error={(tried || amount !== '') && !amountOk(parseAmount(amount)) ? t.amountPositive : undefined}
                        />
                        <Textarea
                            label={t.reason}
                            readOnly={stuck}
                            value={reason}
                            onChange={(e) => setReason(e.currentTarget.value)}
                            autosize
                            minRows={2}
                            maxLength={500}
                        />
                        {error && <Text c="red" size="sm" role="alert">{error}</Text>}
                        <Button type="submit" loading={busy}>{stuck ? t.retry : common.save}</Button>
                    </form>
                </section>

                <section>
                    <h3 className={styles.sectionTitle}>{tl.cut}</h3>
                    <LinksEditor
                        value={linksDraft ?? sanitizeLinks(cut.links)}
                        onChange={(links) => {
                            setLinksDraft(links);
                            setLinksError(null);
                        }}
                        onSave={(links) => void saveLinks(links)}
                        onCancel={() => {
                            setLinksDraft(null);
                            setLinksError(null);
                        }}
                        dirty={linksDraft !== null}
                        saving={linksBusy}
                        error={linksError}
                    />
                    <LinksList links={projectLinks} title={tl.project}/>
                </section>
                <SendMailButton
                    label={tm.sendResources}
                    people={cutStaffIds.flatMap((id) => staffById.get(id) ?? [])}
                    onSend={() => sendResources({cut_id: cut.id})}
                />

                <section>
                    <h3 className={styles.sectionTitle}>{t.audit}</h3>
                    {audit.length === 0 ? (
                        <Text size="sm" c="dimmed">{t.noAudit}</Text>
                    ) : (
                        <ul className={styles.list}>
                            {audit.map((row) => {
                                const target = row.table_name === 'tracker_cuts' ? cut.code : workType.code;
                                const all = row.action === 'update' ? auditChanges(row.old, row.new) : [];
                                // the expand-step sync also changes the legacy `budget` with `budgets`: show it once
                                const changes = all.some((c) => c.field === 'budgets') ? all.filter((c) => c.field !== 'budget') : all;
                                return (
                                    <li key={row.id}>
                                        <div className={styles.row}>
                                            <b>{target}</b>
                                            {row.action === 'insert' && <span className={styles.tag}>{t.auditInsert}</span>}
                                            {row.action === 'delete' && <span className={styles.tag}>{t.auditDelete}</span>}
                                        </div>
                                        {changes.map((c) => (
                                            <span key={c.field}>
                                                {fieldLabel(c.field)}: {fmt(c.field, c.from)} → {fmt(c.field, c.to)}
                                            </span>
                                        ))}
                                        <span className={styles.meta}>{row.actor ?? '—'} · {stamp.format(new Date(row.at))}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </Drawer>
    );
}
