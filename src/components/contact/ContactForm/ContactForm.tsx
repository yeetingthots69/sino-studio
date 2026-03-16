'use client';

import {TextInput, Textarea} from '@mantine/core';
import {useForm} from '@mantine/form';
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

export default function ContactForm({onBack}: {onBack: () => void}) {
    const form = useForm({
        initialValues: {name: '', email: '', reason: '', message: ''},
        validate: {
            name: (v) => (v.trim().length < 1 ? 'Name is required' : null),
            email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Invalid email'),
            message: (v) => (v.trim().length < 1 ? 'Message is required' : null),
        },
    });

    const handleSubmit = form.onSubmit((values) => {
        console.log('Contact form submission:', values);
        alert('Thank you for your message! We will get back to you soon.');
        form.reset();
    });

    return (
        <div className={styles.card}>
            <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.row}>
                    <TextInput
                        label="Name"
                        placeholder="Your name"
                        styles={inputStyles}
                        {...form.getInputProps('name')}
                    />
                    <TextInput
                        label="Email"
                        placeholder="your@email.com"
                        styles={inputStyles}
                        {...form.getInputProps('email')}
                    />
                </div>
                <TextInput
                    label="Reason"
                    placeholder="What is this about?"
                    styles={inputStyles}
                    {...form.getInputProps('reason')}
                />
                <Textarea
                    label="Message"
                    placeholder="Tell us more..."
                    minRows={4}
                    autosize
                    styles={inputStyles}
                    {...form.getInputProps('message')}
                />

                <div className={styles.actions}>
                    <button type="button" className={styles.backBtn} onClick={onBack}>
                        ← Back
                    </button>
                    <button type="submit" className={styles.submitBtn}>
                        SEND MESSAGE
                    </button>
                </div>
            </form>
        </div>
    );
}