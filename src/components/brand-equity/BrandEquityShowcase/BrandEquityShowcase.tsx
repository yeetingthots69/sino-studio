'use client';

import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import { useMediaQuery } from '@mantine/hooks';
import { Carousel } from '@mantine/carousel';
import '@mantine/carousel/styles.css';
import styles from './BrandEquityShowcase.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.7, delay: i * 0.08, ease: 'easeOut' },
    }),
};

interface IPCharacter {
    id: string;
    name: string;
    image: string;
}

const IP_CHARACTERS: IPCharacter[] = [
    { id: 'nachi',      name: 'NACHI',       image: '/images/projects/linh.webp' },
    { id: 'heny',       name: 'HENY',        image: '/images/placeholder.png' },
    { id: 'ha',         name: 'HẠ',          image: '/images/placeholder.png' },
    { id: 'ma-ba-dong', name: 'MA BÀ ĐỒNG',  image: '/images/placeholder.png' },
    { id: 'boss',       name: 'BOSS',        image: '/images/projects/long-x-boss.webp' },
    { id: 'sino',       name: 'SINO',        image: '/images/placeholder.png' },
    { id: 'vu',         name: 'VŨ',          image: '/images/placeholder.png' },
    { id: 'hien-luong', name: 'HIỀN LƯƠNG',  image: '/images/placeholder.png' },
    { id: 'linh',       name: 'LINH',        image: '/images/projects/linh.webp' },
    { id: 'thong-tuy',  name: 'THÔNG TUÝ',   image: '/images/placeholder.png' },
];

function CharacterCard({ char, index }: { char: IPCharacter; index: number }) {
    return (
        <motion.div
            className={styles.card}
            variants={fadeUp}
            custom={index}
        >
            <div className={styles.cardImg}>
                <Image
                    src={char.image}
                    alt={char.name}
                    fill
                    sizes="(max-width: 768px) 70vw, (max-width: 1024px) 30vw, 18vw"
                    style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
            </div>
            <span className={styles.cardName}>{char.name}</span>
        </motion.div>
    );
}

export default function BrandEquityShowcase() {
    const isMobile = useMediaQuery('(max-width: 767px)');

    return (
        <section className={styles.section}>
            {/* Section heading */}
            <motion.div
                className={styles.headingRow}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
            >
                <motion.h2 className={styles.heading} variants={fadeUp} custom={0}>
                    ORIGINAL IP SHOWCASE
                </motion.h2>
            </motion.div>

            {/* Grid (desktop / tablet) */}
            {!isMobile && (
                <motion.div
                    className={styles.grid}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.15 }}
                >
                    {IP_CHARACTERS.map((char, i) => (
                        <CharacterCard key={char.id} char={char} index={i} />
                    ))}
                </motion.div>
            )}

            {/* Carousel (mobile) */}
            {isMobile && (
                <Carousel
                    className={styles.carousel}
                    slideSize="72%"
                    slideGap="sm"
                    emblaOptions={{ loop: true, align: 'center', dragFree: true }}
                    withControls={false}
                    withIndicators
                    classNames={{ indicator: styles.indicator, indicators: styles.indicators }}
                >
                    {IP_CHARACTERS.map((char) => (
                        <Carousel.Slide key={char.id}>
                            <div className={styles.slideInner}>
                                <CharacterCard char={char} index={0} />
                            </div>
                        </Carousel.Slide>
                    ))}
                </Carousel>
            )}

            {/* Footer tag */}
            <motion.p
                className={styles.tag}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                MV ÂM NHẠC · SERIES PHIM HOẠT HÌNH · MOVIE LINH
            </motion.p>
        </section>
    );
}

