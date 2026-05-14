'use client';

import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { TrustBadges } from './TrustBadges';
import { ProblemSection } from './ProblemSection';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { RoleShowcase } from './RoleShowcase';
import { StatsSection } from './StatsSection';
import { Testimonials } from './Testimonials';
import { Footer } from './Footer';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: 'var(--font-dm-sans, var(--font-geist-sans))' }}
    >
      <Navbar onGetStarted={onGetStarted} />
      <HeroSection onGetStarted={onGetStarted} />
      <TrustBadges />
      <ProblemSection />
      <Features />
      <HowItWorks />
      <RoleShowcase onGetStarted={onGetStarted} />
      <StatsSection onGetStarted={onGetStarted} />
      <Testimonials />
      <Footer onGetStarted={onGetStarted} />
    </div>
  );
}
