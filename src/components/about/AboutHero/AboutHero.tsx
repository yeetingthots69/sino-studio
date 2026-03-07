'use client';

import {motion, type Variants} from 'framer-motion';
import styles from './AboutHero.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

export default function AboutHero() {
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
                    ABOUT
                </motion.h1>

                <motion.p className={styles.body} variants={fadeUp} custom={1}>
                    Starting Sino Studio as a solo founder, Vu Sino personally handled every role within the animation
                    studio during its early years. Following the success of the &quot;Journey to the West Gen
                    Z&quot; series,
                    Sino pivoted to music and achieved significant acclaim with hits like &quot;Chàng trai bất tử,&quot;
                    &quot;Yêu em trong mơ,&quot; and &quot;Không thể cố.&quot;
                </motion.p>

                <motion.p className={styles.body} variants={fadeUp} custom={2}>
                    The ultimate goal for Vu and Sino Studio remains constant: to showcase Vietnam to the world through
                    the power of animation.
                </motion.p>
            </motion.div>
        </section>
    );
}

