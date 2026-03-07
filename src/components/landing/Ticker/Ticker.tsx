'use client';

import {motion} from 'framer-motion';
import styles from './Ticker.module.css';
import Image from "next/image";

const ITEMS = Array(12).fill('SINO STUDIO');

export default function Ticker() {
    return (
        <div className={styles.ticker}>
            <motion.div
                className={styles.track}
                animate={{x: ['0%', '-50%']}}
                transition={{duration: 18, ease: 'linear', repeat: Infinity}}
            >
                {[...ITEMS, ...ITEMS].map((text, i) => (
                    <div key={i} className={styles.item}>
                        <div className={styles.dot}>
                            <Image src="/sino-studio-face.png" alt="Sino Studio Face" width={512 / 20} height={512 / 20}/>
                        </div>
                        {text}
                    </div>
                ))}
            </motion.div>
        </div>
    );
}

