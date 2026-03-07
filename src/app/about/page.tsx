import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import AboutHero from '@/components/about/AboutHero/AboutHero';
import AboutMission from '@/components/about/AboutMission/AboutMission';
import AboutTeam from '@/components/about/AboutTeam/AboutTeam';

export const metadata = {
    title: 'About — Sino Studio',
    description: 'Learn about Sino Studio, our mission, vision, and the team behind the animation.',
};

export default function AboutPage() {
    return (
        <>
            <Navbar />
            <AboutHero />
            <AboutMission />
            <AboutTeam />
            <Footer />
        </>
    );
}