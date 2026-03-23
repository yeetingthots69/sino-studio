'use client';

import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import styles from './ServicesGrid.module.css';
import { useDictionary } from "@/i18n/DictionaryProvider";

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 36 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, delay: i * 0.1, ease: 'easeOut' },
    }),
};

/* ─── Static config (non-translatable) ──────────────────────────── */

interface ImageConfig {
    key: string;
    kind: 'image';
    src: string;
}

interface TextConfig {
    key: string;
    kind: 'text';
    theme: 'red' | 'dark';
}

type BlockConfig = ImageConfig | TextConfig;

const BLOCK_CONFIG: BlockConfig[] = [
    { key: 'short-film',      kind: 'image', src: '/images/projects/ngoc-bao-khi/hero.webp' },
    { key: 'original-ip',     kind: 'text',  theme: 'red' },
    { key: 'design-motion',   kind: 'text',  theme: 'dark' },
    { key: 'animated-series', kind: 'image', src: '/images/services/animated-series.webp' },
    { key: 'tvc-animation',   kind: 'image', src: '/images/services/tvc-animation.webp' },
    { key: 'trailer',         kind: 'image', src: '/images/projects/ngoc-bao-khi/background-5.webp' },
    { key: 'game-interactive',kind: 'text',  theme: 'dark' },
    { key: 'event-visual',    kind: 'text',  theme: 'red' },
    { key: 'mv-animation',    kind: 'image', src: '/images/services/mv-animation.webp' },
    { key: 'social-media-ad', kind: 'image', src: '/images/projects/tet-lien-quan-2026/background-1.webp' },
];

/* ─── Composed types ─────────────────────────────────────────────── */

interface ImageBlock extends ImageConfig {
    label: string;
    sub: string;
}

interface TextBlock extends TextConfig {
    heading: string;
    bullets: string[];
    notes?: string[];
}

type Block = ImageBlock | TextBlock;

/* ─── Sub-components ─────────────────────────────────────────────── */

function ImageCard({ block, idx }: { block: ImageBlock; idx: number }) {
    return (
        <motion.div
            className={styles.imageCard}
            variants={fadeUp}
            custom={idx}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
        >
            <Image
                src={block.src}
                alt={block.label}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: 'cover', objectPosition: 'center top' }}
            />
            <div className={styles.imageOverlay} />
            <div className={styles.imageInfo}>
                <span className={styles.imageLabel}>{block.label}</span>
                <span className={styles.imageSub}>{block.sub}</span>
            </div>
        </motion.div>
    );
}

function TextCard({ block, idx }: { block: TextBlock; idx: number }) {
    return (
        <motion.div
            className={`${styles.textCard} ${block.theme === 'red' ? styles.textCardRed : styles.textCardDark}`}
            variants={fadeUp}
            custom={idx}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
        >
            <h2 className={styles.textHeading}>
                {block.heading.split('\n').map((line, i) => (
                    <span key={i} className={styles.headingLine}>{line}</span>
                ))}
            </h2>
            <ul className={styles.bulletList}>
                {block.bullets.map((b, i) => (
                    <li key={i} className={styles.bulletItem}>{b}</li>
                ))}
                {block.notes && block.notes.map((n, i) => (
                    <li key={i} className={styles.bulletItem}>{n}</li>
                ))}
            </ul>
        </motion.div>
    );
}

/* ─── Main export ─────────────────────────────────────────────────── */

export default function ServicesGrid() {
    const gridDict = useDictionary().services.grid;

    const blocks = BLOCK_CONFIG.map((config) => ({
        ...config,
        ...gridDict[config.key as keyof typeof gridDict],
    })) as Block[];

    return (
        <section className={styles.section}>
            <div className={styles.grid}>
                {blocks.map((block, idx) =>
                    block.kind === 'image'
                        ? <ImageCard key={block.key} block={block} idx={idx} />
                        : <TextCard key={block.key} block={block} idx={idx} />
                )}
            </div>
        </section>
    );
}