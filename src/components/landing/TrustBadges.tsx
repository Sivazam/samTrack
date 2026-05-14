'use client';

import { motion } from 'framer-motion';
import { MapPin, Globe, RefreshCw, WifiOff } from 'lucide-react';

/* 
  Trust badge strip below the hero cards:
  GPS VERIFIED VISITS · 100% ONLINE · REAL-TIME SYNC · WORKS OFFLINE
*/
const badges = [
  { icon: MapPin, label: 'GPS VERIFIED VISITS' },
  { icon: Globe, label: '100% ONLINE' },
  { icon: RefreshCw, label: 'REAL-TIME SYNC' },
  { icon: WifiOff, label: 'WORKS OFFLINE' },
];

export function TrustBadges() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="bg-white py-6 md:py-8 border-b border-gray-100"
    >
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {badges.map((badge, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <badge.icon className="w-[18px] h-[18px] text-[#0d7c3f]" />
              <span className="text-[11px] md:text-[12px] font-semibold tracking-[0.1em] text-gray-500 uppercase">
                {badge.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
