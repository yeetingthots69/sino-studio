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
                            Sino Studio khởi nguồn từ khát vọng của một người trẻ mang trong mình sứ mệnh phát triển hoạt hình Việt Nam. Từ một bước đi đơn độc, tầm nhìn ấy đã kết nối những con người đầu tiên và từ đó chúng tôi hình thành, lớn mạnh và không ngừng mở rộng.
                            <br/>
                            Trải qua 6 năm bền bỉ ăn ngủ cùng hoạt hình, Sino Studio đã xây dựng được một hệ sinh thái sản phẩm đa dạng với nhiều dự án đạt hàng chục triệu lượt xem, ghi dấu ấn rõ nét trên thị trường.
                            <br/><br/>
                            Hướng tới tương lai, chúng tôi tập trung mở rộng hợp tác, phát triển các dự án phim ảnh chiến lược và từng bước hiện thực hóa mục tiêu đưa hoạt hình Việt vươn xa.
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
