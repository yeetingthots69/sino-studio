'use client';

import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {signOut} from '@/app/[locale]/tracker/actions';
import styles from './NotAuthorized.module.css';

export default function NotAuthorized({email}: {email: string}) {
    const t = useDictionary().tracker.auth;
    const locale = useLocale();

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>{t.notAuthorized.title}</h1>
                <p className={styles.body}>{t.notAuthorized.body}</p>
                <p className={styles.email}>{email}</p>
                <form action={signOut}>
                    <input type="hidden" name="locale" value={locale}/>
                    <button type="submit" className={styles.button}>{t.signOut}</button>
                </form>
            </div>
        </main>
    );
}
