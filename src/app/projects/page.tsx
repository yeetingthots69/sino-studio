import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ProjectsGrid from '@/components/projects/ProjectsGrid';

export const metadata = {
    title: 'Projects — Sino Studio',
    description: 'Explore all animation, MV, and series projects by Sino Studio.',
};

export default function ProjectsPage() {
    return (
        <>
            <Navbar />
            <ProjectsGrid />
            <Footer />
        </>
    );
}
