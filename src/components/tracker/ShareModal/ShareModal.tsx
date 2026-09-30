'use client';

import {useState, useSyncExternalStore, useTransition} from 'react';
import {Button, CopyButton, Group, Modal, MultiSelect, Text, TextInput} from '@mantine/core';
import {IconShare} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {createShare, revokeShare, sendSchedule, type ActionResult} from '@/app/[locale]/tracker/actions';
import SendMailButton from '../SendMailButton/SendMailButton';
import type {Tables} from '@/types/database.types';
import styles from './ShareModal.module.css';

type Share = Tables<'tracker_shares'>;
type StaffLite = Pick<Tables<'tracker_staff'>, 'id' | 'name' | 'email' | 'archived_at'>;

// Fixed locale + zone so server and client render the same string.
const dateFmt = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Ho_Chi_Minh'});
const noop = () => () => {};
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => '');

function Copy({value, label, copied}: {value: string; label: string; copied: string}) {
    return (
        <CopyButton value={value}>
            {({copied: done, copy}) => (
                <Button size="compact-xs" variant={done ? 'filled' : 'default'} onClick={copy}>{done ? copied : label}</Button>
            )}
        </CopyButton>
    );
}

function ShareRow({share, staffById, locale, month}: {
    share: Share; staffById: Map<string, StaffLite>; locale: string; month: string;
}) {
    const {share: t, common, mail} = useDictionary().tracker;
    const origin = useOrigin();
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();
    const base = `${origin}/api/tracker`;

    const revoke = () => start(async () => {
        const res = await revokeShare({id: share.id});
        if (!res.ok) setError(res.error === 'network' ? common.error.network : res.error === 'not_found' ? common.error.notFound : common.error.generic);
    });

    return (
        <li className={styles.share}>
            <Group justify="space-between" gap="xs">
                <div>
                    <Text fw={600} size="sm">{share.label || t.unnamed}</Text>
                    <Text size="xs" c="dimmed">
                        {t.createdBy.replace('{date}', dateFmt.format(new Date(share.created_at))).replace('{by}', share.created_by)}
                    </Text>
                </div>
                <Group gap={6}>
                    <Copy value={`${origin}/${locale}/share/${share.token}`} label={t.copyLink} copied={t.copied}/>
                    <Button size="compact-xs" variant="default" component="a" href={`${base}/share/${share.token}/png?m=${month}`} download>
                        {t.png}
                    </Button>
                    <SendMailButton
                        size="compact-xs"
                        label={mail.sendSchedule}
                        people={share.staff_ids.flatMap((id) => staffById.get(id) ?? [])}
                        onSend={() => sendSchedule({share_id: share.id, month})}
                    />
                    {confirm ? (
                        <>
                            <Button size="compact-xs" color="red" loading={pending} onClick={revoke}>{t.confirmRevoke}</Button>
                            <Button size="compact-xs" variant="subtle" onClick={() => setConfirm(false)}>{common.cancel}</Button>
                        </>
                    ) : (
                        <Button size="compact-xs" variant="subtle" color="red" onClick={() => setConfirm(true)}>{t.revoke}</Button>
                    )}
                </Group>
            </Group>
            <Text size="xs" c="dimmed" mt={6}>{t.calendars}</Text>
            <Group gap={6} mt={4}>
                {share.staff_ids.map((id) => (
                    <Copy key={id} value={`${base}/ics/${share.token}/${id}`} label={staffById.get(id)?.name ?? id.slice(0, 8)} copied={t.copied}/>
                ))}
            </Group>
            {error && <Text size="xs" c="red" mt={4} role="alert">{error}</Text>}
        </li>
    );
}

export default function ShareModal({projectId, locale, month, staff, shares}: {
    projectId: string; locale: string; month: string; staff: StaffLite[]; shares: Share[];
}) {
    const {share: t, common} = useDictionary().tracker;
    const [opened, setOpened] = useState(false);
    const [staffIds, setStaffIds] = useState<string[]>([]);
    const [label, setLabel] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();
    const staffById = new Map(staff.map((s) => [s.id, s]));

    const create = () => start(async () => {
        const res: ActionResult<Share> = await createShare({project_id: projectId, staff_ids: staffIds, label});
        if (res.ok) {
            setStaffIds([]);
            setLabel('');
            setError(null);
        } else setError(res.error === 'network' ? common.error.network : common.error.generic);
    });

    return (
        <>
            <Button variant="default" leftSection={<IconShare size={16}/>} onClick={() => setOpened(true)}>{t.button}</Button>
            <Modal opened={opened} onClose={() => setOpened(false)} title={t.modalTitle} size="lg">
                <MultiSelect
                    label={t.staff}
                    placeholder={t.staffPlaceholder}
                    data={staff.filter((s) => s.archived_at == null).map((s) => ({value: s.id, label: s.name}))}
                    value={staffIds}
                    onChange={setStaffIds}
                    maxValues={50}
                    searchable
                />
                <TextInput mt="sm" label={t.label} value={label} maxLength={80} onChange={(e) => setLabel(e.currentTarget.value)}/>
                <Group justify="flex-end" mt="sm">
                    <Button disabled={!staffIds.length} loading={pending} onClick={create}>{t.create}</Button>
                </Group>
                {error && <Text size="sm" c="red" role="alert">{error}</Text>}

                <Text fw={600} mt="lg" mb="xs">{t.list}</Text>
                {shares.length === 0 ? (
                    <Text size="sm" c="dimmed">{t.none}</Text>
                ) : (
                    <ul className={styles.list}>
                        {shares.map((s) => <ShareRow key={s.id} share={s} staffById={staffById} locale={locale} month={month}/>)}
                    </ul>
                )}
            </Modal>
        </>
    );
}
