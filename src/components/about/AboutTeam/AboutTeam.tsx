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
    {role: 'CEO DIRECTOR', names: 'VU SINO'},
    {role: 'PRODUCER / PROJECT MANAGER', names: 'HOA NGOC'},
    {role: 'MARKETING & COMMUNICATIONS', names: 'HUYDS'},
    {role: 'ART DIRECTOR', names: 'TRUONG HANH'},
    {role: 'STYLE ARTIST', names: 'TRAN QUYNH THU'},
    {role: 'ANIMATION DIRECTOR', names: 'HUNG NOMI'},
    {role: 'ANIMATOR', names: 'VAN PHU, ANH KHANG, TRUONG HUY'},
    {role: 'COMPOSITING ARTISTS', names: 'DATTO, OUTLASTZEDD'},
    {role: 'SOUND ARTIST', names: 'MKM, HOANG JEMI'},
    {role: '3D ARTIST', names: 'NGUYEN HOANG KHANG'},
    {role: 'CONCEPT ARTIST', names: 'TRUNG BA'},
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

