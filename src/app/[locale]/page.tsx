import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {SITE_NAME, OG_IMAGES} from '@/lib/seo';
import Navbar from '@/components/navbar/Navbar';
import Hero from '@/components/landing/Hero/Hero';
import Ticker from '@/components/landing/Ticker/Ticker';
import WhoWeAre from '@/components/landing/WhoWeAre/WhoWeAre';
import Clients from '@/components/landing/Clients/Clients';
import Projects from '@/components/landing/Projects/Projects';
import BrandService from '@/components/landing/BrandService/BrandService';
import Footer from '@/components/footer/Footer';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: {absolute: dict.metadata.home.title},
        description: dict.metadata.home.description,
        openGraph: {
            title: dict.metadata.home.title,
            description: dict.metadata.home.description,
            images: [{url: OG_IMAGES.home, width: 1200, height: 630, alt: SITE_NAME}],
        },
        alternates: {
            canonical: `/${locale}`,
            languages: {en: '/en', vi: '/vi'},
        },
    };
}

export default function Home() {
    return (
        <>
            <Navbar/>
            <Hero/>
            <Ticker/>
            <WhoWeAre/>
            <Clients/>
            <Projects/>
            <BrandService/>
            <Footer/>
        </>
    );
}
