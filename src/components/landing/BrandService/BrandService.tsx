'use client';

import Image from 'next/image';
import Link from 'next/link';
import {motion, type Variants} from 'framer-motion';

const MotionLink = motion.create(Link);
import {IconArrowRight} from '@tabler/icons-react';
import {SimpleGrid} from '@mantine/core';
import styles from './BrandService.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.15, ease: 'easeOut' as const},
    }),
};

export default function BrandService() {
    return (
        <SimpleGrid cols={{base: 1, lg: 2}} spacing={0} className={styles.section} id="brand-equity-services">
            {/* Brand Equity Panel */}
            <div className={`${styles.panel} ${styles.brandPanel}`}>
                <motion.div
                    className={styles.content}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.3}}
                >
                    <motion.h2 className={styles.panelTitle} variants={fadeUp} custom={0}>
                        BRAND EQUITY
                    </motion.h2>
                    <motion.p className={styles.panelDesc} variants={fadeUp} custom={1}>
                        Từ ý tưởng đến IP sáng tạo, Sino Studio xây dựng giá trị thương hiệu qua hàng triệu lượt tiếp cận trên nền tảng số.
                    </motion.p>
                    <MotionLink href="/brand-equity" className={styles.learnBtn} variants={fadeUp} custom={2}>
                        LEARN MORE <IconArrowRight size={16} stroke={2} />
                    </MotionLink>
                </motion.div>
                <div className={styles.characterWrap}>
                    <motion.div
                        className={styles.characterImg}
                        initial={{opacity: 0, x: -40}}
                        whileInView={{opacity: 1, x: 0}}
                        viewport={{once: true, amount: 0.2}}
                        transition={{duration: 0.9, ease: 'easeOut'}}
                    >
                        <Image
                            src="/images/brand-equity-character.webp"
                            alt="Brand character"
                            fill
                            style={{objectFit: 'contain', objectPosition: 'bottom right'}}
                            sizes="30vw"
                        />
                    </motion.div>
                </div>
            </div>

            {/* Service Panel */}
            <div className={`${styles.panel} ${styles.servicePanel}`}>
                <motion.div
                    className={styles.content}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.3}}
                >
                    <motion.h2 className={styles.panelTitle} variants={fadeUp} custom={0}>
                        SERVICES
                    </motion.h2>
                    <motion.p className={styles.panelDesc} variants={fadeUp} custom={1}>
                        Sino Studio mang đến các giải pháp sáng tạo từ animation, motion design đến phát triển IP gốc.
                    </motion.p>
                    <MotionLink href="/services" className={styles.learnBtn} variants={fadeUp} custom={2}>
                        LEARN MORE <IconArrowRight size={16} stroke={2} />
                    </MotionLink>
                </motion.div>
                <div className={styles.characterWrap}>
                    <motion.div
                        className={styles.characterImg}
                        initial={{opacity: 0, x: 40}}
                        whileInView={{opacity: 1, x: 0}}
                        viewport={{once: true, amount: 0.2}}
                        transition={{duration: 0.9, ease: 'easeOut'}}
                    >
                        <Image
                            src="/images/services-character.webp"
                            alt="Service character"
                            fill
                            style={{objectFit: 'contain', objectPosition: 'bottom right'}}
                            sizes="30vw"
                        />
                    </motion.div>
                </div>
            </div>
        </SimpleGrid>
    );
}
