'use client';

import {usePathname, useRouter} from 'next/navigation';
import {useLocale} from '@/i18n/DictionaryProvider';
import {LOCALES, type Locale} from '@/i18n/config';
import styles from './LanguageSwitcher.module.css';

interface Props {
    variant?: 'navbar' | 'footer';
}

export default function LanguageSwitcher({variant = 'navbar'}: Props) {
    const locale = useLocale();
    const pathname = usePathname();
    const router = useRouter();

    function switchLocale(target: Locale) {
        if (target === locale) return;

        const newPath = pathname.replace(/^\/(en|vi)/, `/${target}`);
        document.cookie = `NEXT_LOCALE=${target};path=/;max-age=${60 * 60 * 24 * 365}`;
        router.push(newPath);
    }

    return (
        <div className={`${styles.switcher} ${styles[variant]}`}>
            {LOCALES.map((loc, i) => (
                <span key={loc}>
                    {i > 0 && <span className={styles.divider}>|</span>}
                    <button
                        className={`${styles.localeButton} ${loc === locale ? styles.active : styles.inactive}`}
                        onClick={() => switchLocale(loc)}
                    >
                        {loc.toUpperCase()}
                    </button>
                </span>
            ))}
        </div>
    );
}
