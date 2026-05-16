'use client';

import { motion } from 'framer-motion';
import {
  MapPin,
  BarChart3,
  Navigation,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface HeroSectionProps {
  onGetStarted: () => void;
}

/* ─── 4 Category Cards ─── */
const categories = [
  {
    label: 'Lead Tracking',
    icon: MapPin,
    bgColor: 'bg-emerald-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    id: 'features',
  },
  {
    label: 'Live Dashboard',
    icon: BarChart3,
    bgColor: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    id: 'features',
  },
  {
    label: 'Field Visits',
    icon: Navigation,
    bgColor: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    id: 'how-it-works',
  },
  {
    label: 'Campus Security',
    icon: Shield,
    bgColor: 'bg-teal-50',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-700',
    id: 'roles',
  },
];

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen bg-[#0F1B3C] overflow-hidden">
      {/* ─── Subtle top accent bar ─── */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#0d7c3f] via-[#3B6FE8] to-[#0d7c3f]" />

      {/* ─── Watermark text behind cards ─── */}
      <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 select-none pointer-events-none">
        <span className="text-[12vw] font-bold text-white/[0.03] tracking-[-0.04em] whitespace-nowrap">
          Samhitha
        </span>
      </div>

      {/* ─── Content ─── */}
      <div className="relative max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 pt-[140px] md:pt-[160px] pb-16 flex flex-col min-h-screen">
        {/* Social proof line */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <p className="text-[15px] text-white/60">
            Trusted by{' '}
            <span className="font-bold text-white/80">leading colleges</span>{' '}
            across India
          </p>
        </motion.div>

        {/* ─── Main Headline ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-8 md:mt-10 text-center"
        >
          <h1 className="text-[3rem] sm:text-[4rem] md:text-[5rem] lg:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.03em]">
            <span className="text-white">Admissions tracking,</span>
            <br />
            <span className="text-[#6B8FE0]">redefined</span>{' '}
            <span className="text-white">for colleges.</span>
          </h1>
        </motion.div>

        {/* ─── Subtitle ─── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-7 md:mt-8 text-center"
        >
          <p className="text-[16px] md:text-[18px] text-white/50 leading-[1.7] max-w-[640px] mx-auto">
            The all‑in‑one platform connecting College Admins, PROs, and
            Admissions Teams&mdash;simple, direct, and built for the field.
            <br />
            No spreadsheets. No missed follow-ups. Just admissions that work.
          </p>
        </motion.div>

        {/* ─── Spacer to push cards to bottom ─── */}
        <div className="flex-1 min-h-[60px] md:min-h-[80px]" />

        {/* ─── 4 Category Cards ─── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {categories.map((cat, i) => (
              <motion.button
                key={i}
                onClick={() => scrollTo(cat.id)}
                className="group text-left rounded-[20px] overflow-hidden bg-white shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/15 transition-all duration-300 hover:-translate-y-1"
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {/* Image area — pastel bg with centered icon */}
                <div
                  className={`${cat.bgColor} h-[140px] sm:h-[160px] md:h-[200px] lg:h-[220px] flex items-center justify-center relative overflow-hidden`}
                >
                  {/* Decorative subtle circles */}
                  <div className={`absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full ${cat.iconBg} opacity-40`} />
                  <div className={`absolute bottom-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full ${cat.iconBg} opacity-25`} />

                  <div className={`relative z-10 w-16 h-16 md:w-20 md:h-20 rounded-2xl ${cat.iconBg} flex items-center justify-center`}>
                    <cat.icon className={`w-8 h-8 md:w-10 md:h-10 ${cat.iconColor}`} />
                  </div>
                </div>

                {/* Label bar — white bg, text left, arrow right */}
                <div className="flex items-center justify-between px-4 md:px-5 py-3.5 md:py-4">
                  <span className="text-[13px] md:text-[15px] font-semibold text-gray-800 tracking-[-0.01em]">
                    {cat.label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all duration-200" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
