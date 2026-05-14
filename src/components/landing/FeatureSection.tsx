'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ReactNode } from 'react';

interface FeatureSectionProps {
  id?: string;
  label: string;
  heading: string;
  subheading: string;
  description: string;
  features: string[];
  imageSide: 'left' | 'right';
  bgClass?: string;
  imageContent: ReactNode;
}

export function FeatureSection({
  id,
  label,
  heading,
  subheading,
  description,
  features,
  imageSide,
  bgClass = 'bg-white',
  imageContent,
}: FeatureSectionProps) {
  const textContent = (
    <motion.div
      initial={{ opacity: 0, x: imageSide === 'left' ? 40 : -40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="flex flex-col justify-center"
    >
      <span className="inline-block self-start px-3.5 py-1 rounded-full bg-[#0d7c3f]/[0.06] text-[#0d7c3f] text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>

      <h2 className="mt-6 text-[1.875rem] md:text-[2.25rem] lg:text-[2.75rem] font-bold text-gray-900 leading-[1.12] tracking-[-0.02em]">
        {heading}
      </h2>

      <h3 className="mt-4 text-[1.125rem] md:text-[1.25rem] font-semibold text-gray-700 leading-snug">
        {subheading}
      </h3>

      <p className="mt-4 text-gray-500 text-[15px] md:text-[16px] leading-[1.7]">
        {description}
      </p>

      <div className="mt-8 space-y-4">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 + 0.3 }}
            className="flex items-start gap-3"
          >
            <div className="mt-[3px] flex-shrink-0 w-[20px] h-[20px] rounded-full bg-[#0d7c3f] flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
            <span className="text-gray-600 text-[15px] leading-relaxed">
              {feature}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  const imageElement = (
    <motion.div
      initial={{ opacity: 0, x: imageSide === 'left' ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {imageContent}
    </motion.div>
  );

  return (
    <section id={id} className={`py-24 md:py-36 ${bgClass}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {imageSide === 'left' ? (
            <>
              {imageElement}
              {textContent}
            </>
          ) : (
            <>
              {textContent}
              {imageElement}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
