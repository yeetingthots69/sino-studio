'use client';

import {useState, useRef, useEffect} from 'react';
import Image from 'next/image';
import {motion, AnimatePresence, type Variants} from 'framer-motion';
import {useMediaQuery} from '@mantine/hooks';
import {Modal, Tooltip, Text} from '@mantine/core';
import {CHARACTER_ORDER, IP_DATA} from '@/data/ip-data';
import styles from './BrandEquityShowcase.module.css';

const fadeUp: Variants = {
    hidden: {opacity: 0, y: 40},
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: {duration: 0.7, delay: i * 0.08, ease: 'easeOut'},
    }),
};

const glitchVariant: Variants = {
    initial: {
        x: 0,
        y: 0,
        scale: 1,
        skewX: 0,
        filter: 'none',
        opacity: 1,
    },
    hover: {
        x: [-3, 5, -1, 6, -4, 2, 0, -5, 3, 0],
        y: [0, -2, 3, -1, 2, -3, 0, 1, -2, 0],
        skewX: [0, -2, 1, 3, -1, 0, 2, -3, 0],
        scale: [1, 1.05, 1.02, 1.07, 1, 1.04, 1],
        filter: [
            'none',
            'drop-shadow(3px 0 0 rgba(255,0,0,0.9)) drop-shadow(-3px 0 0 rgba(0,255,255,0.9)) brightness(1.2)',
            'hue-rotate(50deg) brightness(0.7)',
            'drop-shadow(0 0 10px rgba(255,0,0,1)) contrast(1.6)',
            'drop-shadow(-4px 0 0 rgba(255,0,80,0.9)) drop-shadow(4px 0 0 rgba(0,200,255,0.9)) brightness(1.5)',
            'hue-rotate(200deg) saturate(3) brightness(0.8)',
            'none',
        ],
        opacity: [1, 0.9, 1, 0.12, 1, 0.85, 1, 0.3, 1],
        transition: {
            duration: 0.35,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'linear',
        },
    },
};

const moveDown = ['a-vu', 'hien-luong', 'linh', 'nachi'];

