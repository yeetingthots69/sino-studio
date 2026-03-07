'use client';

import { motion, type Variants } from 'framer-motion';
import styles from './AboutMission.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay: i * 0.12, ease: 'easeOut' },
    }),
};

export default function AboutMission() {
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
                        WHO WE ARE
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
                        <span className={styles.statementLabel}>MISSION</span>
                        <p className={styles.statementBody}>
                            To create high-quality animated products that are deeply rooted in Vietnamese
                            identity while delivering exceptional artistic and entertainment value.
                        </p>
                    </motion.div>

                    <motion.div className={styles.divider} variants={fadeUp} custom={1} />

                    {/* VISION */}
                    <motion.div className={styles.statementBlock} variants={fadeUp} custom={2}>
                        <span className={styles.statementLabel}>VISION</span>
                        <p className={styles.statementBody}>
                            To be the pioneer studio bringing Vietnamese animation to a global audience.
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
                    <span className={styles.strengthsLabel}>STRENGTHS</span>
                    <p className={styles.strengthsBody}>
                        A renowned animation brand recognized by millions, with cost-optimized processes
                        and expert personnel across all departments — including music, voice acting,
                        SFX, and media.
                    </p>
                </div>
            </motion.section>
        </>
    );
}
