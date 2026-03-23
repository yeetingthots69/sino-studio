'use client';

import Image from 'next/image';
import {motion} from 'framer-motion';
import {Tooltip} from '@mantine/core';
import {useMediaQuery} from '@mantine/hooks';
import {Carousel} from '@mantine/carousel';
import AutoScroll from 'embla-carousel-auto-scroll';
import '@mantine/carousel/styles.css';
import styles from './Clients.module.css';
import {useDictionary} from "@/i18n/DictionaryProvider";

const clients = [
    {name: 'Garena', logo: '/images/clients/garena.webp', width: 550, height: 410},
    {name: 'Alpha Technime', logo: '/images/clients/alpha-technime.webp', width: 450, height: 462},
    {name: 'W2W', logo: '/images/clients/w2w.webp', width: 228 * 2, height: 91 * 2},
    {name: 'FG Studio', logo: '/images/clients/fg-studio.webp', width: 602, height: 696},
    {name: 'Hobby Horizon', logo: '/images/clients/hobby-horizon.webp', width: 666 * 1.2, height: 374 * 1.2},
    {name: 'Yin Yang Media', logo: '/images/clients/yin-yang-media.webp', width: 300 * 2, height: 300 * 2},
];

export default function Clients() {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const autoScroll = AutoScroll({speed: 1.5, stopOnInteraction: false, stopOnMouseEnter: true, startDelay: 0});
    const dict = useDictionary().landing.clients;

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

            {/* Mobile / Tablet: Embla auto-scroll carousel */}
            {!isDesktop && (
                <Carousel
                    plugins={[autoScroll]}
                    slideSize={{base: '30%', sm: '30%'}}
                    slideGap="xl"
                    emblaOptions={{loop: true, dragFree: true, align: 'center'}}
                    withControls={false}
                    withIndicators={false}
                    className={styles.carousel}
                >
                    {clients.map((client) => (
                        <Carousel.Slide key={client.name} className={styles.slide}>
                            <div className={styles.logoItem}>
                                <Tooltip label={client.name} position="bottom">
                                    <Image
                                        src={client.logo}
                                        alt={client.name}
                                        width={client.width / 4}
                                        height={client.height / 4}
                                    />
                                </Tooltip>
                            </div>
                        </Carousel.Slide>
                    ))}
                </Carousel>
            )}

            {/* Desktop: static centred grid */}
            {isDesktop && (
                <motion.div
                    className={styles.logos}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{once: true, amount: 0.4}}
                    variants={{hidden: {}, visible: {transition: {staggerChildren: 0.1}}}}
                >
                    {clients.map((client) => (
                        <motion.div
                            key={client.name}
                            className={styles.logoItem}
                            variants={{
                                hidden: {opacity: 0, y: 20},
                                visible: {opacity: 0.75, y: 0, transition: {duration: 0.5}},
                            }}
                            whileHover={{opacity: 1, scale: 1.08}}
                        >
                            <Tooltip label={client.name} position="bottom">
                                <Image
                                    src={client.logo}
                                    alt={client.name}
                                    width={client.width / 4}
                                    height={client.height / 4}
                                />
                            </Tooltip>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </section>
    );
}
