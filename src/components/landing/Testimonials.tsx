'use client';

import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Rajesh Kumar',
    role: 'Admissions Director, Hyderabad',
    quote:
      'Before Samhitha, we had no idea how many follow-ups our PROs missed. Now I see every update live on my dashboard. Admissions are up 40%.',
    initials: 'RK',
    gradient: 'from-[#0d7c3f] to-indigo-600',
  },
  {
    name: 'Priya Sharma',
    role: 'College Admin, Delhi',
    quote:
      'We used to lose track of leads all the time. With GPS verification and status tracking, every single lead is accounted for. No more missed enrollments.',
    initials: 'PS',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    name: 'Amit Patel',
    role: 'PRO, Vijayawada',
    quote:
      "The offline mode is a lifesaver. Half my route has poor network coverage, but the app just works. Updates sync when I get back to the main road.",
    initials: 'AP',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    name: 'Sunita Desai',
    role: 'Admissions Manager, Pune',
    quote:
      'The reminder system is brilliant. I never miss a follow-up now. Every lead gets attention at the right time.',
    initials: 'SD',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    name: 'Vikram Joshi',
    role: 'College Director, Bangalore',
    quote:
      "Reconciliation used to take my team hours every day. Now it happens automatically. We've redirected that time to counseling more students.",
    initials: 'VJ',
    gradient: 'from-red-500 to-rose-600',
  },
  {
    name: 'Meera Iyer',
    role: 'College Admin, Chennai',
    quote:
      "The role-based access is perfect. My PROs see only their assigned leads, and I see the full picture. Everyone has exactly what they need.",
    initials: 'MI',
    gradient: 'from-sky-500 to-blue-600',
  },
];

export function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -380 : 380;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    setTimeout(checkScroll, 400);
  };

  return (
    <section className="py-24 md:py-36 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="inline-block px-3.5 py-1 rounded-full bg-[#0d7c3f]/[0.06] text-[#0d7c3f] text-[11px] font-semibold tracking-[0.12em] uppercase"
            >
              Testimonials
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-gray-900 tracking-[-0.02em]"
            >
              There&apos;s a reason colleges trust us.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: 0.15 }}
              className="mt-4 text-[17px] text-gray-500 max-w-[480px] leading-relaxed"
            >
              Join the growing number of colleges that have transformed their admissions tracking.
            </motion.p>
          </div>

          {/* Scroll Controls */}
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Carousel */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex-shrink-0 w-[320px] md:w-[380px] snap-start"
            >
              <div className="h-full p-7 md:p-8 rounded-2xl bg-gray-50/80 border border-gray-100 hover:shadow-lg hover:border-gray-200/80 transition-all duration-300 relative">
                {/* Quote icon */}
                <Quote className="w-8 h-8 text-[#0d7c3f]/[0.06] absolute top-7 right-7" />

                {/* Stars */}
                <div className="flex gap-[3px] mb-7">
                  {[...Array(5)].map((_, j) => (
                    <Star
                      key={j}
                      className="w-[15px] h-[15px] fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote text */}
                <p className="text-gray-600 text-[14px] md:text-[15px] leading-[1.7] mb-8">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3 pt-6 border-t border-gray-200/80">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}
                  >
                    <span className="text-white text-[12px] font-bold">
                      {t.initials}
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">
                      {t.name}
                    </div>
                    <div className="text-[12px] text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
