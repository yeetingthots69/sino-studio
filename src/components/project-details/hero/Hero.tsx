'use client';

import {useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {motion, type Variants} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import {type ProjectMetaData} from '@/data/project-data';
import styles from './Hero.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

const animationSectionLinks = [
    {label: 'COLOR SCRIPT', href: '#color-script'},
    {label: 'CHARACTERS', href: '#characters'},
    {label: 'BACKGROUND', href: '#background'},
    {label: 'CREDITS', href: '#credits'},
];

const mvSectionLinks = [
    {label: 'SNIPPETS', href: '#snippets'},
    {label: 'LYRICS', href: '#lyrics'},
    {label: 'VIDEO', href: '#background'},
    {label: 'BACKGROUND', href: '#background'},
    {label: 'CREDITS', href: '#credits'},
];

const seriesSectionLinks = [
    {label: 'SNIPPETS', href: '#snippets'},
    {label: 'VIDEO', href: '#background'},
    {label: 'BACKGROUND', href: '#background'},
    {label: 'CREDITS', href: '#credits'},
];

interface Props {
    project: ProjectMetaData;
}

export default function Hero({project}: Props) {
    const heroSrc = `/images/projects/${project.id}/hero.webp`;
    const videoSrc = `/videos/projects/${project.id}/hero.webm`;
    const [videoError, setVideoError] = useState(false);

    const stats = [
        {label: 'NGÀY CÔNG CHIẾU', value: project.firstAired},
        ...(project.customTag ?? []),
    ];

    return (
        <section className={styles.wrapper}>
            {/* Full-bleed background — video with image fallback */}
            <div className={styles.bg}>
                {!videoError ? (
                    <video
                        className={styles.bgVideo}
                        src={videoSrc}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onError={() => setVideoError(true)}
                    />
                ) : (
                    <Image
                        src={heroSrc}
                        alt={`${project.title} background`}
                        fill
                        priority
                        sizes="100vw"
                        style={{objectFit: 'cover', objectPosition: 'center center'}}
                    />
                )}
            </div>
            <div className={styles.bgOverlay}/>

            {/* Main hero content */}
            <div className={styles.content}>
                {/* Portrait card */}
                <motion.div
                    className={styles.portrait}
                    initial={{opacity: 0, x: -40}}
                    animate={{opacity: 1, x: 0}}
                    transition={{duration: 0.8, ease: 'easeOut'}}
                >
                    <Image
                        src={heroSrc}
                        alt={`${project.title} character`}
                        fill
                        sizes="(max-width: 767px) 80vw, 40vw"
                        style={{objectFit: 'cover', objectPosition: 'center top'}}
                    />
                </motion.div>

                {/* Text side */}
                <motion.div
                    className={styles.info}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h1 className={styles.title} variants={fadeUp} custom={0}>
                        {project.title}
                    </motion.h1>

                    <motion.p className={styles.body} variants={fadeUp} custom={1}>
                        {project.description_1}
                    </motion.p>

                    <motion.p className={styles.body} variants={fadeUp} custom={2}>
                        {project.description_2}
                    </motion.p>

                    <motion.div variants={fadeUp} custom={3}>
                        <SimpleGrid cols={{base: 2}} spacing={12} className={styles.statsGrid}>
                            {stats.map((s) => (
                                <div key={s.label} className={styles.statBox}>
                                    <div className={styles.statBoxInner}>
                                        <span className={styles.statLabel}>{s.label}</span>
                                        <span className={styles.statValue}>{s.value}</span>
                                    </div>
                                </div>
                            ))}
                        </SimpleGrid>
                    </motion.div>
                </motion.div>
            </div>

            {/* Section nav strip */}
            <nav className={styles.sectionNav}>
                {animationSectionLinks.map((link, i) => (
                    <Link
                        key={link.label}
                        href={link.href}
                        className={styles.sectionNavLink}
                        style={{'--i': i} as React.CSSProperties}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
        </section>
    );
}
