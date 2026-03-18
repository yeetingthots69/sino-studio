'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, type Variants } from 'framer-motion';
import { AspectRatio } from '@mantine/core';
import styles from './ProjectCard.module.css';

const TYPE_LABELS: Record<string, string> = {
    animation: 'HOẠT HÌNH',
    mv: 'MV',
    series: 'SERIES',
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay: i * 0.08, ease: 'easeOut' },
    }),
};

interface Props {
    id: string;
    title: string;
    type: string;
    index: number;
}

export default function ProjectCard({ id, title, type, index }: Props) {
    return (
        <Link href={`/projects/${id}`}>
            <motion.div
                className={styles.card}
                custom={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
                variants={cardVariants}
                whileHover={{ scale: 1.02 }}
            >
                <AspectRatio ratio={16 / 10}>
                    <div className={styles.cardInner}>
                        <div className={styles.cardImg}>
                            <Image
                                src={`/images/projects/${id}/hero${id === 'linh-truy-hon-am-gioi' ? '-horizontal' : ''}.webp`}
                                alt={title}
                                fill
                                sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                style={{ objectFit: 'cover', transition: 'transform 0.5s ease' }}
                            />
                        </div>
                        <div className={styles.cardOverlay} />
                        <div className={styles.cardInfo}>
                            <span className={styles.typeBadge}>
                                {TYPE_LABELS[type] ?? type.toUpperCase()}
                            </span>
                            <h3 className={styles.cardTitle}>{title}</h3>
                        </div>
                    </div>
                </AspectRatio>
            </motion.div>
        </Link>
    );
}
