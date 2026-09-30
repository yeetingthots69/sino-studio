'use client';

import {ActionIcon, Button, CopyButton, Group, Text, TextInput} from '@mantine/core';
import {IconBrandGoogleDrive, IconCheck, IconCopy, IconLink, IconPlus, IconTrash} from '@tabler/icons-react';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {isDriveUrl, linkErrors, linksValid, MAX_LABEL, MAX_LINKS, type EditLink, type Link} from '../links';
import styles from './LinksEditor.module.css';

// Loaded rows get a positional key once, in the first change handler (it matches the render fallback, so
// inputs never remount); added rows get a random one.
const withKeys = (rows: EditLink[]) => rows.map((r, i) => (r.key ? r : {...r, key: `s${i}`}));

interface EditorProps {
    value: EditLink[];
    onChange: (links: EditLink[]) => void;
    /** Renders Save (and Cancel with onCancel) while `dirty`; without it the parent form saves. */
    onSave?: (links: EditLink[]) => void;
    onCancel?: () => void;
    dirty?: boolean;
    saving?: boolean;
    error?: string | null;
}

/** Controlled list of {label, url} rows with inline validation (https only, label 1–80, ≤ 20). */
export default function LinksEditor({value, onChange, onSave, onCancel, dirty, saving, error}: EditorProps) {
    const {links: t, common} = useDictionary().tracker;
    const set = (i: number, patch: Partial<Link>) => onChange(withKeys(value).map((r, j) => (j === i ? {...r, ...patch} : r)));

    return (
        <div className={styles.editor}>
            {value.map((row, i) => {
                const err = linkErrors(row);
                return (
                    <div key={row.key ?? `s${i}`} className={styles.row}>
                        <TextInput
                            size="xs"
                            className={styles.label}
                            aria-label={`${t.label} ${i + 1}`}
                            placeholder={t.label}
                            maxLength={MAX_LABEL}
                            value={row.label}
                            onChange={(e) => set(i, {label: e.currentTarget.value})}
                            error={err.label && t.labelRequired}
                        />
                        <TextInput
                            size="xs"
                            className={styles.url}
                            aria-label={`${t.url} ${i + 1}`}
                            placeholder="https://"
                            value={row.url}
                            onChange={(e) => set(i, {url: e.currentTarget.value})}
                            error={err.url && t.httpsOnly}
                        />
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`${t.remove}: ${row.label || i + 1}`}
                            title={t.remove}
                            onClick={() => onChange(withKeys(value).filter((_, j) => j !== i))}
                        >
                            <IconTrash size={14}/>
                        </ActionIcon>
                    </div>
                );
            })}
            <Group gap="xs">
                <Button
                    size="compact-sm"
                    variant="default"
                    leftSection={<IconPlus size={14}/>}
                    disabled={value.length >= MAX_LINKS}
                    onClick={() => onChange([...withKeys(value), {label: '', url: '', key: crypto.randomUUID()}])}
                >
                    {t.add}
                </Button>
                {value.length >= MAX_LINKS && <Text size="xs" c="dimmed">{t.max}</Text>}
            </Group>
            {error && <Text c="red" size="sm" role="alert">{error}</Text>}
            {onSave && dirty && (
                <Group gap="xs">
                    <Button size="compact-sm" loading={saving} disabled={!linksValid(value)} onClick={() => onSave(value)}>
                        {common.save}
                    </Button>
                    {onCancel && <Button size="compact-sm" variant="default" onClick={onCancel}>{common.cancel}</Button>}
                </Group>
            )}
        </div>
    );
}

/** Read-only links: open in a new tab, copy the URL; Drive icon for drive/docs.google.com. */
export function LinksList({links, title}: {links: Link[]; title?: string}) {
    const {links: t} = useDictionary().tracker;
    if (links.length === 0) return null;
    return (
        <div className={styles.list}>
            {title && <Text size="xs" c="dimmed">{title}</Text>}
            {links.map((l, i) => (
                <div key={l.url + i} className={styles.item}>
                    <Button
                        component="a"
                        href={l.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        size="compact-sm"
                        variant="default"
                        className={styles.open}
                        leftSection={isDriveUrl(l.url) ? <IconBrandGoogleDrive size={14}/> : <IconLink size={14}/>}
                        title={l.url}
                    >
                        {l.label}
                    </Button>
                    <CopyButton value={l.url}>
                        {({copied, copy}) => (
                            <ActionIcon
                                variant="subtle"
                                color={copied ? 'teal' : 'gray'}
                                aria-label={`${copied ? t.copied : t.copy}: ${l.label}`}
                                title={copied ? t.copied : t.copy}
                                onClick={copy}
                            >
                                {copied ? <IconCheck size={14}/> : <IconCopy size={14}/>}
                            </ActionIcon>
                        )}
                    </CopyButton>
                </div>
            ))}
        </div>
    );
}
