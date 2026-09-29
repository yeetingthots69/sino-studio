'use client';

import 'dayjs/locale/vi';
import '@mantine/dates/styles.css';
import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Avatar, Burger, Menu} from '@mantine/core';
import {DatesProvider} from '@mantine/dates';
import {useDictionary} from '@/i18n/DictionaryProvider';
import {signOut} from '@/app/[locale]/tracker/actions';
import LanguageSwitcher from '@/components/language-switcher/LanguageSwitcher';
import ProjectSwitcher, {type ShellProject} from '@/components/tracker/ProjectSwitcher';
import styles from './TrackerShell.module.css';

interface Props {
    user: {name: string; avatarUrl: string | null; email: string};
    projects: ShellProject[];
    locale: string;
    children: React.ReactNode;
}

export default function TrackerShell({user, projects, locale, children}: Props) {
    const t = useDictionary().tracker.shell;
    const pathname = usePathname();
    const base = `/${locale}/tracker`;
    const nav = [
        {href: `${base}/projects`, label: t.projects},
        {href: `${base}/staff`, label: t.staff},
        {href: `${base}/work-types`, label: t.workTypes},
    ];

    return (
        <>
            <header className={styles.header}>
                <div className={`${styles.group} ${styles.left}`}>
                    <Menu position="bottom-start">
                        <Menu.Target>
                            <Burger size="sm" className={styles.burger} aria-label={t.menu}/>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {nav.map(({href, label}) => (
                                <Menu.Item key={href} component={Link} href={href}>{label}</Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                    <Link href={base} className={styles.logo}>
                        <Image src="/sino-studio-face.png" alt="Sino Studio" width={32} height={32}/>
                    </Link>
                    <ProjectSwitcher projects={projects} locale={locale}/>
                    <nav className={styles.nav}>
                        {nav.map(({href, label}) => (
                            <Link
                                key={href}
                                href={href}
                                className={`${styles.navLink} ${pathname.startsWith(href) ? styles.active : ''}`}
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>
                </div>
                <div className={`${styles.group} ${styles.right}`}>
                    <LanguageSwitcher/>
                    <div className={styles.user} title={user.email}>
                        <Avatar src={user.avatarUrl} alt={user.name} size={28} radius="xl"/>
                        <span className={styles.userName}>{user.name}</span>
                    </div>
                    <form action={signOut}>
                        <input type="hidden" name="locale" value={locale}/>
                        <button type="submit" className={styles.signOut}>{t.signOut}</button>
                    </form>
                </div>
            </header>
            <DatesProvider settings={{locale}}>
                <main className={styles.main}>{children}</main>
            </DatesProvider>
        </>
    );
}
