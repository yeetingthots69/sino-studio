'use client';

import {useState} from 'react';
import {motion, AnimatePresence} from 'framer-motion';
import Image from 'next/image';
import styles from './ContactHero.module.css';
import ContactForm from '../ContactForm/ContactForm';
import {useMediaQuery} from "@mantine/hooks";

export default function ContactHero() {
    const [showForm, setShowForm] = useState(false);
    const isMobile = useMediaQuery('(max-width: 768px)');

    return (
        <section className={styles.section}>
            {/* Full-bleed background */}
            <Image
                src="/images/contact-background.webp"
                alt=""
                fill
                priority
                className={styles.bg}
            />

            {/* Heading — absolutely at top, never participates in layout */}
            <h1 className={styles.heading}>CONTACT US</h1>

            {/* Stage — absolutely at bottom, position never changes on toggle */}
            <div className={styles.stage}>
                <AnimatePresence mode="wait">
                    {!showForm ? (
                        <motion.div
                            key="characters"
                            className={styles.characters}
                            initial={{y: '110%'}}
                            animate={{y: 0}}
                            exit={{y: '110%'}}
                            transition={{duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94]}}
                        >
                            <Image
                                src={`/images/contact-character${isMobile ? '-square' : 's'}.webp`}
                                alt="Sino Studio characters"
                                width={1920}
                                height={1080}
                                className={styles.charactersImg}
                                priority
                            />
                            <button
                                className={styles.toggleBtn}
                                onClick={() => setShowForm(true)}
                            >
                                GET IN TOUCH
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="form"
                            className={styles.formWrap}
                            initial={{y: 60, opacity: 0}}
                            animate={{y: 0, opacity: 1}}
                            exit={{y: 60, opacity: 0}}
                            transition={{duration: 0.4, ease: 'easeOut'}}
                        >
                            <ContactForm onBack={() => setShowForm(false)} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
}