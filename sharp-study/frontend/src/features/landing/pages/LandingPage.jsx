import LandingNav      from '../components/LandingNav';
import HeroSection     from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import ShowcaseSection from '../components/ShowcaseSection';
import LandingFooter   from '../components/LandingFooter';

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
        <ShowcaseSection />
      </main>
      <LandingFooter />
    </>
  );
}