import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import ServicesHero from '@/components/services/ServicesHero/ServicesHero';
import ServicesGrid from '@/components/services/ServicesGrid/ServicesGrid';

export const metadata = {
    title: 'Services — Sino Studio',
    description: 'Khám phá các dịch vụ sáng tạo của Sino Studio: phim hoạt hình, thiết kế, IP gốc và nhiều hơn nữa.',
};

export default function ServicesPage() {
    return (
        <>
            <Navbar />
            <ServicesHero />
            <ServicesGrid />
            <Footer />
        </>
    );
}

