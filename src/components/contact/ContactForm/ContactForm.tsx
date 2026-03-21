'use client';

import {useState} from 'react';
import {TextInput, Textarea} from '@mantine/core';
import {useForm} from '@mantine/form';
import sendContactEmail from '@/services/mailServices';
import styles from './ContactForm.module.css';

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
    const [status, setStatus] = useState<Status>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const form = useForm({
        initialValues: {name: '', email: '', reason: '', message: ''},
        validate: {
            name: (v) => (v.trim().length < 1 ? 'Name is required' : null),
            email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
            message: (v) => (v.trim().length < 1 ? 'Message is required' : null),
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
            setErrorMsg(result.error ?? 'Something went wrong. Please try again.');
        }
    });

    if (status === 'success') {
        return (
            <div className={styles.card}>
                <div className={styles.feedback}>
                    <div className={styles.feedbackIcon}>✓</div>
                    <p className={styles.feedbackTitle}>Message Sent!</p>
                    <p className={styles.feedbackBody}>
                        Thanks for reaching out. We&apos;ll get back to you soon.
                    </p>
                    <button className={styles.submitBtn} onClick={() => setStatus('idle')}>
                        SEND ANOTHER
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
                        label="Name"
                        placeholder="Your name"
                        styles={inputStyles}
                        disabled={isLoading}
                        {...form.getInputProps('name')}
                    />
                    <TextInput
                        label="Email"
                        placeholder="your@email.com"
                        styles={inputStyles}
                        disabled={isLoading}
                        {...form.getInputProps('email')}
                    />
                </div>
                <TextInput
                    label="Reason"
                    placeholder="What is this about?"
                    styles={inputStyles}
                    disabled={isLoading}
                    {...form.getInputProps('reason')}
                />
                <Textarea
                    label="Message"
                    placeholder="Tell us more..."
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
                        ← Back
                    </button>
                    <button type="submit" className={styles.submitBtn} disabled={isLoading}>
                        {isLoading ? 'SENDING...' : 'SEND MESSAGE'}
                    </button>
                </div>
            </form>
        </div>
    );
}