import type {Metadata} from 'next';
import {IconBrandGoogle} from '@tabler/icons-react';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {signInWithGoogle} from '../actions';
import styles from './login.module.css';

export const metadata: Metadata = {robots: {index: false, follow: false}};

interface Props {
    params: Promise<{locale: string}>;
    searchParams: Promise<{next?: string; error?: string}>;
}

export default async function TrackerLoginPage({params, searchParams}: Props) {
    const {locale} = await params;
    const {next, error} = await searchParams;
    const dict = await getDictionary(locale as Locale);
    const t = dict.tracker.auth;

    return (
        <main className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>{t.title}</h1>
                {error === 'domain' && <p className={styles.error} role="alert">{t.errorDomain}</p>}
                {error === 'auth' && <p className={styles.error} role="alert">{t.errorAuth}</p>}
                <form action={signInWithGoogle}>
                    <input type="hidden" name="next" value={next ?? ''}/>
                    <input type="hidden" name="locale" value={locale}/>
                    <button type="submit" className={styles.button}>
                        <IconBrandGoogle size={20}/>
                        {t.signInWithGoogle}
                    </button>
                </form>
            </div>
        </main>
    );
}
