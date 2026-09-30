'use client';

import {useState, useTransition} from 'react';
import {Button, Group, List, Modal, Text, type ButtonProps} from '@mantine/core';
import {IconMail} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import type {ActionResult, MailResult} from '@/app/[locale]/tracker/actions';

type Person = {id: string; name: string; email: string | null; archived_at: string | null};
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

/** Manual email send (plan §3.7): confirm listing recipients and missing emails, then the result. */
export default function SendMailButton({label, people, onSend, ...button}: {
    label: string;
    people: Person[];
    onSend: () => Promise<ActionResult<MailResult>>;
} & Omit<ButtonProps, 'children' | 'onClick'>) {
    const {mail: t, common} = useDictionary().tracker;
    const [opened, setOpened] = useState(false);
    const [result, setResult] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();
    const withEmail = people.filter((p) => p.email && !p.archived_at);
    const archived = people.filter((p) => p.archived_at);
    const without = people.filter((p) => !p.email && !p.archived_at);

    const close = () => {
        setOpened(false);
        setResult(null);
        setError(null);
    };
    const send = () => start(async () => {
        const res = await onSend().catch(() => ({ok: false, error: 'network'}) as const);
        if (!res.ok) {
            setError(res.error === 'network' ? common.error.network : res.error === 'not_found' ? common.error.notFound : common.error.generic);
            return;
        }
        const {sent, failed, skippedNoEmail, skippedArchived} = res.data;
        setResult([
            fill(t.sent, {n: sent}),
            ...(failed ? [fill(t.failed, {n: failed})] : []),
            ...(skippedNoEmail.length ? [fill(t.skipped, {n: skippedNoEmail.length, names: skippedNoEmail.join(', ')})] : []),
            ...(skippedArchived.length ? [fill(t.skippedArchived, {n: skippedArchived.length, names: skippedArchived.join(', ')})] : []),
        ]);
    });

    return (
        <>
            <Button variant="default" leftSection={<IconMail size={16}/>} {...button} onClick={() => setOpened(true)}>{label}</Button>
            <Modal opened={opened} onClose={close} title={label} centered>
                {result ? (
                    result.map((line) => <Text key={line} size="sm" role="status">{line}</Text>)
                ) : (
                    <>
                        <Text size="sm" fw={600}>{t.recipients}</Text>
                        {withEmail.length ? (
                            <List size="sm" mb="sm">
                                {withEmail.map((p) => <List.Item key={p.id}>{p.name} — {p.email}</List.Item>)}
                            </List>
                        ) : (
                            <Text size="sm" c="dimmed" mb="sm">{t.nobody}</Text>
                        )}
                        {without.length > 0 && (
                            <>
                                <Text size="sm" fw={600} c="orange">{t.noEmail}</Text>
                                <List size="sm">{without.map((p) => <List.Item key={p.id}>{p.name}</List.Item>)}</List>
                            </>
                        )}
                        {archived.length > 0 && (
                            <>
                                <Text size="sm" fw={600} c="dimmed" mt="xs">{t.archived}</Text>
                                <List size="sm">{archived.map((p) => <List.Item key={p.id}>{p.name}</List.Item>)}</List>
                            </>
                        )}
                        {error && <Text size="sm" c="red" mt="sm" role="alert">{error}</Text>}
                    </>
                )}
                <Group justify="flex-end" mt="lg">
                    <Button variant="default" onClick={close}>{result ? t.close : common.cancel}</Button>
                    {!result && <Button loading={pending} disabled={!withEmail.length} onClick={send}>{t.send}</Button>}
                </Group>
            </Modal>
        </>
    );
}
