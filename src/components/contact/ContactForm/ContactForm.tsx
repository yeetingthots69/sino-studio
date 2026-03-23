'use client';

import {useState} from 'react';
import {TextInput, Textarea} from '@mantine/core';
import {useForm} from '@mantine/form';
import sendContactEmail from '@/services/mailServices';
import styles from './ContactForm.module.css';
import {useDictionary} from "@/i18n/DictionaryProvider";

const inputStyles = {
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        border: '2px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '6px',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        transition: 'border-color 0.15s',
        '&:focus': {
            borderColor: 'var(--color-red)',
        },
    },
    label: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        fontSize: '11px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        marginBottom: '5px',
    },
    error: {
        fontSize: '11px',
        marginTop: '3px',
    },
};

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ContactForm({onBack}: {onBack: () => void}) {
    const dict = useDictionary().contactUs.form;
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const form = useForm({
        initialValues: {name: '', email: '', reason: '', message: ''},
        validate: {
            name: (v) => (v.trim().length < 1 ? dict.name.validation : null),
            email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : dict.email.validation),
            message: (v) => (v.trim().length < 1 ? dict.message.validation : null),
        },
    });

    const handleSubmit = form.onSubmit(async (values) => {
        setStatus('loading');
        setErrorMsg('');

        const result = await sendContactEmail({
            name: 'Sino Studio',
            sender: `${values.name} <${values.email}>`,
            purpose: values.reason || 'General inquiry',
            content: values.message,
        });

        if (result.success) {
            setStatus('success');
            form.reset();
        } else {
            setStatus('error');
            setErrorMsg(result.error ?? dict.result.error.message);
        }
    });

    if (status === 'success') {
        return (
            <div className={styles.card}>
                <div className={styles.feedback}>
                    <div className={styles.feedbackIcon}>✓</div>
                    <p className={styles.feedbackTitle}>{dict.result.success.heading}</p>
                    <p className={styles.feedbackBody}>
                        {dict.result.success.message}
                    </p>
                    <button className={styles.submitBtn} onClick={() => setStatus('idle')}>
                        {dict.result.success.button}
                    </button>
                </div>
            </div>
        );
    }

    const isLoading = status === 'loading';

    return (
        <div className={styles.card}>
            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                    <TextInput
                        label={dict.name.label}
                        placeholder={dict.name.placeholder}
                        styles={inputStyles}
                        disabled={isLoading}
                        {...form.getInputProps('name')}
                    />
                    <TextInput
                        label={dict.email.label}
                        placeholder={dict.email.placeholder}
                        styles={inputStyles}
                        disabled={isLoading}
                        {...form.getInputProps('email')}
                    />
                </div>
                <TextInput
                    label={dict.reason.label}
                    placeholder={dict.reason.placeholder}
                    styles={inputStyles}
                    disabled={isLoading}
                    {...form.getInputProps('reason')}
                />
                <Textarea
                    label={dict.message.label}
                    placeholder={dict.message.placeholder}
                    minRows={4}
                    autosize
                    styles={inputStyles}
                    disabled={isLoading}
                    {...form.getInputProps('message')}
                />

                {status === 'error' && (
                    <p className={styles.errorMsg}>{errorMsg}</p>
                )}

                <div className={styles.actions}>
                    <button type="button" className={styles.backBtn} onClick={onBack} disabled={isLoading}>
                        ← {dict.backButton}
                    </button>
                    <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                        {isLoading ? dict.submitButton.loading : dict.submitButton.default}
                    </button>
                </div>
            </form>
        </div>
    );
}