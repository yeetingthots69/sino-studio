import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ContactHero from '@/components/contact/ContactHero/ContactHero';

export const metadata = {
    title: 'Contact — Sino Studio',
    description: 'Get in touch with Sino Studio. Reach out for animation projects, collaborations, and inquiries.',
};

export default function ContactPage() {
    return (
        <>
            <Navbar />
            <ContactHero />
            <Footer />
        </>
    );
}
