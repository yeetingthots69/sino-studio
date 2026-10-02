'use client';

import {useEffect, useRef} from 'react';
import {Button, Group, Notification, Text} from '@mantine/core';
import {useDictionary} from '@/i18n/DictionaryProvider';
import styles from './UndoToast.module.css';

export type UndoToastData = {text: string; action?: {label: string; onClick(): void}};

const AUTO_CLOSE_MS = 6000;

export default function UndoToast({toast, onClose}: {toast: UndoToastData | null; onClose(): void}) {
    const t = useDictionary().tracker.board.undo;
    // Keep the timer keyed on `toast` only, even if the parent passes a fresh onClose each render.
    const closeRef = useRef(onClose);
    useEffect(() => {
        closeRef.current = onClose;
    });

    useEffect(() => {
        if (!toast) return;
        const id = window.setTimeout(() => closeRef.current(), AUTO_CLOSE_MS);
        return () => window.clearTimeout(id);
    }, [toast]);

    // The live region stays mounted so screen readers pick up each new toast politely.
    // Notification defaults to role="alert" (assertive), hence role="group" on it.
    return (
        <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
            {toast && (
                <Notification
                    role="group"
                    withBorder
                    withCloseButton
                    onClose={onClose}
                    closeButtonProps={{'aria-label': t.close}}
                >
                    <Group justify="space-between" wrap="nowrap" gap="sm">
                        <Text size="sm">{toast.text}</Text>
                        {toast.action && (
                            <Button
                                size="compact-sm"
                                variant="subtle"
                                onClick={() => {
                                    toast.action?.onClick();
                                    onClose();
                                }}
                            >
                                {toast.action.label}
                            </Button>
                        )}
                    </Group>
                </Notification>
            )}
        </div>
    );
}
