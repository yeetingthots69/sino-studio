'use client';

import {motion, type Variants} from 'framer-motion';
import styles from './AboutMission.module.css';
import {useDictionary} from "@/i18n/DictionaryProvider";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay: i * 0.12, ease: 'easeOut' },
    }),
};

export default function AboutMission() {
    const dict = useDictionary()["about"].mission;
    return (
        <>
            {/* ── WHO WE ARE + MISSION / VISION ── */}
            <section className={styles.whoSection}>
                {/* Left — identity block */}
                <motion.div
                    className={styles.whoLeft}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                >
                    <motion.h2 className={styles.whoHeading} variants={fadeUp} custom={0}>
                        {dict.heading}
                    </motion.h2>
                    <motion.p className={styles.whoTagline} variants={fadeUp} custom={1}>
                        CREATIVE · PRODUCTION · MULTIMEDIA · STORYTELLING
                    </motion.p>
                </motion.div>

                {/* Right — mission + vision cards */}
                <motion.div
                    className={styles.whoRight}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                >
                    {/* MISSION */}
                    <motion.div className={styles.statementBlock} variants={fadeUp} custom={0}>
                        <span className={styles.statementLabel}>{dict.mission.heading}</span>
                        <p className={styles.statementBody}>
                            {dict.mission.body}
                        </p>
                    </motion.div>

                    <motion.div className={styles.divider} variants={fadeUp} custom={1} />

                    {/* VISION */}
                    <motion.div className={styles.statementBlock} variants={fadeUp} custom={2}>
                        <span className={styles.statementLabel}>{dict.vision.heading}</span>
                        <p className={styles.statementBody}>
                            {dict.vision.body}
                        </p>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── STRENGTHS pull-quote strip ── */}
            <motion.section
                className={styles.strengthsSection}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6 }}
            >
                <div className={styles.strengthsInner}>
                    <span className={styles.strengthsLabel}>{dict.strength.heading}</span>
                    <p className={styles.strengthsBody}>
                        {dict.strength.body}
                    </p>
                </div>
            </motion.section>
        </>
    );
}
