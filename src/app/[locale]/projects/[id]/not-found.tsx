'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import styles from './not-found.module.css';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';

export default function ProjectNotFound() {
    const locale = useLocale();
    const dict = useDictionary();

    return (
        <>
            <Navbar/>
            <main className={styles.wrapper}>
                <div className={styles.inner}>
                    <span className={styles.code}>404</span>
                    <h1 className={styles.heading}>{dict.common.projectNotFound}</h1>
                    <p className={styles.body}>
                        {dict.common.projectNotFoundDescription}
                    </p>
                    <Link href={`/${locale}/projects`} className={styles.btn}>
                        {dict.common.backToProjects}
                    </Link>
                </div>
            </main>
            <Footer/>
        </>
    );
}
