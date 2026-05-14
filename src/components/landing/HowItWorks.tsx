'use client';

import { motion } from 'framer-motion';
import { Building2, Smartphone, ShieldCheck, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Building2,
    step: '01',
    title: 'Set Up Your College',
    description:
      'Create your college account, add your divisions and routes, and invite your PROs.',
  },
  {
    icon: Smartphone,
    step: '02',
    title: 'Track in the Field',
    description:
      'Your PRO visits the lead, selects the approach type, logs the status, and captures GPS.',
  },
  {
    icon: ShieldCheck,
    step: '03',
    title: 'Verify with GPS',
    description:
      'Doorstep visits are GPS-verified automatically. No location spoofing, no fake visits.',
  },
  {
    icon: BarChart3,
    step: '04',
    title: 'Track Everything Live',
    description:
      'See the update on your dashboard the moment it\'s logged. Reports generate automatically.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-36 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="inline-block px-3.5 py-1 rounded-full bg-[#0d7c3f]/[0.06] text-[#0d7c3f] text-[11px] font-semibold tracking-[0.12em] uppercase"
          >
            How It Works
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-gray-900 tracking-[-0.02em]"
          >
            Up and running in four steps
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.15 }}
            className="mt-5 text-[17px] text-gray-500 max-w-[540px] mx-auto leading-relaxed"
          >
            From setup to live tracking in minutes — not weeks.
          </motion.p>
        </div>

        {/* Steps Grid */}
        <div className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6 relative">
          {/* Connection line (desktop only) */}
          <div className="hidden lg:block absolute top-[44px] left-[15%] right-[15%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.12 + 0.2 }}
              className="relative text-center"
            >
              {/* Icon box */}
              <div className="relative mx-auto w-[88px] h-[88px] rounded-2xl bg-[#0d7c3f]/[0.04] border border-[#0d7c3f]/[0.08] flex items-center justify-center mb-6 z-10">
                <step.icon className="w-8 h-8 text-[#0d7c3f]" />
              </div>

              {/* Step number */}
              <div className="text-[11px] font-bold text-[#0d7c3f] tracking-[0.12em] mb-3">
                STEP {step.step}
              </div>

              <h3 className="text-[17px] font-bold text-gray-900 mb-2.5 tracking-tight">
                {step.title}
              </h3>

              <p className="text-[14px] text-gray-500 leading-relaxed max-w-[240px] mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
