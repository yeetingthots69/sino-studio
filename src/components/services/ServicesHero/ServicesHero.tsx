'use client';

import { motion, type Variants } from 'framer-motion';
import styles from './ServicesHero.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, delay: i * 0.12, ease: 'easeOut' },
    }),
};

export default function ServicesHero() {
    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <motion.div
                    className={styles.titleRow}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h1 className={styles.heading} variants={fadeUp} custom={0}>
                        SERVICES
                    </motion.h1>
                    <motion.div className={styles.bars} variants={fadeUp} custom={1} aria-hidden>
                        <span className={`${styles.bar} ${styles.barShort}`} />
                        <span className={`${styles.bar} ${styles.barMid}`} />
                        <span className={`${styles.bar} ${styles.barTall}`} />
                    </motion.div>
                </motion.div>

                <motion.p className={styles.sub} variants={fadeUp} custom={2} initial="hidden" animate="visible">
                    Sino Studio cung cấp các dịch vụ sáng tạo từ phim hoạt hình, thiết kế tĩnh &amp; motion,
                    đến visual sự kiện và IP gốc — tất cả với phong cách đậm chất Việt Nam.
                </motion.p>
            </div>
        </section>
    );
}

