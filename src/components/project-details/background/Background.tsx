'use client';

import Image from 'next/image';
import {useEffect, useRef} from 'react';
import {motion, type Variants} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import {type ProjectMetaData} from '@/data/project-data';
import styles from './Background.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 24},
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.55, delay: i * 0.1, ease: 'easeOut' as const},
    }),
};

const fadeUpOnce: Variants = {
    hidden: {opacity: 0, y: 30},
    visible: {
        opacity: 1,
        y: 0,
        transition: {duration: 0.6, ease: 'easeOut'},
    },
};

const DEFAULT_BACKGROUNDS: { type: 'image' | 'video' }[] = [
    {type: 'image'},
    {type: 'image'},
    {type: 'image'},
    {type: 'image'},
];

interface Props {
    project: ProjectMetaData;
}

export default function Background({project}: Props) {
    const backgrounds = project.backgrounds ?? DEFAULT_BACKGROUNDS;
    const smCols = backgrounds.length === 1 ? 1 : 2;
    const hasVideo = backgrounds.some((b) => b.type === 'video');

    const videoCount = backgrounds.filter((b) => b.type === 'video').length;
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    useEffect(() => {
        if (!hasVideo || videoCount === 0) return;

        const videos = videoRefs.current.filter((v): v is HTMLVideoElement => v !== null);
        if (videos.length === 0) return;

        let readyCount = 0;

        const tryPlayAll = () => {
            readyCount += 1;
            if (readyCount < videos.length) return;
            // All videos are ready — seek all to 0 then play simultaneously
            videos.forEach((v) => {
                v.currentTime = 0;
            });
            videos.forEach((v) => {
                v.play().catch(() => {/* autoplay policy — silently ignore */});
            });
        };

        const cleanups: (() => void)[] = videos.map((v) => {
            if (v.readyState >= 4 /* HAVE_ENOUGH_DATA */) {
                // Already ready; count it on next tick so all handlers register first
                const id = setTimeout(tryPlayAll, 0);
                return () => clearTimeout(id);
            }
            v.addEventListener('canplaythrough', tryPlayAll, {once: true});
            return () => v.removeEventListener('canplaythrough', tryPlayAll);
        });

        return () => cleanups.forEach((fn) => fn());
    }, [hasVideo, videoCount]);

    let videoIdx = 0;

    const grid = (
        <SimpleGrid cols={{base: 1, sm: smCols}} spacing="xs">
            {backgrounds.map((item, idx) => {
                const n = idx + 1;
                const alt = `${project.title} background environment ${n}`;

                let content: React.ReactNode;
                if (item.type === 'video') {
                    const refIdx = videoIdx++;
                    content = (
                        <video
                            ref={(el) => { videoRefs.current[refIdx] = el; }}
                            className={styles.cellVideo}
                            src={`/videos/projects/${project.id}/background-${n}.webm`}
                            loop
                            muted
                            playsInline
                            preload="auto"
                        />
                    );
                } else {
                    content = (
                        <Image
                            src={`/images/projects/${project.id}/background-${n}.webp`}
                            alt={alt}
                            fill
                            sizes="(max-width: 639px) 100vw, 50vw"
                            style={{objectFit: 'cover'}}
                        />
                    );
                }

                return hasVideo ? (
                    /* videos present → cells are plain divs, parent animates as one */
                    <div key={idx} className={styles.cell}>{content}</div>
                ) : (
                    /* images only → stagger each cell individually */
                    <motion.div
                        key={idx}
                        className={styles.cell}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{once: true, amount: 0.15}}
                        variants={fadeUp}
                        custom={idx}
                    >
                        {content}
                    </motion.div>
                );
            })}
        </SimpleGrid>
    );

    return (
        <section id="background" className={styles.section}>
            {/* ── Dark heading banner ── */}
            <motion.div
                className={styles.banner}
                initial={{opacity: 0}}
                whileInView={{opacity: 1}}
                viewport={{once: true}}
                transition={{duration: 0.5}}
            >
                <h2 className={styles.bannerTitle}>BACKGROUND</h2>
            </motion.div>

            {/* ── Media grid ── */}
            {hasVideo ? (
                <motion.div
                    className={styles.gridWrap}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.1}}
                    variants={fadeUpOnce}
                >
                    {grid}
                </motion.div>
            ) : (
                <div className={styles.gridWrap}>{grid}</div>
            )}
        </section>
    );
}





