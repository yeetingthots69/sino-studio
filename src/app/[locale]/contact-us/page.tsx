import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ContactHero from '@/components/contact/ContactHero/ContactHero';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: dict.metadata.contact.title,
        description: dict.metadata.contact.description,
        openGraph: {
            title: dict.metadata.contact.title,
            description: dict.metadata.contact.description,
        },
        alternates: {
            canonical: `/${locale}/contact-us`,
            languages: {en: '/en/contact-us', vi: '/vi/contact-us'},
        },
    };
}

export default function ContactPage() {
    return (
        <>
            <Navbar/>
            <ContactHero/>
            <Footer/>
        </>
    );
}
