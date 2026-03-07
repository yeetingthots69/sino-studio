'use client';

import Image from 'next/image';
import {motion, type Variants} from 'framer-motion';
import {type ProjectMetaData} from '@/data/project-data';
import styles from './Characters.module.css';


const fadeUp: Variants = {
    hidden: {opacity: 0, y: 30},
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.6, delay: i * 0.15, ease: 'easeOut' as const},
    }),
};

interface Props {
    project: ProjectMetaData;
}

export default function Characters({project}: Props) {
    const characters = project.characters.map((name, i) => ({
        id: i + 1,
        name,
        src: `/images/projects/${project.id}/characters-${i + 1}.webp`,
        alt: `${project.title} — ${name} character design`,
    }));

    return (
        <section id="characters" className={styles.section}>
            {/* ── Red heading banner ── */}
            <motion.div
                className={styles.banner}
                initial={{opacity: 0}}
                whileInView={{opacity: 1}}
                viewport={{once: true}}
                transition={{duration: 0.5}}
            >
                <h2 className={styles.bannerTitle}>CHARACTERS</h2>
            </motion.div>

            {/* ── Character rows ── */}
            <div className={styles.characters}>
                {characters.map((char, idx) => (
                    <motion.div
                        key={char.id}
                        className={styles.characterRow}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{once: true, amount: 0.15}}
                    >
                        <motion.div className={styles.imageWrap} variants={fadeUp} custom={idx}>
                            <span className={styles.charName}>{char.name}</span>
                            <div className={styles.imageInner}>
                                <Image
                                    src={char.src}
                                    alt={char.alt}
                                    sizes="80vw"
                                    fill
                                    style={{objectFit: 'contain'}}
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
