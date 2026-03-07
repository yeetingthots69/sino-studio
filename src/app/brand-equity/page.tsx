import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import BrandEquityHero from '@/components/brand-equity/BrandEquityHero/BrandEquityHero';
import BrandEquityStats from '@/components/brand-equity/BrandEquityStats/BrandEquityStats';
import BrandEquityShowcase from '@/components/brand-equity/BrandEquityShowcase/BrandEquityShowcase';

export const metadata = {
    title: 'Brand Equity — Sino Studio',
    description: 'Sino Studio xây dựng hệ thống IP gốc mang đậm bản sắc Việt với hơn 330K followers và 115M lượt xem.',
};

export default function BrandEquityPage() {
    return (
        <>
            <Navbar />
            <BrandEquityHero />
            <BrandEquityStats />
            <BrandEquityShowcase />
            <Footer />
        </>
    );
}

