'use client';

import Image from 'next/image';
import {motion, type Variants} from 'framer-motion';
import {SimpleGrid, AspectRatio} from '@mantine/core';
import styles from './Projects.module.css';
import Link from 'next/link';

const projects = [
    {
        id: 1,
        title: 'LINH: TRUY HỒN ÂM GIỚI',
        tag: 'MOVIE HOẠT HÌNH • PHIM CHIẾU RẠP',
        image: '/images/projects/linh.webp',
        href: '/projects/linh-truy-hon-am-gioi',
    },
    {
        id: 2,
        title: 'NGỌC BẢO KHÍ',
        tag: 'MOVIE HOẠT HÌNH • SHORT CLIP',
        image: '/images/projects/long-x-boss.webp',
        href: '/projects/ngoc-bao-khi',
    },
    {
        id: 3,
        title: 'CHÀNG TRAI BẤT TỬ',
        tag: 'ANIMATED MV • NHẠC',
        image: '/images/projects/chang-trai-bat-tinh.jpg',
        href: '/projects/chang-trai-bat-tu',
    },
    {
        id: 4,
        title: 'TẾT LIÊN QUÂN 2026',
        tag: 'TVC',
        image: '/images/projects/O I I.jpg',
        href: '/projects/tet-lien-quan-2026',
    },
    {
        id: 5,
        title: 'TÂY DU KÍ GEN Z',
        tag: 'SERIES HOẠT HÌNH • TRAILER',
        image: '/images/projects/kho-ga.png',
        href: '/projects/tay-du-ki-gen-z',
    },
    {
        id: 6,
        title: 'YÊU TRONG CÔ ĐỘC',
        tag: 'ANIMATED MV • NHẠC',
        image: '/images/projects/ronaldo.png',
        href: '/projects/yeu-trong-co-doc',
    },
];

const cardVariants: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.6, delay: i * 0.08, ease: 'easeOut' as const},
    }),
};

export default function Projects() {
    return (
        <section className={styles.section} id="projects">
            <motion.h2
                className={styles.heading}
                initial={{opacity: 0, y: 30}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.6}}
            >
                PROJECTS
            </motion.h2>

            <SimpleGrid
                cols={{base: 1, sm: 2, lg: 3}}
                spacing={20}
                maw={1200}
                mx="auto"
            >
                {projects.map((project, i) => (
                    <Link key={project.id} href={project.href}>
                        <motion.div
                            className={styles.card}
                            custom={i}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{once: true, amount: 0.1}}
                            variants={cardVariants}
                            whileHover={{scale: 1.02}}
                        >
                            {/* AspectRatio locks every card to 16:10 regardless of content */}
                            <AspectRatio ratio={16 / 10}>
                                <div className={styles.cardInner}>
                                    <div className={styles.cardImg}>
                                        <Image
                                            src={project.image}
                                            alt={project.title}
                                            fill
                                            sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                            style={{objectFit: 'cover', transition: 'transform 0.5s ease'}}
                                        />
                                    </div>
                                    <div className={styles.cardOverlay}/>
                                    <div className={styles.cardInfo}>
                                        <p className={styles.cardTag}>{project.tag}</p>
                                        <h3 className={styles.cardTitle}>{project.title}</h3>
                                    </div>
                                </div>
                            </AspectRatio>
                        </motion.div>
                    </Link>
                ))}
            </SimpleGrid>

            <motion.div
                className={styles.learnMore}
                initial={{opacity: 0, y: 20}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.5, delay: 0.4}}
            >
                <Link href="/projects" className={styles.learnBtn}>
                    LEARN MORE <span className={styles.arrow}/>
                </Link>
            </motion.div>
        </section>
    );
}
