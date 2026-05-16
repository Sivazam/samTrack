'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { StatusBarColor } from './ui/StatusBarColor';
import { AnimatePresence, motion } from 'framer-motion';

interface AppLoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
  progress?: number;
  stage?: string;
}

export function AppLoadingScreen({
  message = "Loading...",
  fullScreen = true,
  progress: externalProgress,
  stage: externalStage
}: AppLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [displayedPercent, setDisplayedPercent] = useState(0);
  const [dots, setDots] = useState(1);
  const [currentStage, setCurrentStage] = useState(externalStage || message || "Loading");
  const [stageVisible, setStageVisible] = useState(true);
  const prevStageRef = useRef(currentStage);
  const animFrameRef = useRef<number | null>(null);

  // Progress animation
  useEffect(() => {
    if (externalProgress !== undefined) {
      setProgress(externalProgress);
    } else {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev + 0.3;
          return prev + Math.random() * 8 + 2;
        });
      }, 300);
      return () => clearInterval(progressInterval);
    }
  }, [externalProgress]);

  // Smooth percentage counter animation
  useEffect(() => {
    const targetPercent = Math.min(Math.round(progress), 100);

    const animatePercent = () => {
      setDisplayedPercent(prev => {
        if (prev < targetPercent) {
          const diff = targetPercent - prev;
          const step = Math.max(1, Math.ceil(diff * 0.15));
          animFrameRef.current = requestAnimationFrame(animatePercent);
          return prev + step;
        }
        return targetPercent;
      });
    };

    animFrameRef.current = requestAnimationFrame(animatePercent);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [progress]);

  // Animated dots effect
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  // Stage text transition with fade
  useEffect(() => {
    const newStage = externalStage || message || "Loading";
    if (newStage !== prevStageRef.current) {
      setStageVisible(false);
      const timer = setTimeout(() => {
        setCurrentStage(newStage);
        prevStageRef.current = newStage;
        setStageVisible(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [externalStage, message]);

  const clampedProgress = Math.min(Math.round(progress), 100);

  const content = (
    <div className="flex flex-col items-center justify-center space-y-6">
      {/* Animated logo area */}
      <div className="relative">
        {/* Outer rotating ring */}
        <div className="absolute -inset-6">
          <div className="w-full h-full rounded-full border-2 border-dashed border-emerald-400/30 animate-[spin_8s_linear_infinite]" />
        </div>
        {/* Pulsing glow */}
        <div className="absolute -inset-3 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
        {/* Logo with subtle scale pulse */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/40"
        >
          <Image
            src="/logoMain.png"
            alt="Samhitha"
            fill
            className="object-contain"
            priority
          />
        </motion.div>
      </div>

      {/* App name */}
      <div className="text-center space-y-1">
        <h1 className="text-white text-2xl font-bold tracking-tight">
          Samhitha
        </h1>
        <p className="text-emerald-200/70 text-[11px] font-semibold tracking-[0.25em] uppercase">
          Admissions Tracker
        </p>
      </div>

      {/* Progress bar with shimmer */}
      <div className="w-52 space-y-3">
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden relative">
          <motion.div
            className="h-full rounded-full"
            style={{ width: `${clampedProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            initial={false}
            animate={{ width: `${clampedProgress}%` }}
          >
            {/* Gradient fill */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 rounded-full" />
            {/* Shimmer overlay */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }}
            />
          </motion.div>
        </div>
        <div className="flex items-center justify-between">
          {/* Stage text with fade transition */}
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: stageVisible ? 1 : 0, y: stageVisible ? 0 : 4 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-emerald-200/50 text-[10px] font-medium"
            >
              {currentStage}{'.'.repeat(dots)}
            </motion.span>
          </AnimatePresence>
          {/* Animated percentage */}
          <span className="text-white/30 text-[10px] font-mono tabular-nums">
            {displayedPercent}%
          </span>
        </div>
      </div>

      {/* Shimmer keyframe style */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );

  return (
    <>
      <StatusBarColor theme="green" />
      {fullScreen ? (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 flex items-center justify-center z-50 loading-screen">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
          {content}
        </div>
      ) : (
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 rounded-lg p-8 flex items-center justify-center loading-screen">
          {content}
        </div>
      )}
    </>
  );
}
