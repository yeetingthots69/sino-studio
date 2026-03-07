"use client";

import {motion, type Variants} from "framer-motion";
import {SimpleGrid} from "@mantine/core";
import {type CreditEntry, type ProjectMetaData} from "@/data/project-data";
import styles from "./Credits.module.css";

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 20},
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.5, delay: i * 0.07, ease: "easeOut" as const},
    }),
};

function CreditBlock({role, names, idx}: CreditEntry & {idx: number}) {
    return (
        <motion.div className={styles.creditBlock} variants={fadeUp} custom={idx}>
            <span className={styles.role}>{role}</span>
            <span className={styles.names}>{names}</span>
        </motion.div>
    );
}

interface Props {
    project: ProjectMetaData;
}

export default function Credits({project}: Props) {
    const credits = project.credits;
    const half = Math.ceil(credits.length / 2);
    const leftCredits = credits.slice(0, half);
    const rightCredits = credits.slice(half);

    return (
        <section id="credits" className={styles.section}>
            <div className={styles.inner}>
                {/* ── Title ── */}
                <motion.div
                    className={styles.titleCol}
                    initial={{opacity: 0, x: -24}}
                    whileInView={{opacity: 1, x: 0}}
                    viewport={{once: true}}
                    transition={{duration: 0.6, ease: "easeOut"}}
                >
                    <h2 className={styles.title}>CREDITS</h2>
                </motion.div>

                {/* ── Credit columns ── */}
                <motion.div
                    className={styles.creditsWrap}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.1}}
                >
                    <SimpleGrid cols={{base: 1, sm: 2}} spacing={{base: "xl", sm: 40}}>
                        <div className={styles.creditCol}>
                            {leftCredits.map((c, i) => (
                                <CreditBlock key={c.role} role={c.role} names={c.names} idx={i}/>
                            ))}
                        </div>
                        <div className={styles.creditCol}>
                            {rightCredits.map((c, i) => (
                                <CreditBlock key={c.role} role={c.role} names={c.names} idx={i + half}/>
                            ))}
                        </div>
                    </SimpleGrid>
                </motion.div>
            </div>
        </section>
    );
}
