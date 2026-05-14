'use client';

import { motion } from 'framer-motion';
import {
  GraduationCap,
  ShieldCheck,
  Headphones,
  Zap,
  BadgeCheck,
  ArrowRight,
  Mail,
} from 'lucide-react';

const trustItems = [
  { icon: ShieldCheck, label: 'GPS Verified Visits' },
  { icon: Zap, label: 'Free Setup' },
  { icon: Headphones, label: 'Dedicated Support' },
  { icon: BadgeCheck, label: 'No Hidden Fees' },
];

interface FooterProps {
  onGetStarted: () => void;
}

export function Footer({ onGetStarted }: FooterProps) {
  return (
    <>
      {/* ─── Final CTA Section ─── */}
      <section className="relative py-24 md:py-36 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d7c3f] via-[#1a3580] to-[#0B1120]" />

        {/* Decorative orbs */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-400/15 rounded-full blur-[100px]" />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl lg:text-[3rem] font-bold text-white tracking-[-0.02em] leading-tight"
          >
            Ready to transform your admissions?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-[17px] text-blue-100/70 max-w-[480px] mx-auto leading-relaxed"
          >
            Join the growing number of colleges who&apos;ve taken
            control of their admissions tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-10"
          >
            <button
              onClick={onGetStarted}
              className="inline-flex items-center gap-2.5 px-10 py-4 rounded-full bg-white text-[#0d7c3f] text-[17px] font-bold hover:bg-gray-100 transition-all duration-200 shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ─── Trust Strip ─── */}
      <div className="py-5 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {trustItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <item.icon className="w-[18px] h-[18px] text-[#0d7c3f]" />
                <span className="text-[13px] font-medium text-gray-500">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <footer className="py-12 md:py-14 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d7c3f] flex items-center justify-center shadow-sm">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-[18px] font-bold text-gray-900 tracking-tight">
                Samhitha
              </span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
              <a
                href="/privacy-policy"
                className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-200"
              >
                Privacy Policy
              </a>
              <a
                href="/terms-of-use"
                className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-200"
              >
                Terms of Use
              </a>
              <a
                href="/faq"
                className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-200"
              >
                FAQ
              </a>
            </div>

            {/* Contact */}
            <div className="flex items-center gap-5">
              <a
                href="mailto:support@samhitha.com"
                className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-200"
              >
                <Mail className="w-3.5 h-3.5" />
                support@samhitha.com
              </a>
            </div>
          </div>

          {/* Copyright + Disclaimer */}
          <div className="mt-10 pt-8 border-t border-gray-200">
            <p className="text-[12px] text-gray-400 text-center leading-relaxed max-w-3xl mx-auto">
              © 2025 Samhitha. All rights reserved. Samhitha is an admissions tracking management tool for educational institutions.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
