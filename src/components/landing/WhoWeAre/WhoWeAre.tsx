'use client';

import Image from 'next/image';
import {motion, type Variants} from 'framer-motion';
import {IconArrowRight} from '@tabler/icons-react';
import styles from './WhoWeAre.module.css';
import {Group} from "@mantine/core";
import Link from "next/link";
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

export default function WhoWeAre() {
    const locale = useLocale();
    const dict = useDictionary().landing.whoWeAre;
    return (
        <div className={styles.wrapper}>
            <section className={styles.section} id="about">
                <Group className={styles.leftSection}>
                    <motion.div
                        className={styles.content}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{once: true, amount: 0.3}}
                    >
                        <motion.h2 className={styles.heading} variants={fadeUp} custom={0}>
                            {dict.heading} <span className={styles.lightning}>⚡</span>
                        </motion.h2>
                        <motion.p className={styles.body} variants={fadeUp} custom={1}>
                            {dict["body-1"]}
                            <br/>
                            {dict["body-2"]}
                            <br/>
                            {dict["body-3"]}
                        </motion.p>
                        <motion.div variants={fadeUp} custom={2}>
                            <Link href={`/${locale}/about`} className={styles.exploreBtn}>
                                {dict.explore}
                                <IconArrowRight size={18} stroke={1.5}/>
                            </Link>
                        </motion.div>
                    </motion.div>
                </Group>
            </section>

            {/* GIF lives outside <section> so it can span the full wrapper height */}
            <motion.div
                className={styles.characterImg}
                initial={{opacity: 0, x: 60}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.9, ease: 'easeOut'}}
            >
                <Image
                    src="/images/who-we-are-character.gif"
                    alt="Sino Studio Character"
                    fill
                    style={{objectFit: 'contain', objectPosition: 'bottom right'}}
                    sizes="50vw"
                    unoptimized
                />
            </motion.div>
        </div>
    );
}
