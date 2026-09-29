import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PROJECTS} from '@/data/project-data';
import ProjectShowcasePage from '@/components/project-details/ProjectShowcasePage';
import {SITE_NAME} from '@/lib/seo';
import {creativeWorkJsonLd} from '@/lib/json-ld';

interface Props {
    params: Promise<{locale: string; id: string}>;
}

export async function generateStaticParams() {
    return Object.keys(PROJECTS).map((id) => ({id}));
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
    const {locale, id} = await params;
    const project = PROJECTS[id];
    if (!project) return {title: {absolute: `404 | ${SITE_NAME}`}, robots: {index: false}};

    const description = project.description_1.trim().slice(0, 160);

    return {
        title: project.title,
        description,
        openGraph: {
            title: `${project.title} | ${SITE_NAME}`,
            description,
            type: 'article',
            images: [{url: `/images/projects/${id}/hero.webp`, width: 1200, height: 630, alt: project.title}],
        },
        alternates: {
            canonical: `/${locale}/projects/${id}`,
            languages: {
                en: `/en/projects/${id}`,
                vi: `/vi/projects/${id}`,
            },
        },
    };
}

export default async function ProjectPage({params}: Props) {
    const {locale, id} = await params;
    const project = PROJECTS[id];

    if (!project) notFound();

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(creativeWorkJsonLd({
                        title: project.title,
                        description: project.description_1.trim().slice(0, 160),
                        id: project.id,
                    }, locale)),
                }}
            />
            <ProjectShowcasePage project={project}/>
        </>
    );
}
