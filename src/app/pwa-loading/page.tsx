'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { StatusBarColor } from '@/components/ui/StatusBarColor';

export default function PWALoadingPage() {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Launching Samhitha...');
  const [dots, setDots] = useState(1);
  const router = useRouter();

  // Animated dots effect
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  useEffect(() => {
    const stages = [
      { progress: 10, stage: 'Initializing application', delay: 300 },
      { progress: 25, stage: 'Loading resources', delay: 400 },
      { progress: 40, stage: 'Checking authentication', delay: 300 },
      { progress: 60, stage: 'Preparing interface', delay: 400 },
      { progress: 80, stage: 'Almost ready', delay: 300 },
      { progress: 95, stage: 'Finalizing setup', delay: 200 },
      { progress: 100, stage: 'Complete', delay: 100 }
    ];

    let currentStage = 0;

    const updateProgress = () => {
      if (currentStage < stages.length) {
        const { progress, stage, delay } = stages[currentStage];
        setProgress(progress);
        setStage(stage);
        currentStage++;

        if (currentStage < stages.length) {
          setTimeout(updateProgress, delay);
        } else {
          setTimeout(() => {
            window.location.replace('/');
          }, 500);
        }
      }
    };

    const timer = setTimeout(updateProgress, 200);
    return () => clearTimeout(timer);
  }, [router]);

  const clampedProgress = Math.min(Math.round(progress), 100);

  return (
    <>
      <StatusBarColor theme="blue" />
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 flex items-center justify-center z-50 loading-screen">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />

        <div className="flex flex-col items-center justify-center space-y-6 relative z-10">
          {/* Animated logo area */}
          <div className="relative">
            {/* Outer rotating ring */}
            <div className="absolute -inset-6">
              <div className="w-full h-full rounded-full border-2 border-dashed border-indigo-400/30 animate-[spin_8s_linear_infinite]" />
            </div>
            {/* Pulsing glow */}
            <div className="absolute -inset-3 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
            {/* Logo */}
            <div className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/40">
              <Image
                src="/logoMain.png"
                alt="Samhitha"
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            </div>
          </div>

          {/* App name */}
          <div className="text-center space-y-1">
            <h1 className="text-white text-2xl font-bold tracking-tight">Samhitha</h1>
            <p className="text-indigo-200/70 text-[11px] font-semibold tracking-[0.25em] uppercase">Admissions Tracker</p>
          </div>

          {/* Progress bar */}
          <div className="w-52 space-y-3">
            <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 h-1 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-indigo-200/50 text-[10px] font-medium">
                {stage}{'.'.repeat(dots)}
              </span>
              <span className="text-white/30 text-[10px] font-mono tabular-nums">
                {clampedProgress}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
