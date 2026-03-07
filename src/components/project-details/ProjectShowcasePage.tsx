import {type ProjectMetaData} from '@/data/project-data';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import Hero from '@/components/project-details/hero/Hero';
import ColorScript from '@/components/project-details/color-script/ColorScript';
import Characters from '@/components/project-details/characters/Characters';
import Background from '@/components/project-details/background/Background';
import Credits from '@/components/project-details/credits/Credits';

interface Props {
    project: ProjectMetaData;
}

export default function ProjectShowcasePage({project}: Props) {
    if (project.type === 'animation') {
        return (
            <>
                <Navbar/>
                <Hero project={project}/>
                <ColorScript project={project}/>
                <Characters project={project}/>
                <Background project={project}/>
                <Credits project={project}/>
                <Footer/>
            </>
        );
    }

    // Future types (mv, others) can be handled here
    return null;
}

