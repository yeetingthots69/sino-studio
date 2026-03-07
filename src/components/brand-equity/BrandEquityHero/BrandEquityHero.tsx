'use client';

import { motion, type Variants } from 'framer-motion';
import styles from './BrandEquityHero.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, delay: i * 0.12, ease: 'easeOut' },
    }),
};

export default function BrandEquityHero() {
    return (
        <section className={styles.section}>
            <div className={styles.inner}>
                <motion.div
                    className={styles.titleRow}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.h1 className={styles.heading} variants={fadeUp} custom={0}>
                        BRAND EQUITY
                    </motion.h1>
                    <motion.div className={styles.bars} variants={fadeUp} custom={1} aria-hidden>
                        <span className={`${styles.bar} ${styles.barShort}`} />
                        <span className={`${styles.bar} ${styles.barMid}`} />
                        <span className={`${styles.bar} ${styles.barTall}`} />
                    </motion.div>
                </motion.div>

                <motion.p className={styles.sub} variants={fadeUp} custom={2} initial="hidden" animate="visible">
                    Sino Studio xây dựng hệ thống IP gốc mang đậm bản sắc Việt — từ nhân vật đến vũ trụ sáng tạo,
                    kết nối với hàng triệu khán giả trên các nền tảng số.
                </motion.p>
            </div>
        </section>
    );
}

