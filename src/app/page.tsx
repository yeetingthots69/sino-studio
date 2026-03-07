import Navbar from '@/components/navbar/Navbar';
import Hero from '@/components/landing/Hero/Hero';
import Ticker from '@/components/landing/Ticker/Ticker';
import WhoWeAre from '@/components/landing/WhoWeAre/WhoWeAre';
import Clients from '@/components/landing/Clients/Clients';
import Projects from '@/components/landing/Projects/Projects';
import BrandService from '@/components/landing/BrandService/BrandService';
import Footer from '@/components/footer/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Ticker />
      <WhoWeAre />
      <Clients />
      <Projects />
      <BrandService />
      <Footer />
    </>
  );
}
