'use client';

import styles from './Footer.module.css';
import Image from 'next/image';
import {ActionIcon, Anchor, Group, SimpleGrid, Stack, Text} from '@mantine/core';
import {IconBrandFacebook, IconBrandTiktok, IconBrandYoutube} from '@tabler/icons-react';
import {useLocale, useDictionary} from '@/i18n/DictionaryProvider';
import LanguageSwitcher from '@/components/language-switcher/LanguageSwitcher';

const NAV_ROUTES = [
    {key: 'projects' as const, label: 'PROJECTS', href: '/projects'},
    {key: 'about' as const, label: 'ABOUT', href: '/about'},
    {key: 'brandEquity' as const, label: 'BRAND EQUITY', href: '/brand-equity'},
    {key: 'services' as const, label: 'SERVICES', href: '/services'},
    {key: 'contactUs' as const, label: 'CONTACT US', href: '/contact-us'},
];

const socialLinks = [
    {name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=100069323215001', icon: <IconBrandFacebook size={16}/>},
    {name: 'TikTok', href: 'https://www.tiktok.com/@sino.studio', icon: <IconBrandTiktok size={16}/>},
    {name: 'YouTube', href: 'https://www.youtube.com/@SiNoStudio', icon: <IconBrandYoutube size={16}/>},
];

export default function Footer() {
    const locale = useLocale();
    const dict = useDictionary();
    const navLinks = NAV_ROUTES.map((route) => ({
        label: dict.footer[route.key],
        href: `/${locale}${route.href}`,
    }));
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                {/* Hollow outlined watermark — sits behind all content */}
                <span className={styles.sinoWatermark} aria-hidden="true">SINO</span>

                <SimpleGrid
                    className={styles.grid}
                    cols={{base: 1, sm: 2, lg: 4}}
                    spacing={{base: 28, sm: 32, lg: 40}}
                    maw={1400}
                    mx="auto"
                    px={{base: 24, sm: 32, lg: 0}}
                    py={{base: 48, lg: 60}}
                >
                    {/* Logo */}
                    <div className={styles.logoIcon}>
                        <Image
                            src="/sino-studio-face.png"
                            alt="Sino Studio Face"
                            width={512 / 6}
                            height={512 / 6}
                        />
                    </div>

                    {/* Nav links */}
                    <Stack gap={10}>
                        {navLinks.map((link) => (
                            <Anchor key={link.label} href={link.href} className={styles.navLink} underline="never">
                                {link.label}
                            </Anchor>
                        ))}
                    </Stack>

                    {/* Contact */}
                    <Stack gap={8}>
                        {/*<Text className={styles.contactItem}>phonr number</Text>*/}
                        <Text className={styles.contactItem}>CONTACT@SINOSTUDIO.VN</Text>
                        <Text className={styles.contactItem}>
                            412 Nguyễn Thị Minh Khai, Phường 5, Quận 3, Hồ Chí Minh 70000
                        </Text>
                    </Stack>

                    {/* Brand + socials */}
                    <Stack gap={16} align="flex-start" className={styles.brandCol}>
                        <Text className={styles.brandName}>SINO STUDIO</Text>
                        <Group gap={10}>
                            {socialLinks.map((s) => (
                                <ActionIcon
                                    key={s.name}
                                    component="a"
                                    href={s.href}
                                    aria-label={s.name}
                                    variant="subtle"
                                    radius="xl"
                                    size={34}
                                    target="_blank"
                                    className={styles.socialIcon}
                                >
                                    {s.icon}
                                </ActionIcon>
                            ))}
                        </Group>
                    </Stack>
                </SimpleGrid>

                <div className={styles.bottomBar}>
                    <p>{dict.footer.copyright}</p>
                    <LanguageSwitcher variant="footer" />
                </div>
            </div>
        </footer>
    );
}
