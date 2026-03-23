import type {Metadata} from 'next';
import type {Locale} from '@/i18n/config';
import {getDictionary} from '@/i18n/get-dictionary';
import {OG_IMAGES} from '@/lib/seo';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ProjectsGrid from '@/components/projects/ProjectsGrid';

interface Props {
    params: Promise<{locale: string}>;
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale} = await params;
    const dict = await getDictionary(locale as Locale);

    return {
        title: dict.metadata.projects.title,
        description: dict.metadata.projects.description,
        openGraph: {
            title: dict.metadata.projects.title,
            description: dict.metadata.projects.description,
            images: [{url: OG_IMAGES.projects, width: 1200, height: 630}],
        },
        alternates: {
            canonical: `/${locale}/projects`,
            languages: {en: '/en/projects', vi: '/vi/projects'},
        },
    };
}

export default function ProjectsPage() {
    return (
        <>
            <Navbar/>
            <ProjectsGrid/>
            <Footer/>
        </>
    );
}
