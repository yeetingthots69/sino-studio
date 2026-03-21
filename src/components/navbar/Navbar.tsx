'use client';

import {useState} from 'react';
import {motion} from 'framer-motion';
import {useDisclosure, useWindowScroll} from '@mantine/hooks';
import {Menu} from '@mantine/core';
import styles from './Navbar.module.css';
import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from "next/navigation";
import {IconMenu2} from "@tabler/icons-react";

const navItems = [
    {label: 'About', href: '/about'},
    {label: 'Projects', href: '/projects'},
    {label: 'Services', href: '/services'},
    {label: 'Brand Equity', href: '/brand-equity'},
    {label: 'Contact', href: '/contact-us'},
];

export default function Navbar() {
    const pathname = usePathname();
    const isContactPage = pathname === '/contact-us';
    const [scroll] = useWindowScroll();
    const [opened, {open, close}] = useDisclosure(false);
    const [active, setActive] = useState<string | null>(null);
    const scrolled = scroll.y > 60;

    return (
        <>
            <motion.nav
                className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}
                initial={{y: -60, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                transition={{duration: 0.6, ease: 'easeOut'}}
                style={isContactPage ? {
                    backgroundColor: 'rgba(10,10,10,0.5)',
                    backdropFilter: 'blur(8px)',
                } : {}}
            >
                <Link href="/" className={styles.logo}>
                    <Image src="/sino-studio-full.png" alt="Sino Studio Logo" width={3129 / 25} height={1640 / 25}/>
                </Link>

                {/* Hamburger + Mantine Menu – mobile only */}
                <div className={styles.mobileMenu}>
                    <Menu
                        opened={opened}
                        onOpen={open}
                        onClose={close}
                        position="bottom-end"
                        offset={12}
                        shadow="md"
                        styles={{
                            dropdown: {
                                backgroundColor: 'rgba(10,10,10,0.92)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: 8,
                                padding: '6px 0',
                                minWidth: 180,
                            },
                            item: {
                                color: 'rgba(255,255,255,0.85)',
                                fontFamily: 'var(--font-heading)',
                                fontWeight: 600,
                                fontSize: 13,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                padding: '10px 20px',
                                backgroundColor: 'transparent',
                            },
                        }}
                    >
                        <Menu.Target>
                            {/*<button*/}
                            {/*    className={`${styles.menuBtn} ${opened ? styles.open : ''}`}*/}
                            {/*    aria-label="Toggle menu"*/}
                            {/*>*/}
                            {/*    <span/><span/><span/>*/}
                            {/*</button>*/}
                            <IconMenu2 className={`${styles.menuBtn} ${opened ? styles.open : ''}`}/>
                        </Menu.Target>

                        <Menu.Dropdown>
                            {navItems.map((item) => (
                                <Menu.Item
                                    key={item.label}
                                    component={Link}
                                    href={item.href}
                                    className={`${styles.menuItem} ${active === item.label ? styles.menuItemActive : ''}`}
                                    onClick={() => {
                                        setActive(item.label);
                                        close();
                                    }}
                                >
                                    {item.label}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </div>

                {/* Desktop nav links */}
                <ul className={styles.navLinks}>
                    {navItems.map((item) => (
                        <li key={item.label}>
                            <Link
                                href={item.href}
                                className={`${styles.navLink} ${active === item.label ? styles.active : ''}`}
                                onClick={() => setActive(item.label)}
                            >
                                {item.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </motion.nav>
        </>
    );
}
