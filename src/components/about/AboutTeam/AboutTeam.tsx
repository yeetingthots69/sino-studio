'use client';

import {motion, type Variants} from 'framer-motion';
import {SimpleGrid} from '@mantine/core';
import styles from './AboutTeam.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 24},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.55, delay: i * 0.07, ease: 'easeOut'},
    }),
};

interface TeamMember {
    role: string;
    names: string;
}

const teamMembers: TeamMember[] = [
    {role: 'CEO DIRECTOR', names: 'VŨ SINO'},
    {role: 'HEAD OF COMMUNICATION', names: 'HOA NGỌC'},
    {role: 'PROJECT MANAGER', names: 'HUYDS'},
    {role: 'ART DIRECTOR', names: 'TRƯƠNG HẠNH'},
    {role: 'STYLE ARTIST', names: 'TRẦN QUỲNH THƯ'},
    {role: 'ANIMATION DIRECTOR', names: 'HƯNG NOMI'},
    {role: 'ANIMATOR', names: 'VĂN PHÚ, ANH KHANG, TRƯƠNG HUY'},
    {role: 'COMPOSITING ARTISTS', names: 'DATTO, OUTLASTZEDD'},
    {role: 'SOUND ARTIST', names: 'MKM, HOÀNG JEMI'},
    {role: '3D ARTIST', names: 'NGUYỄN HOÀNG KHANG'},
    {role: 'CONCEPT ARTIST', names: 'TRUNG BÁ'},
    {role: '', names: '+ 10 OTHER MEMBERS'},
];

export default function AboutTeam() {
    return (
        <section className={styles.section} id="team">
            <div className={styles.inner}>
                {/* ── Left: TEAM heading ── */}
                <motion.div
                    className={styles.titleCol}
                    initial={{opacity: 0, x: -24}}
                    whileInView={{opacity: 1, x: 0}}
                    viewport={{once: true}}
                    transition={{duration: 0.6, ease: 'easeOut'}}
                >
                    <h2 className={styles.title}>TEAM</h2>
                </motion.div>

                {/* ── Right: member grid ── */}
                <motion.div
                    className={styles.gridWrap}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.1}}
                >
                    <SimpleGrid cols={{base: 1, sm: 2, lg: 3}} spacing={{base: 28, sm: 32, lg: 40}}>
                        {teamMembers.map((member, idx) => (
                            <motion.div
                                key={member.role}
                                className={styles.memberBlock}
                                variants={fadeUp}
                                custom={idx}
                            >
                                <span className={styles.memberRole}>{member.role}</span>
                                <span className={styles.memberName}>{member.names}</span>
                            </motion.div>
                        ))}
                    </SimpleGrid>
                </motion.div>
            </div>
        </section>
    );
}

