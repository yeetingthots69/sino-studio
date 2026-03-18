'use client';

import {useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import {PROJECTS, type ProjectMetaData} from '@/data/project-data';
import ProjectCard from './ProjectCard';
import styles from './ProjectsGrid.module.css';

type FilterType = 'all' | 'animation' | 'mv' | 'series';

const FILTER_OPTIONS: {label: string; value: FilterType}[] = [
    {label: 'TẤT CẢ', value: 'all'},
    {label: 'HOẠT HÌNH', value: 'animation'},
    {label: 'MV', value: 'mv'},
    {label: 'SERIES', value: 'series'},
];

const allProjects: ProjectMetaData[] = Object.values(PROJECTS);

export default function ProjectsGrid() {
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
                PROJECTS
            </motion.h2>

            {/* ── Filter tabs ── */}
            <div className={styles.filters}>
                {FILTER_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        className={`${styles.filterBtn} ${activeFilter === opt.value ? styles.filterBtnActive : ''}`}
                        onClick={() => setActiveFilter(opt.value)}
                    >
                        {opt.label}
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
                        <p className={styles.empty}>Chưa có dự án nào.</p>
                    )}
                </motion.div>
            </AnimatePresence>
        </section>
    );
}