export default function BrandEquityShowcase() {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [jumpscareActive, setJumpscareActive] = useState(false);
    const jumpscareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMobile = useMediaQuery('(max-width: 767px)');

    // Start 5-second timer when modal 4 is open; reset on any other modal
    useEffect(() => {
        if (jumpscareTimerRef.current) {
            clearTimeout(jumpscareTimerRef.current);
            jumpscareTimerRef.current = null;
        }
        if (selectedIndex === 4) {
            jumpscareTimerRef.current = setTimeout(() => setJumpscareActive(true), 5_000);
        }
        return () => {
            if (jumpscareTimerRef.current) clearTimeout(jumpscareTimerRef.current);
        };
    }, [selectedIndex]);

    const characters = CHARACTER_ORDER.map((id) => IP_DATA[id]);
    const selected = selectedIndex !== null ? characters[selectedIndex] : null;

    const openModal = (i: number) => setSelectedIndex(i);
    const closeModal = () => { setSelectedIndex(null); setJumpscareActive(false); };
    const dismissJumpscare = () => { setJumpscareActive(false); closeModal(); };
    const prev = () =>
        setSelectedIndex((cur) =>
            cur !== null ? (cur - 1 + characters.length) % characters.length : null,
        );
    const next = () =>
        setSelectedIndex((cur) =>
            cur !== null ? (cur + 1) % characters.length : null,
        );

    return (
        <section className={styles.section}>
            {/* Section heading */}
            <motion.div
                className={styles.headingRow}
                initial="hidden"
                whileInView="visible"
                viewport={{once: true, amount: 0.3}}
            >
                <motion.h2 className={styles.heading} variants={fadeUp}>
                    ORIGINAL IP SHOWCASE
                </motion.h2>
            </motion.div>

            {/* Cloud section with logo + character row */}
            <div className={styles.cloudSection}>
                {/*<Image*/}
                {/*    src="/images/brand-equity/cloud.png"*/}
                {/*    alt=""*/}
                {/*    fill*/}
                {/*    sizes="100vw"*/}
                {/*    className={styles.cloudBg}*/}
                {/*    priority*/}
                {/*/>*/}
                <video
                    src="/videos/brand-equity/cloud.webm"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className={styles.cloudVideo}
                />
                <div className={styles.cloudOverlay}/>

                <div className={styles.logoWrapper}>
                    <Image
                        src="/sino-studio-full.png"
                        alt="Sino Studio"
                        width={480}
                        height={140}
                        className={styles.logo}
                    />
                </div>

                <div className={styles.characterRow}>
                    {/* 0 · Ma Bà Đồng */}
                    <Tooltip label={characters[0].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charMaBaDong}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(0)}>
                                <Image src={characters[0].imageUrl} alt={characters[0].name}
                                       width={characters[0].imageW} height={characters[0].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 1 · A Vũ */}
                    <Tooltip label={characters[1].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charAVu}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(1)}>
                                <Image src={characters[1].imageUrl} alt={characters[1].name}
                                       width={characters[1].imageW} height={characters[1].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 2 · Heny */}
                    <Tooltip label={characters[2].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charHeny}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(2)}>
                                <Image src={characters[2].imageUrl} alt={characters[2].name}
                                       width={characters[2].imageW} height={characters[2].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 3 · Hiền Lương */}
                    <Tooltip label={characters[3].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charHienLuong}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(3)}>
                                <Image src={characters[3].imageUrl} alt={characters[3].name}
                                       width={characters[3].imageW} height={characters[3].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 4 · Hạ */}
                    <Tooltip label={characters[4].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charHa}>
                            {/*<motion.div whileHover={{scale: 1.08, opacity: 0.25}}*/}
                            {/*            transition={{type: 'spring', stiffness: 300, damping: 20}}*/}
                            {/*            onClick={() => openModal(4)}>*/}
                            <motion.div variants={glitchVariant} initial="initial" whileHover="hover" onClick={() => openModal(4)}>
                                <Image src={characters[4].imageUrl} alt={characters[4].name}
                                       width={characters[4].imageW} height={characters[4].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 5 · Sino */}
                    <Tooltip label={characters[5].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charSino}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(5)}>
                                <Image src={characters[5].imageUrl} alt={characters[5].name}
                                       width={characters[5].imageW} height={characters[5].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 6 · Linh */}
                    <Tooltip label={characters[6].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charLinh}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(6)}>
                                <Image src={characters[6].imageUrl} alt={characters[6].name}
                                       width={characters[6].imageW} height={characters[6].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 7 · Nachi */}
                    <Tooltip label={characters[7].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charNachi}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(7)}>
                                <Image src={characters[7].imageUrl} alt={characters[7].name}
                                       width={characters[7].imageW} height={characters[7].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 8 · Vũ */}
                    <Tooltip label={characters[8].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charVu}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(8)}>
                                <Image src={characters[8].imageUrl} alt={characters[8].name}
                                       width={characters[8].imageW} height={characters[8].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>

                    {/* 9 · Boss */}
                    <Tooltip label={characters[9].name} position="top" withArrow
                             events={{hover: true, focus: true, touch: false}}>
                        <div className={styles.charBoss}>
                            <motion.div whileHover={{scale: 1.08}}
                                        transition={{type: 'spring', stiffness: 300, damping: 20}}
                                        onClick={() => openModal(9)}>
                                <Image src={characters[9].imageUrl} alt={characters[9].name}
                                       width={characters[9].imageW} height={characters[9].imageH} sizes="25vw"
                                       className={styles.characterImg}/>
                            </motion.div>
                        </div>
                    </Tooltip>
                </div>
            </div>

            {/* Tag line */}
            <motion.p
                className={styles.tag}
                initial={{opacity: 0}}
                whileInView={{opacity: 1}}
                viewport={{once: true}}
                transition={{duration: 0.6, delay: 0.3}}
            >
                MV ÂM NHẠC · SERIES PHIM HOẠT HÌNH · MOVIE LINH
            </motion.p>

            {/* 5×2 Character Card Grid */}
            <motion.div
                className={styles.cardGrid}
                initial="hidden"
                whileInView="visible"
                viewport={{once: true, amount: 0.1}}
            >
                {characters.map((char, i) => (
                    <motion.div
                        key={char.id}
                        className={styles.gridCard}
                        variants={fadeUp}
                        custom={i}
                        onClick={() => openModal(i)}
                    >
                        <Text className={styles.gridCardName}>{char.name}</Text>
                        <div className={styles.gridCardImg}>
                            <Image
                                src={char.imageUrl}
                                alt={char.name}
                                width={0}
                                height={0}
                                sizes="(max-width: 767px) 25vw, 12vw"
                                style={moveDown.some(c => c === char.id) ? {top: '5%'} : undefined}
                                className={`${styles.gridCardImgEl} ${char.id === 'sino' ? styles.gridCardSino : ''}`}
                            />
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Character Detail Modal */}
            <Modal
                opened={selectedIndex !== null}
                onClose={closeModal}
                size="xl"
                fullScreen={!!isMobile}
                centered
                withCloseButton
                classNames={{
                    content: styles.modalContent,
                    header: styles.modalHeader,
                    body: styles.modalBody,
                    overlay: styles.modalOverlay,
                    close: styles.modalClose,
                }}
            >
                {/* Preload prev/next images to avoid loading delay on navigation */}
                {selectedIndex !== null && (
                    <span aria-hidden style={{display: 'none'}}>
                        <Image
                            src={characters[(selectedIndex - 1 + characters.length) % characters.length].imageUrl}
                            alt="" width={0} height={0} sizes="35vw" priority
                        />
                        <Image
                            src={characters[(selectedIndex + 1) % characters.length].imageUrl}
                            alt="" width={0} height={0} sizes="35vw" priority
                        />
                    </span>
                )}

                {selected && (
                    <div key={selected.id} className={styles.modalInner}>
                        <div className={styles.modalLayout}>
                            <div className={styles.modalImageCol}>
                                <Image
                                    src={selected.imageUrl}
                                    alt={selected.name}
                                    width={0}
                                    height={0}
                                    sizes="(max-width: 767px) 60vw, 35vw"
                                    className={styles.modalCharImg}
                                />
                            </div>
                            <div className={styles.modalDetailsCol}>
                                <h3 className={styles.modalCharName}>{selected.name}</h3>
                                <div className={styles.modalField}>
                                    <span className={styles.modalLabel}>Ngày sinh</span>
                                    <p className={styles.modalValue}>{selected.dob}</p>
                                </div>
                                <div className={styles.modalField}>
                                    <span className={styles.modalLabel}>Tiểu sử</span>
                                    <p className={styles.modalValue}>
                                        {selected.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Prev / Next arrows */}
                        <button
                            className={`${styles.navArrow} ${styles.navPrev}`}
                            onClick={prev}
                            aria-label="Previous character"
                        >
                            &#8249;
                        </button>
                        <button
                            className={`${styles.navArrow} ${styles.navNext}`}
                            onClick={next}
                            aria-label="Next character"
                        >
                            &#8250;
                        </button>

                        {/* Dot indicators */}
                        <div className={styles.modalDots}>
                            {characters.map((_, i) => (
                                <button
                                    key={i}
                                    className={`${styles.dot} ${i === selectedIndex ? styles.dotActive : ''}`}
                                    onClick={() => setSelectedIndex(i)}
                                    aria-label={`Character ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── Jumpscare ──────────────────────────────────────────────── */}
            {/* Fires after 5 s while modal 4 (Hạ) stays open.              */}
            {/* Replace src paths below with real assets before shipping.   */}
            <AnimatePresence>
                {jumpscareActive && (
                    <motion.div
                        className={styles.jumpscareOverlay}
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        transition={{duration: 0.06}}
                        onClick={dismissJumpscare}
                    >
                        <motion.div
                            className={styles.jumpscareImgWrapper}
                            initial={{scale: 0.04, rotate: -8}}
                            animate={{scale: 1.2, rotate: 3}}
                            transition={{duration: 0.12, ease: [0.2, 0, 0.8, 1]}}
                        >
                            {/* TODO: replace with actual jumpscare image */}
                            <Image
                                src="/images/brand-equity/jumpscare.webp"
                                alt=""
                                width={0}
                                height={0}
                                sizes="100vw"
                                className={styles.jumpscareImg}
                            />
                        </motion.div>
                        {/* TODO: replace with actual jumpscare sound */}
                        <audio src="/music/brand-equity/jumpscare.mp3" autoPlay/>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
