'use client';

import Image from 'next/image';
import { motion, type Variants } from 'framer-motion';
import styles from './ServicesGrid.module.css';

const fadeUp: Variants = {
    hidden: { opacity: 0, y: 36 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.65, delay: i * 0.1, ease: 'easeOut' },
    }),
};

/* ─── Data ──────────────────────────────────────────────────────── */

interface ImageBlock {
    kind: 'image';
    src: string;
    alt: string;
    label: string;
    sub: string;
}

interface TextBlock {
    kind: 'text';
    theme: 'red' | 'dark';
    heading: string;
    bullets: string[];
    note?: string[];   // extra lines below a spacer
}

type Block = ImageBlock | TextBlock;

const blocks: Block[] = [
    /* Row 1 – left: short-film image (tall), right: IP text */
    {
        kind: 'image',
        src: '/images/projects/ngoc-bao-khi/hero.webp',
        alt: 'Short Film / Pilot',
        label: 'Short Film / Pilot',
        sub: 'Phim ngắn, tập thử nghiệm gọi vốn hoặc giới thiệu IP.',
    },
    {
        kind: 'text',
        theme: 'red',
        heading: 'IP ORIGINAL\nDỰ ÁN GỐC',
        bullets: ['Series gốc', 'Phim điện ảnh', 'Character IP', 'World Building Project'],
        note: ['Mở rộng:', '- Truyện tranh', '- Game', '- Merchandising'],
    },
    /* Row 2 – left: thiết kế text, right: animated series image */
    {
        kind: 'text',
        theme: 'dark',
        heading: 'THIẾT KẾ TĨNH\n& MOTION',
        bullets: ['Key Visual', 'Poster', 'Character Design', 'Concept Art', 'Motion Graphic'],
    },
    {
        kind: 'image',
        src: '/images/services/animated-series.webp',
        alt: 'Animated Series / Web Series',
        label: 'Animated Series / Web Series',
        sub: 'Phim hoạt hình nhiều tập cho YouTube, OTT hoặc brand series.',
    },
    /* Row 3 – left: TVC image, right: trailer image */
    {
        kind: 'image',
        src: '/images/services/tvc-animation.webp',
        alt: 'TVC Animation',
        label: 'TVC Animation',
        sub: 'TVC 2D, 3D hoặc hybrid.',
    },
    {
        kind: 'image',
        src: '/images/projects/ngoc-bao-khi/background-5.webp',
        alt: 'Trailer / Teaser Animation',
        label: 'Trailer / Teaser Animation',
        sub: 'Trailer phim, trailer game, trailer dự án.',
    },
    /* Row 4 – left: game text, right: visual sự kiện text */
    {
        kind: 'text',
        theme: 'dark',
        heading: 'GAME &\nINTERACTIVE',
        bullets: ['Game Assets Nhân vật, môi trường, UI animation.', 'Cutscene Game'],
    },
    {
        kind: 'text',
        theme: 'red',
        heading: 'VISUAL SỰ KIỆN\n& SÂN KHẤU',
        bullets: ['Concert Visual', 'LED Background', 'Event Visual', 'Stage Opening Animation'],
    },
    /* Row 5 – left: MV image, right: TVC image */
    {
        kind: 'image',
        src: '/images/services/mv-animation.webp',
        alt: 'MV Animation',
        label: 'MV Animation',
        sub: 'MV anime, lyric MV, visual MV.',
    },
    {
        kind: 'image',
        src: '/images/projects/tet-lien-quan-2026/background-1.webp',
        alt: 'TVC Animation',
        label: 'Social Media Ad',
        sub: 'Video Tiktok, Reels, Facebook, Motion Banner.',
    },
];

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
                alt={block.alt}
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
            </ul>
            {block.note && (
                <div className={styles.noteBlock}>
                    {block.note.map((n, i) => (
                        <p key={i} className={styles.noteLine}>{n}</p>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

/* ─── Main export ─────────────────────────────────────────────────── */

export default function ServicesGrid() {
    return (
        <section className={styles.section}>
            <div className={styles.grid}>
                {blocks.map((block, idx) =>
                    block.kind === 'image'
                        ? <ImageCard key={idx} block={block} idx={idx} />
                        : <TextCard key={idx} block={block} idx={idx} />
                )}
            </div>
        </section>
    );
}

