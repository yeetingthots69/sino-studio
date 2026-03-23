'use client';

import {motion} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import styles from './Projects.module.css';
import Link from 'next/link';
import {useDictionary, useLocale} from '@/i18n/DictionaryProvider';
import {PROJECTS} from '@/data/project-data';
import ProjectCard from '@/components/projects/ProjectCard';

const FEATURED_IDS = [
    'linh-truy-hon-am-gioi',
    'ngoc-bao-khi',
    'chang-trai-bat-tu',
    'tet-lien-quan-2026',
    'tay-du-ki-gen-z',
    'yeu-trong-co-doc',
];

export default function Projects() {
    const locale = useLocale();
    const dict = useDictionary().landing.projects;

    return (
        <section className={styles.section} id="projects">
            <motion.h2
                className={styles.heading}
                initial={{opacity: 0, y: 30}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.6}}
            >
                {dict.heading}
            </motion.h2>

            <SimpleGrid
                cols={{base: 1, sm: 2, lg: 3}}
                spacing={20}
                maw={1200}
                mx="auto"
            >
                {FEATURED_IDS.map((id, i) => {
                    const project = PROJECTS[id];
                    return (
                        <ProjectCard
                            key={id}
                            id={id}
                            title={project.title}
                            type={project.type}
                            index={i}
                        />
                    );
                })}
            </SimpleGrid>

            <motion.div
                className={styles.learnMore}
                initial={{opacity: 0, y: 20}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.5, delay: 0.4}}
            >
                <Link href={`/${locale}/projects`} className={styles.learnBtn}>
                    {dict.learnMore} <span className={styles.arrow}/>
                </Link>
            </motion.div>
        </section>
    );
}