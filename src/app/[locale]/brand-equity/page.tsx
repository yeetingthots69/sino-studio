import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {OG_IMAGES} from '@/lib/seo';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import BrandEquityHero from '@/components/brand-equity/BrandEquityHero/BrandEquityHero';
import BrandEquityStats from '@/components/brand-equity/BrandEquityStats/BrandEquityStats';
import BrandEquityShowcase from '@/components/brand-equity/BrandEquityShowcase/BrandEquityShowcase';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: dict.metadata.brandEquity.title,
        description: dict.metadata.brandEquity.description,
        openGraph: {
            title: dict.metadata.brandEquity.title,
            description: dict.metadata.brandEquity.description,
            images: [{url: OG_IMAGES.brandEquity, width: 1200, height: 630}],
        },
        alternates: {
            canonical: `/${locale}/brand-equity`,
            languages: {en: '/en/brand-equity', vi: '/vi/brand-equity'},
        },
    };
}

export default function BrandEquityPage() {
    return (
        <>
            <Navbar/>
            <BrandEquityHero/>
            <BrandEquityStats/>
            <BrandEquityShowcase/>
            <Footer/>
        </>
    );
}
