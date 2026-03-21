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
                            Tạo ra các sản phẩm hoạt hình chất lượng, mang đậm bản sắc Việt và có giá trị nghệ thuật, giải trí cao.
                        </p>
                    </motion.div>

                    <motion.div className={styles.divider} variants={fadeUp} custom={1} />

                    {/* VISION */}
                    <motion.div className={styles.statementBlock} variants={fadeUp} custom={2}>
                        <span className={styles.statementLabel}>VISION</span>
                        <p className={styles.statementBody}>
                            Trở thành studio tiên phong đưa hoạt hình Việt Nam tiếp cận khán giả toàn cầu.
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
                        Là thương hiệu hoạt hình được hàng triệu khán giả biết đến, quy trình tối ưu chi phí. Có kinh nghiêm và nhân sự trong tất cả bộ phận từ âm nhạc, lồng tiếng, SFX, truyền thông,...
                    </p>
                </div>
            </motion.section>
        </>
    );
}
