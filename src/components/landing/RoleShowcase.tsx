'use client';

import { motion } from 'framer-motion';
import { GraduationCap, User, Shield, ArrowRight } from 'lucide-react';

const roles = [
  {
    icon: GraduationCap,
    title: 'College Admin',
    description:
      'Manage your entire admissions operation from one dashboard. Track leads, manage PROs, verify visits, and generate reports.',
    bgColor: 'bg-red-50',
    iconColor: 'text-red-600',
    borderColor: 'border-red-100',
    hoverShadow: 'hover:shadow-red-100/50',
  },
  {
    icon: User,
    title: 'PRO (Field Agent)',
    description:
      'Track leads on the go with GPS verification, status updates, and offline support — everything you need in the field.',
    bgColor: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderColor: 'border-blue-100',
    hoverShadow: 'hover:shadow-blue-100/50',
  },
  {
    icon: Shield,
    title: 'Super Admin',
    description:
      'Oversee all colleges, manage subscriptions, and monitor platform-wide analytics.',
    bgColor: 'bg-teal-50',
    iconColor: 'text-teal-600',
    borderColor: 'border-teal-100',
    hoverShadow: 'hover:shadow-teal-100/50',
  },
];

interface RoleShowcaseProps {
  onGetStarted: () => void;
}

export function RoleShowcase({ onGetStarted }: RoleShowcaseProps) {
  return (
    <section id="roles" className="py-24 md:py-36 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="inline-block px-3.5 py-1 rounded-full bg-[#0d7c3f]/[0.06] text-[#0d7c3f] text-[11px] font-semibold tracking-[0.12em] uppercase"
          >
            Built for Everyone
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-gray-900 tracking-[-0.02em]"
          >
            Built for every role in admissions
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ delay: 0.15 }}
            className="mt-5 text-[17px] text-gray-500 max-w-[540px] mx-auto leading-relaxed"
          >
            Everyone gets exactly what they need — nothing more, nothing less.
          </motion.p>
        </div>

        {/* Role Cards */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {roles.map((role, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.1 + 0.2 }}
              onClick={onGetStarted}
              className={`group relative p-8 rounded-2xl bg-white border ${role.borderColor} hover:shadow-xl ${role.hoverShadow} transition-all duration-300 cursor-pointer`}
            >
              <div
                className={`w-14 h-14 rounded-xl ${role.bgColor} flex items-center justify-center mb-7 group-hover:scale-110 transition-transform duration-300`}
              >
                <role.icon className={`w-7 h-7 ${role.iconColor}`} />
              </div>

              <h3 className="text-[17px] font-bold text-gray-900 mb-3 tracking-tight">
                {role.title}
              </h3>

              <p className="text-[14px] text-gray-500 leading-relaxed mb-8">
                {role.description}
              </p>

              <div className="flex items-center gap-1.5 text-[#0d7c3f] text-[13px] font-semibold group-hover:gap-3 transition-all duration-300">
                Get Started <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
