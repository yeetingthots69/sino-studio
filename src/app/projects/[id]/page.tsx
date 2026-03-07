import {notFound} from 'next/navigation';
import {PROJECTS} from '@/data/project-data';
import ProjectShowcasePage from '@/components/project-details/ProjectShowcasePage';

export const dynamicParams = false;

interface Props {
    params: Promise<{id: string}>;
}

export async function generateStaticParams() {
    return Object.keys(PROJECTS).map((id) => ({id}));
}

export async function generateMetadata({params}: Props) {
    const {id} = await params;
    const project = PROJECTS[id];
    if (!project) return {};
    return {title: project.title};
}

export default async function ProjectPage({params}: Props) {
    const {id} = await params;
    const project = PROJECTS[id];

    if (!project) notFound();

    return <ProjectShowcasePage project={project}/>;
}
