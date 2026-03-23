'use client';

import {useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import {PROJECTS, type ProjectMetaData} from '@/data/project-data';
import ProjectCard from './ProjectCard';
import styles from './ProjectsGrid.module.css';
import {useDictionary} from '@/i18n/DictionaryProvider';

type FilterType = 'all' | 'animation' | 'mv' | 'series' | 'tvc';

const FILTER_VALUES: FilterType[] = ['all', 'tvc', 'animation', 'mv', 'series'];

const allProjects: ProjectMetaData[] = Object.values(PROJECTS);

export default function ProjectsGrid() {
    const dict = useDictionary().projects.grid;
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');

    const filtered = activeFilter === 'all'
        ? allProjects
        : allProjects.filter((p) => p.type === activeFilter);

    return (
        <section className={styles.section}>
            <motion.h2
                className={styles.heading}
                initial={{opacity: 0, y: 30}}
                whileInView={{opacity: 1, y: 0}}
                viewport={{once: true}}
                transition={{duration: 0.6}}
            >
                {dict.heading}
            </motion.h2>

            {/* ── Filter tabs ── */}
            <div className={styles.filters}>
                {FILTER_VALUES.map((value) => (
                    <button
                        key={value}
                        className={`${styles.filterBtn} ${activeFilter === value ? styles.filterBtnActive : ''}`}
                        onClick={() => setActiveFilter(value)}
                    >
                        {dict.filters[value]}
                    </button>
                ))}
            </div>

            {/* ── Grid ── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeFilter}
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    transition={{duration: 0.3}}
                >
                    {filtered.length > 0 ? (
                        <SimpleGrid
                            cols={{base: 1, sm: 2, lg: 3}}
                            spacing={20}
                            maw={1200}
                            mx="auto"
                        >
                            {filtered.map((project, i) => (
                                <ProjectCard
                                    key={project.id}
                                    id={project.id}
                                    title={project.title}
                                    type={project.type}
                                    index={i}
                                />
                            ))}
                        </SimpleGrid>
                    ) : (
                        <p className={styles.empty}>{dict.empty}</p>
                    )}
                </motion.div>
            </AnimatePresence>
        </section>
    );
}