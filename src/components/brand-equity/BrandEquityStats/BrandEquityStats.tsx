'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, type Variants, useInView } from 'framer-motion';
import styles from './BrandEquityStats.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, delay: i * 0.15, ease: 'easeOut' },
    }),
};

interface Stat {
    value: number;
    suffix: string;
    label: string;
}

const STATS: Stat[] = [
    { value: 330, suffix: 'K+', label: 'Lượt theo dõi\n(các nền tảng MXH)' },
    { value: 115, suffix: 'M+', label: 'Lượt xem trên tất\ncả các nền tảng' },
    { value: 280, suffix: 'K+', label: 'Người nghe hàng tháng\n(nền tảng Spotify)' },
];

function useCountUp(target: number, duration: number, trigger: boolean) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!trigger) return;
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [trigger, target, duration]);

    return count;
}

function StatItem({ stat, index, trigger }: { stat: Stat; index: number; trigger: boolean }) {
    const count = useCountUp(stat.value, 1800, trigger);

    return (
        <motion.div
            className={styles.statItem}
            variants={fadeUp}
            custom={index}
        >
            <span className={styles.statValue}>
                {count}{stat.suffix}
            </span>
            <span className={styles.statLabel}>
                {stat.label.split('\n').map((line, i) => (
                    <span key={i}>{line}{i < stat.label.split('\n').length - 1 && <br />}</span>
                ))}
            </span>
        </motion.div>
    );
}

export default function BrandEquityStats() {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, amount: 0.4 });

    return (
        <section className={styles.section} ref={ref}>
            <motion.div
                className={styles.inner}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
            >
                {STATS.map((stat, i) => (
                    <StatItem key={i} stat={stat} index={i} trigger={inView} />
                ))}
            </motion.div>
        </section>
    );
}

