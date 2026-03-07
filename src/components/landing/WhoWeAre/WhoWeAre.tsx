'use client';

import Image from 'next/image';
import {motion, type Variants} from 'framer-motion';
import {IconArrowRight} from '@tabler/icons-react';
import styles from './WhoWeAre.module.css';
import {Group} from "@mantine/core";
import Link from "next/link";

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.12, ease: 'easeOut'},
    }),
};

export default function WhoWeAre() {
    return (
        <div className={styles.wrapper}>
            <section className={styles.section} id="about">
                <Group className={styles.leftSection}>
                    <motion.div
                        className={styles.content}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{once: true, amount: 0.3}}
                    >
                        <motion.h2 className={styles.heading} variants={fadeUp} custom={0}>
                            WHO WE ARE <span className={styles.lightning}>⚡</span>
                        </motion.h2>
                        <motion.p className={styles.body} variants={fadeUp} custom={1}>
                            Vũ SiNo – Người sáng lập SiNo Studio
                            <br/>
                            Bắt đầu thành lập Sino studio khi chỉ có một mình, Vũ Sino đã tự làm hết tất cả các vị trí
                            của
                            một
                            studio hoạt hình trong những năm đầu tiên. Kết thúc sự thành công của series tây du kí genz,
                            Sino
                            chuyển sang con đường âm nhạc và gặt hái thành công với những bài hit như Chàng trai bất tử,
                            yêu
                            em
                            trong mơ, không thể có,...
                            <br/><br/>
                            Mục tiêu của Vũ và SiNo Studio luôn chỉ có một đó là cho thế giới biết nhiều hơn về Việt Nam
                            qua
                            hoạt hình!
                        </motion.p>
                        <motion.div variants={fadeUp} custom={2}>
                            <Link href="/about" className={styles.exploreBtn}>
                                EXPLORE
                                <IconArrowRight size={18} stroke={1.5}/>
                            </Link>
                        </motion.div>
                    </motion.div>
                </Group>
            </section>

            {/* GIF lives outside <section> so it can span the full wrapper height */}
            <motion.div
                className={styles.characterImg}
                initial={{opacity: 0, x: 60}}
                whileInView={{opacity: 1, x: 0}}
                viewport={{once: true, amount: 0.2}}
                transition={{duration: 0.9, ease: 'easeOut'}}
            >
                <Image
                    src="/images/who-we-are-character.gif"
                    alt="Sino Studio Character"
                    fill
                    style={{objectFit: 'contain', objectPosition: 'bottom right'}}
                    sizes="50vw"
                    unoptimized
                />
            </motion.div>
        </div>
    );
}
