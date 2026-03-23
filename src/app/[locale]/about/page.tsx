import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {OG_IMAGES} from '@/lib/seo';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import AboutHero from '@/components/about/AboutHero/AboutHero';
import AboutMission from '@/components/about/AboutMission/AboutMission';
import AboutTeam from '@/components/about/AboutTeam/AboutTeam';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: dict.metadata.about.title,
        description: dict.metadata.about.description,
        openGraph: {
            title: dict.metadata.about.title,
            description: dict.metadata.about.description,
            images: [{url: OG_IMAGES.about, width: 1200, height: 630}],
        },
        alternates: {
            canonical: `/${locale}/about`,
            languages: {en: '/en/about', vi: '/vi/about'},
        },
    };
}

export default function AboutPage() {
    return (
        <>
            <Navbar/>
            <AboutHero/>
            <AboutMission/>
            <AboutTeam/>
            <Footer/>
        </>
    );
}
