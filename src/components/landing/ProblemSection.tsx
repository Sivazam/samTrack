'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, EyeOff, FileSpreadsheet } from 'lucide-react';

const problems = [
  {
    icon: AlertTriangle,
    title: 'Missed Follow-ups',
    description:
      'Thousands of potential admissions lost monthly because follow-ups fall through the cracks. No reminders, no accountability — just lost opportunities.',
    stat: '35%',
    statLabel: 'of leads lost to missed follow-ups',
  },
  {
    icon: EyeOff,
    title: 'Zero Field Visibility',
    description:
      "College admins have no idea what their PROs are doing in the field. Hours of uncertainty with zero oversight into how leads are being handled.",
    stat: '0',
    statLabel: 'real-time visibility today',
  },
  {
    icon: FileSpreadsheet,
    title: 'Manual Tracking',
    description:
      'Spreadsheets, WhatsApp groups, and endless phone calls. Hours wasted daily tracking lead status — with updates that are always outdated.',
    stat: '4-6 hrs',
    statLabel: 'wasted daily per team',
  },
];

export function ProblemSection() {
  return (
    <section className="relative py-24 md:py-36 bg-[#0B1120] overflow-hidden">
      {/* Subtle dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          className="text-center"
        >
          <span className="inline-block px-3.5 py-1 rounded-full bg-red-500/[0.08] text-red-400 text-[11px] font-semibold tracking-[0.12em] uppercase">
            The Problem
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ delay: 0.1 }}
          className="mt-6 text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-white text-center leading-tight tracking-[-0.02em]"
        >
          What&apos;s broken in admissions tracking today
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ delay: 0.15 }}
          className="mt-5 text-[17px] text-gray-400 text-center max-w-[540px] mx-auto leading-relaxed"
        >
          Every day without a system is a day you&apos;re losing enrollments.
        </motion.p>

        {/* Problem Cards */}
        <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {problems.map((problem, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.1 + 0.2 }}
              className="relative p-8 md:p-9 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/[0.08] flex items-center justify-center mb-7">
                <problem.icon className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-[19px] font-bold text-white mb-3 tracking-tight">
                {problem.title}
              </h3>
              <p className="text-[15px] text-gray-400 leading-relaxed mb-8">
                {problem.description}
              </p>
              <div className="pt-6 border-t border-white/[0.06]">
                <div className="text-[28px] font-bold text-red-400 tracking-tight">
                  {problem.stat}
                </div>
                <div className="text-[13px] text-gray-500 mt-1">{problem.statLabel}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
