'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Menu, X, ArrowRight } from 'lucide-react';

interface NavbarProps {
  onGetStarted: () => void;
}

export function Navbar({ onGetStarted }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-[#0F1B3C]/95 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-[72px]">
          {/* Logo — Samhitha style: bold text logo, white on dark */}
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-white" />
            <span className="text-[24px] font-bold text-white tracking-[-0.02em]">
              Samhitha
            </span>
          </div>

          {/* Right: Hamburger only — ultra minimal nav */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <div className="flex flex-col gap-[5px]">
                <span className="block w-6 h-[2px] bg-white rounded-full" />
                <span className="block w-6 h-[2px] bg-white rounded-full" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Fullscreen overlay menu — opens on hamburger click */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute top-[72px] left-0 right-0 bg-[#0F1B3C]/98 backdrop-blur-2xl border-t border-white/[0.06]"
          >
            <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-8">
              <div className="space-y-1">
                {[
                  { label: 'Features', id: 'features' },
                  { label: 'How It Works', id: 'how-it-works' },
                  { label: 'Roles', id: 'roles' },
                  { label: 'Impact', id: 'impact' },
                ].map((item, i) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 + 0.1 }}
                    onClick={() => scrollTo(item.id)}
                    className="block w-full text-left px-4 py-3.5 text-[18px] font-medium text-white/70 hover:text-white hover:bg-white/[0.04] rounded-xl transition-colors"
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 pt-6 border-t border-white/[0.06]"
              >
                <button
                  onClick={() => {
                    onGetStarted();
                    setMobileOpen(false);
                  }}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-white text-[#0F1B3C] text-[15px] font-semibold hover:bg-white/90 transition-all"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
