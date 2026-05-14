'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const stats = [
  {
    value: '35%',
    label: 'Of leads lost due to missed follow-ups and poor tracking',
  },
  {
    value: '4-6 hrs',
    label: 'Spent daily on manual lead status reconciliation per team',
  },
  {
    value: '0',
    label: 'Real-time visibility into what PROs are doing in the field',
  },
  {
    value: '2x',
    label: 'Admissions conversion improvement with systematic tracking',
  },
];

interface StatsSectionProps {
  onGetStarted?: () => void;
}

export function StatsSection({ onGetStarted }: StatsSectionProps) {
  return (
    <section id="impact" className="relative py-24 md:py-36 bg-[#0B1120] overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#0d7c3f]/[0.08] rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-emerald-500/[0.06] rounded-full blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="inline-block px-3.5 py-1 rounded-full bg-amber-500/[0.08] text-amber-400 text-[11px] font-semibold tracking-[0.12em] uppercase"
          >
            The Impact
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-white tracking-[-0.02em]"
          >
            What you&apos;re losing without a system
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.15 }}
            className="mt-5 text-[17px] text-gray-400 max-w-[580px] mx-auto leading-relaxed"
          >
            These numbers are based on real conversations with college admissions teams across India.
          </motion.p>
        </div>

        {/* Stats grid */}
        <div className="mt-16 md:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1 + 0.2 }}
              className="text-center p-6 md:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.05]"
            >
              <div className="text-[2rem] md:text-[2.5rem] font-bold text-white tracking-tight leading-none mb-3">
                {stat.value}
              </div>
              <p className="text-[13px] text-gray-400 leading-relaxed">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-xl md:text-[22px] text-gray-300 font-medium mb-8">
            Stop losing enrollments. Start tracking smarter.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full bg-white text-[#0d7c3f] text-[15px] font-bold hover:bg-gray-100 transition-all duration-200 shadow-xl shadow-black/20"
          >
            Get Started Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
