'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useMediaQuery } from '@mantine/hooks';
import { Carousel } from '@mantine/carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import '@mantine/carousel/styles.css';
import { type ProjectMetaData } from '@/data/project-data';
import styles from './ColorScript.module.css';

/** Choose the most square-ish grid for N images: prefer 4 cols, fall back gracefully */
function gridCols(count: number): number {
    if (count % 4 === 0) return 4;
    if (count % 3 === 0) return 3;
    if (count % 2 === 0) return 4; // e.g. 10 → 4+4+2, still looks fine
    return 4; // odd counts: last row will be shorter, acceptable
}

interface Props {
    project: ProjectMetaData;
}

export default function ColorScript({ project }: Props) {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const autoScroll = AutoScroll({ speed: 2, stopOnInteraction: false, stopOnMouseEnter: true, startDelay: 0 });

    const count = project.colorScriptCount ?? 12;
    const cols  = gridCols(count);

    const images = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        src: `/images/projects/${project.id}/color-script-${i + 1}.webp`,
        alt: `${project.title} color script scene ${i + 1}`,
    }));

    return (
        <section id="color-script" className={styles.section}>
            {/* ── Red heading banner ── */}
            <motion.div
                className={styles.banner}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <h2 className={styles.bannerTitle}>COLOR SCRIPT</h2>
            </motion.div>

            {/* ── Desktop: flush grid ── */}
            {isDesktop && (
                <motion.div
                    className={styles.grid}
                    style={{ '--grid-cols': cols } as React.CSSProperties}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.6 }}
                >
                    {images.map((img) => (
                        <div key={img.id} className={styles.cell}>
                            <Image
                                src={img.src}
                                alt={img.alt}
                                fill
                                sizes="25vw"
                                style={{ objectFit: 'cover' }}
                            />
                        </div>
                    ))}
                </motion.div>
            )}

            {/* ── Mobile / Tablet: continuous auto-scroll carousel ── */}
            {!isDesktop && (
                <Carousel
                    plugins={[autoScroll]}
                    slideSize={{ base: '83%', sm: '46%' }}
                    slideGap="md"
                    emblaOptions={{ loop: true, dragFree: true, align: 'center' }}
                    withControls={false}
                    withIndicators={false}
                    className={styles.carousel}
                >
                    {images.map((img) => (
                        <Carousel.Slide key={img.id}>
                            <div className={styles.slide}>
                                <Image
                                    src={img.src}
                                    alt={img.alt}
                                    fill
                                    sizes="(max-width: 767px) 83vw, 46vw"
                                    style={{ objectFit: 'cover' }}
                                />
                            </div>
                        </Carousel.Slide>
                    ))}
                </Carousel>
            )}
        </section>
    );
}
