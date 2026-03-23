'use client';

import {motion, type Variants} from 'framer-motion';
import styles from './AboutHero.module.css';
import {useDictionary} from "@/i18n/DictionaryProvider";

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

export default function AboutHero() {
    const dict = useDictionary()["about"].hero;
    return (
        <section className={styles.section}>
            <div className={styles.bg}/>
            <div className={styles.overlay}/>

            <motion.div
                className={styles.content}
                initial="hidden"
                animate="visible"
            >
                <motion.h1 className={styles.heading} variants={fadeUp} custom={0}>
                    {dict.heading}
                </motion.h1>

                <motion.p className={styles.body} variants={fadeUp} custom={1}>
                    {dict["body-1"]}
                </motion.p>

                <motion.p className={styles.body} variants={fadeUp} custom={2}>
                    {dict["body-2"]}
                </motion.p>
            </motion.div>
        </section>
    );
}

