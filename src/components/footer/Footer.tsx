import styles from './Footer.module.css';
import Image from 'next/image';
import {SimpleGrid, Group, Stack, ActionIcon, Text, Anchor} from '@mantine/core';
import {IconBrandFacebook, IconBrandInstagram, IconBrandTiktok, IconBrandYoutube} from '@tabler/icons-react';

const navLinks = [
    {label: 'PROJECTS', href: '/projects'},
    {label: 'ABOUT', href: '#about'},
    {label: 'PROCEDURES', href: '#procedure'},
    {label: 'TEAM', href: '#team'},
    {label: 'JOIN', href: '#join'},
];

const socialLinks = [
    {name: 'Facebook', href: '#', icon: <IconBrandFacebook size={16}/>},
    {name: 'Instagram', href: '#', icon: <IconBrandInstagram size={16}/>},
    {name: 'TikTok', href: '#', icon: <IconBrandTiktok size={16}/>},
    {name: 'YouTube', href: '#', icon: <IconBrandYoutube size={16}/>},
];

export default function Footer() {
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
                        <Text className={styles.contactItem}>095 378 91 22</Text>
                        <Text className={styles.contactItem}>SINOSTUDIO.F@GMAIL.COM</Text>
                        <Text className={styles.contactItem}>
                            3/9 ĐƯỜNG SỐ 10, PHƯỜNG HIỆP BÌNH,{'\n'}THỦ ĐỨC
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
                                    className={styles.socialIcon}
                                >
                                    {s.icon}
                                </ActionIcon>
                            ))}
                        </Group>
                    </Stack>
                </SimpleGrid>

                <div className={styles.bottomBar}>
                    <p>TẤT CẢ HÌNH ẢNH TRÊN WEBSITE ĐỀU THUỘC SỞ HỮU BỞI SINO STUDIO ©</p>
                </div>
            </div>
        </footer>
    );
}
