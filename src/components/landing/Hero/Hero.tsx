'use client';

import {motion, useScroll, useTransform} from 'framer-motion';
import {useRef} from 'react';
import {useMediaQuery} from '@mantine/hooks';
import styles from './Hero.module.css';

const VIDEO_SOURCES = {
    mobile:  '/videos/hero-video-mobile.webm',   // 1080×1920
    tablet:  '/videos/hero-video-tablet.webm',   // 1080×1080
    desktop: '/videos/hero-video-desktop.webm',  // 1920×1080
};

export default function Hero() {
    const ref = useRef<HTMLDivElement>(null);
    const {scrollYProgress} = useScroll({target: ref, offset: ['start start', 'end start']});
    const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);

    const isMobile = useMediaQuery('(max-width: 767px)');
    const isTablet = useMediaQuery('(max-width: 1023px)');

    const bp = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    return (
        <section className={styles.hero} ref={ref}>
            <motion.div className={styles.heroBg} style={{y}}>
                <video
                    key={bp}
                    className={`${styles.heroBgVideo} ${styles[`heroBgVideo_${bp}`]}`}
                    src={VIDEO_SOURCES[bp]}
                    autoPlay
                    loop
                    muted
                    playsInline
                />
            </motion.div>
            <div className={styles.heroOverlay}/>
        </section>
    );
}

