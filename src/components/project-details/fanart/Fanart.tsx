'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { MasonryPhotoAlbum } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import { type ProjectMetaData } from '@/data/project-data';
import styles from './Fanart.module.css';

/** Cycling fallback dimensions to produce layout variety when real dims are unknown */
const DEFAULT_DIMS = [
    { w: 1920, h: 1080 }, // landscape 16:9
    { w: 1080, h: 1350 }, // portrait 4:5
    { w: 1080, h: 1080 }, // square 1:1
    { w: 1920, h: 1080 }, // landscape 16:9
    { w: 1350, h: 1080 }, // wide 5:4
];

interface Props {
    project: ProjectMetaData;
}

export default function Fanart({ project }: Props) {
    const count = project.fanartCount ?? 12;

    const photos = Array.from({ length: count }, (_, i) => {
        const dims = project.fanartDimensions?.[i] ?? DEFAULT_DIMS[i % DEFAULT_DIMS.length];
        return {
            key: String(i + 1),
            src: `/images/projects/${project.id}/fanart-${i + 1}.webp`,
            alt: `${project.title} fanart ${i + 1}`,
            width: dims.w,
            height: dims.h,
        };
    });

    return (
        <section id="fanart" className={styles.section}>
            {/* ── Red heading banner ── */}
            <motion.div
                className={styles.banner}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                <h2 className={styles.bannerTitle}>FANART</h2>
            </motion.div>

            {/* ── Masonry grid (all screen sizes) ── */}
            <motion.div
                className={styles.albumWrapper}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.6 }}
            >
                <MasonryPhotoAlbum
                    photos={photos}
                    columns={(containerWidth) => {
                        if (containerWidth < 640) return 2;
                        if (containerWidth < 1024) return 3;
                        return 4;
                    }}
                    spacing={10}
                    componentsProps={{ wrapper: { className: styles.photo } }}
                    render={{
                        image: (imageProps, { photo }) => (
                            <Image
                                src={photo.src}
                                alt={imageProps.alt ?? photo.alt}
                                width={photo.width}
                                height={photo.height}
                                sizes={imageProps.sizes}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                            />
                        ),
                    }}
                />
            </motion.div>
        </section>
    );
}
