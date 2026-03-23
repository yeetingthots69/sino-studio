import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {OG_IMAGES} from '@/lib/seo';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ServicesHero from '@/components/services/ServicesHero/ServicesHero';
import ServicesGrid from '@/components/services/ServicesGrid/ServicesGrid';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: dict.metadata.services.title,
        description: dict.metadata.services.description,
        openGraph: {
            title: dict.metadata.services.title,
            description: dict.metadata.services.description,
            images: [{url: OG_IMAGES.services, width: 1200, height: 630}],
        },
        alternates: {
            canonical: `/${locale}/services`,
            languages: {en: '/en/services', vi: '/vi/services'},
        },
    };
}

export default function ServicesPage() {
    return (
        <>
            <Navbar/>
            <ServicesHero/>
            <ServicesGrid/>
            <Footer/>
        </>
    );
}
