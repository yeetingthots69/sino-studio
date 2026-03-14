import {type ProjectMetaData} from '@/data/project-data';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import Hero from '@/components/project-details/hero/Hero';
import ColorScript from '@/components/project-details/color-script/ColorScript';
import Characters from '@/components/project-details/characters/Characters';
import Background from '@/components/project-details/background/Background';
import Credits from '@/components/project-details/credits/Credits';
import Snippets from '@/components/project-details/snippets/Snippets';
import Fanart from '@/components/project-details/fanart/Fanart';
import Video from '@/components/project-details/video/Video';

interface Props {
    project: ProjectMetaData;
}

export default function ProjectShowcasePage({project}: Props) {
    return (
        <>
            <Navbar/>
            <Hero project={project}/>
            {project.sections.map((section) => {
                switch (section) {
                    case 'color-script':
                        return <ColorScript key={section} project={project}/>;
                    case 'characters':
                        return <Characters key={section} project={project}/>;
                    case 'background':
                        return <Background key={section} project={project}/>;
                    case 'credits':
                        return <Credits key={section} project={project}/>;
                    case 'snippets':
                        return <Snippets key={section} project={project}/>;
                    case 'fanart':
                        return <Fanart key={section} project={project}/>;
                    case 'video':
                        return <Video key={section} project={project}/>;
                    default:
                        return null;
                }
            })}
            <Footer/>
        </>
    );
}


